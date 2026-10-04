"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatGBP } from "@/core/money";
import { can } from "@/core/roles";
import { id, sendVariationInput, variationSaveInput } from "@/core/schemas";
import { memberEmail, ensurePortalToken } from "@/db/sending";
import { VariationError, addVariationPhoto, createVariation, deleteVariation, removeVariationPhoto, reviseVariation, saveVariation, sendVariation, withdrawVariation, type VariationErrorReason } from "@/db/variations";
import { hasFeature, planBlock } from "@/server/plan";
import { getSession, withSession, type Session } from "@/auth/session";
import { emailConfigured, sendEmail } from "@/server/email";
import { appOrigin, portalVariationUrl } from "@/server/origin";
import { withSignIn } from "@/server/portal-auth";
import { deleteObject, privateUrl, publicUrl, putObject, randomName, storageConfigured } from "@/server/storage";
import { MAX_PHOTO_BYTES, orgFileKey, sniffImage } from "@/core/files";
import { MAX_VARIATION_PHOTOS } from "@/core/variation";

export type VariationActionResult = { ok: true } | { ok: false; message: string };
export type SendVariationResult = { ok: true; link: string; emailed: boolean; emailError?: string; clientEmail: string | null } | { ok: false; message: string };

const NOT_ALLOWED = "Your role can't change quotes or variations.";
const MESSAGES: Record<VariationErrorReason, string> = {
  not_found: "This variation no longer exists.",
  not_accepted: "Variations can only be added once the client has accepted the quote.",
  not_editable: "This variation has been sent, so it can't be changed. Revise it to make a new version.",
  empty: "Add at least one line before sending.",
  not_open: "This variation has already been answered or withdrawn.",
  decided: "The client has already answered this variation.",
  too_many_photos: `A variation can have up to ${MAX_VARIATION_PHOTOS} photos.`,
};

async function editor(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "quotes.edit") && (await hasFeature("variations")) ? session : null;
}

/** Why editor() said no: the plan, or the role. */
const refused = async () => (await planBlock("variations")) ?? NOT_ALLOWED;

function fail(error: unknown): VariationActionResult {
  if (error instanceof VariationError) return { ok: false, message: MESSAGES[error.reason] };
  throw error;
}

/** Start a variation on an accepted quote and open it. */
export async function newVariation(quoteId: string): Promise<VariationActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  if (!id.safeParse(quoteId).success) return { ok: false, message: MESSAGES.not_accepted };
  let variationId: string;
  try {
    variationId = await withSession(session, (tx) => createVariation(tx, session.orgId, { quoteId, memberId: session.memberId }));
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/app/quotes/${quoteId}`);
  redirect(`/app/variations/${variationId}`);
}

export async function saveVariationDraft(input: unknown): Promise<VariationActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  const parsed = variationSaveInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the title and each line: every line needs a name, quantity, unit and rate." };
  try {
    await withSession(session, (tx) => saveVariation(tx, session.orgId, parsed.data));
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/app/variations/${parsed.data.variationId}`);
  return { ok: true };
}

export async function removeVariationDraft(variationId: string): Promise<VariationActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  if (!id.safeParse(variationId).success) return { ok: false, message: MESSAGES.not_found };
  let removed: Awaited<ReturnType<typeof deleteVariation>>;
  try {
    removed = await withSession(session, (tx) => deleteVariation(tx, session.orgId, variationId));
  } catch (error) {
    return fail(error);
  }
  for (const key of removed.orphans) await deleteObject(key);
  revalidatePath(`/app/quotes/${removed.quoteId}`);
  redirect(`/app/quotes/${removed.quoteId}`);
}

/** Freeze and send a draft. Gives the client's link, and emails it when asked and possible. */
export async function sendVariationToClient(input: unknown): Promise<SendVariationResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  const parsed = sendVariationInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.not_found };
  let sent: Awaited<ReturnType<typeof sendVariation>>;
  let token: string;
  let replyTo: string | null;
  try {
    ({ sent, token, replyTo } = await withSession(session, async (tx) => {
      const s = await sendVariation(tx, session.orgId, { variationId: parsed.data.variationId, memberId: session.memberId, photoUrl: publicUrl });
      return { sent: s, token: await ensurePortalToken(tx, session.orgId, s.clientId), replyTo: await memberEmail(tx, session.orgId, session.memberId) };
    }));
  } catch (error) {
    return fail(error) as SendVariationResult;
  }
  const s = sent.snapshot;
  const link = portalVariationUrl(await appOrigin(), token, s.quote.number, s.number);
  revalidatePath(`/app/variations/${parsed.data.variationId}`);
  revalidatePath(`/app/quotes/${sent.quoteId}`);
  if (!parsed.data.email || !sent.clientEmail) return { ok: true, link, emailed: false, clientEmail: sent.clientEmail };
  if (!emailConfigured()) return { ok: true, link, emailed: false, emailError: "Email isn't set up yet, so copy the link and send it yourself.", clientEmail: sent.clientEmail };
  const company = s.company.tradingName ?? s.company.name;
  const credit = s.totals.total < 0;
  const result = await sendEmail({
    to: sent.clientEmail,
    replyTo,
    subject: `Please approve: ${s.title} (variation to ${s.quote.title})`,
    content: {
      company: { name: company, brandColour: s.company.brandColour },
      preheader: `${credit ? "A credit of" : "An extra"} ${formatGBP(Math.abs(s.totals.total))} inc. VAT. Approve or reject online.`,
      heading: `A change to your ${s.quote.title}`,
      paragraphs: [
        `Hi ${sent.clientName},`,
        `${company} has sent you a variation to your quote: ${s.title}.${s.reason ? ` ${s.reason}` : ""}`,
        "Please read it and approve or reject it online. Work on it starts once you've approved.",
      ],
      details: [
        ["Variation", s.ref],
        [credit ? "Credit inc. VAT" : "Extra cost inc. VAT", formatGBP(Math.abs(s.totals.total))],
      ],
      button: { label: "Review the variation", href: await withSignIn(session.orgId, token, link) },
      footer: `${session.memberName}, ${company}. Reply to this email to reach us.`,
    },
  });
  return { ok: true, link, emailed: result.ok, emailError: result.ok ? undefined : result.message, clientEmail: sent.clientEmail };
}

export async function withdrawVariationAction(variationId: string): Promise<VariationActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  if (!id.safeParse(variationId).success) return { ok: false, message: MESSAGES.not_found };
  try {
    const quoteId = await withSession(session, (tx) => withdrawVariation(tx, session.orgId, variationId));
    revalidatePath(`/app/quotes/${quoteId}`);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/app/variations/${variationId}`);
  return { ok: true };
}

/** Copy a sent, rejected or withdrawn variation into a new draft (withdrawing a sent one) and open it. */
export async function reviseVariationAction(variationId: string): Promise<VariationActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  if (!id.safeParse(variationId).success) return { ok: false, message: MESSAGES.not_found };
  let next: string;
  try {
    next = await withSession(session, (tx) => reviseVariation(tx, session.orgId, variationId, session.memberId));
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/app/variations/${variationId}`);
  redirect(`/app/variations/${next}`);
}

export type PhotoResult = { ok: true; key: string; url: string } | { ok: false; message: string };

/**
 * Add a site photo to a draft variation. The browser shrinks it and re-encodes it as JPEG first (which also
 * drops location data); the bytes still decide the type here, whatever the name says.
 */
export async function uploadVariationPhoto(form: FormData): Promise<PhotoResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  if (!storageConfigured()) return { ok: false, message: "File storage isn't set up yet, so photos can't be added." };
  const variationId = form.get("variationId");
  const file = form.get("photo");
  if (typeof variationId !== "string" || !id.safeParse(variationId).success) return { ok: false, message: MESSAGES.not_found };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "That photo is too large. Try a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, message: "Use a JPEG, PNG or WebP photo." };
  const key = orgFileKey(session.orgId, "photos", randomName(), type.ext);
  const stored = await putObject(key, bytes, type.mime);
  if (!stored.ok) return stored;
  try {
    await withSession(session, (tx) => addVariationPhoto(tx, session.orgId, variationId, key));
  } catch (error) {
    await deleteObject(key);
    return fail(error) as PhotoResult;
  }
  revalidatePath(`/app/variations/${variationId}`);
  return { ok: true, key, url: privateUrl(key) };
}

export async function removeVariationPhotoAction(variationId: string, key: string): Promise<VariationActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  if (!id.safeParse(variationId).success) return { ok: false, message: MESSAGES.not_found };
  // Only this company's photo keys: never a logo, never another company's file.
  if (typeof key !== "string" || !new RegExp(`^orgs/${session.orgId}/photos/[A-Za-z0-9_-]{16,64}\\.(jpg|png|webp)$`).test(key)) return { ok: false, message: "That photo isn't on this variation." };
  let unused: boolean;
  try {
    unused = await withSession(session, (tx) => removeVariationPhoto(tx, session.orgId, variationId, key));
  } catch (error) {
    return fail(error);
  }
  if (unused) await deleteObject(key);
  revalidatePath(`/app/variations/${variationId}`);
  return { ok: true };
}
