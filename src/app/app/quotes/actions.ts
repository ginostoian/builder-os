"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { runCompanyAutomations } from "@/server/automations";
import { redirect } from "next/navigation";
import { can } from "@/core/roles";
import { id, newQuoteInput, quoteSave, sendQuoteInput, staffReplyInput } from "@/core/schemas";
import { QuoteError, createQuote, deleteDraft, duplicateQuote, saveQuote, type QuoteErrorReason } from "@/db/quotes";
import { addStaffReply, memberEmail, reviseQuote, sendQuote } from "@/db/sending";
import { emailConfigured, sendEmail } from "@/server/email";
import { formatGBP } from "@/core/money";
import { longDate } from "@/core/quote-snapshot";
import { appOrigin, portalUrl } from "@/server/origin";
import { withSignIn } from "@/server/portal-auth";
import { getSession, withSession, type Session } from "@/auth/session";
import type { RecordActionResult } from "@/components/app/archive-panel";

export type NewQuoteState = { status: "idle" | "error"; errors?: { clientId?: string; title?: string }; message?: string };
export type SaveQuoteResult = { ok: true; version: number } | { ok: false; reason: QuoteErrorReason | "invalid" | "not_allowed"; message: string };

const NOT_ALLOWED = "Your role can't change quotes.";

const MESSAGES: Record<QuoteErrorReason, string> = {
  conflict: "This quote was changed somewhere else, maybe in another tab. Reload to see the latest version.",
  not_editable: "This quote has been sent, so it can't be changed.",
  not_found: "This quote no longer exists.",
  unknown_client: "That client no longer exists or has been archived.",
  unknown_section: "Part of this quote was removed somewhere else. Reload to see the latest version.",
  unknown_line: "Part of this quote was removed somewhere else. Reload to see the latest version.",
  unknown_service: "A service you added is no longer in the library.",
  too_many_lines: "A quote can have up to 2,000 lines.",
  empty: "Add at least one line before sending.",
  not_sent: "This quote hasn't been sent yet.",
  bad_plan: "The payment plan doesn't add up to the quote total. Check the Payment plan tab.",
};

async function editor(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "quotes.edit") ? session : null;
}

/** Start a draft from the "New quote" form, then open it. */
export async function startQuote(form: FormData): Promise<NewQuoteState> {
  const session = await editor();
  if (!session) return { status: "error", message: NOT_ALLOWED };
  const title = form.get("title");
  const clientId = form.get("clientId");
  const parsed = newQuoteInput.safeParse({ clientId, title: typeof title === "string" ? title.trim() : title });
  if (!parsed.success) {
    const errors: NewQuoteState["errors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "clientId") errors.clientId = "Choose a client";
      if (issue.path[0] === "title") errors.title = issue.code === "too_small" ? "Give the quote a title, e.g. Kitchen extension" : issue.message;
    }
    return { status: "error", errors, message: "Check the highlighted fields." };
  }
  let quoteId: string;
  try {
    quoteId = await withSession(session, (tx) => createQuote(tx, session.orgId, parsed.data));
  } catch (error) {
    if (error instanceof QuoteError) return { status: "error", errors: { clientId: MESSAGES[error.reason] }, message: "Check the highlighted fields." };
    throw error;
  }
  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${quoteId}`);
}

/**
 * One autosave from the builder. The input is validated here (never trusted from the browser), and the whole
 * save is applied in one transaction or not at all.
 */
export async function saveQuoteChanges(input: unknown): Promise<SaveQuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, reason: "not_allowed", message: NOT_ALLOWED };
  const parsed = quoteSave.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid", message: "Some of these changes weren't valid, so they weren't saved. Reload and try again." };
  try {
    const version = await withSession(session, (tx) => saveQuote(tx, session.orgId, parsed.data));
    return { ok: true, version };
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, reason: error.reason, message: MESSAGES[error.reason] };
    throw error;
  }
}

export async function removeDraft(quoteId: string): Promise<RecordActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(quoteId).success) return { ok: false, message: MESSAGES.not_found };
  const result = await withSession(session, (tx) => deleteDraft(tx, session.orgId, quoteId));
  if (result === "not_draft") return { ok: false, message: "Only drafts can be deleted." };
  if (result === "was_sent") return { ok: false, message: "This quote has been sent before, so it's kept as a record and can't be deleted." };
  if (result === "not_found") return { ok: false, message: MESSAGES.not_found };
  revalidatePath("/app/quotes");
  redirect("/app/quotes");
}

// ── Sending ──────────────────────────────────────────────────────────────────

export type SendQuoteResult =
  | { ok: true; link: string; emailed: boolean; emailError?: string; clientEmail: string | null; versionNo: number }
  | { ok: false; message: string };

/**
 * Freeze the draft, mark it sent, and give back the client's portal link. Emails it too when asked and email
 * is set up; the quote is sent either way (the email is a courtesy, the link is the quote).
 */
export async function sendQuoteToClient(input: unknown): Promise<SendQuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  const parsed = sendQuoteInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That message is too long or has odd characters in it." };
  let sent: Awaited<ReturnType<typeof sendQuote>>;
  let senderEmail: string | null = null;
  try {
    ({ sent, senderEmail } = await withSession(session, async (tx) => ({
      sent: await sendQuote(tx, session.orgId, { quoteId: parsed.data.quoteId, baseVersion: parsed.data.baseVersion, memberId: session.memberId }),
      senderEmail: await memberEmail(tx, session.orgId, session.memberId),
    })));
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  const link = portalUrl(await appOrigin(), sent.token, sent.snapshot.quote.number);
  // The lead (if any) is now "Quote sent": same-day follow-ups go out after this responds.
  after(() => runCompanyAutomations(session.orgId).catch(() => undefined));
  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${parsed.data.quoteId}`);

  if (!parsed.data.email || !sent.clientEmail) return { ok: true, link, emailed: false, clientEmail: sent.clientEmail, versionNo: sent.versionNo };
  if (!emailConfigured()) return { ok: true, link, emailed: false, emailError: "Email isn't set up yet, so copy the link and send it yourself.", clientEmail: sent.clientEmail, versionNo: sent.versionNo };
  const s = sent.snapshot;
  const company = s.company.tradingName ?? s.company.name;
  const message = parsed.data.message?.trim();
  const result = await sendEmail({
    to: sent.clientEmail,
    replyTo: senderEmail,
    subject: `${sent.versionNo > 1 ? "Updated quote" : "Your quote"} from ${company}: ${s.quote.title}`,
    content: {
      company: { name: company, brandColour: s.company.brandColour },
      preheader: `${s.quote.ref} for ${formatGBP(s.totals.total)} inc. VAT`,
      heading: sent.versionNo > 1 ? `Your updated quote for ${s.quote.title}` : `Your quote for ${s.quote.title}`,
      paragraphs: [`Hi ${s.client.name},`, message ?? `${company} has sent you a quote for ${s.quote.title}. You can read it, ask questions and accept it online.`],
      details: [
        ["Quote", s.quote.ref],
        ["Total inc. VAT", formatGBP(s.totals.total)],
        ...(s.quote.validUntil ? ([["Valid until", longDate(s.quote.validUntil)]] as [string, string][]) : []),
      ],
      button: { label: "View your quote", href: await withSignIn(session.orgId, sent.token, link) },
      footer: `${session.memberName}, ${company}. Reply to this email to reach us.`,
    },
  });
  return { ok: true, link, emailed: result.ok, emailError: result.ok ? undefined : result.message, clientEmail: sent.clientEmail, versionNo: sent.versionNo };
}

/** Reopen a sent quote for changes. The client keeps the last version until it's sent again. */
export async function reviseSentQuote(quoteId: string): Promise<RecordActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(quoteId).success) return { ok: false, message: MESSAGES.not_found };
  try {
    await withSession(session, (tx) => reviseQuote(tx, session.orgId, quoteId, session.memberId));
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, message: error.reason === "not_editable" ? "Accepted quotes are final and can't be changed." : MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
  return { ok: true };
}

export async function replyToClient(input: unknown): Promise<RecordActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  const parsed = staffReplyInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Write a reply first (up to 2,000 characters)." };
  try {
    await withSession(session, (tx) => addStaffReply(tx, session.orgId, { ...parsed.data, memberId: session.memberId, memberName: session.memberName }));
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath(`/app/quotes/${parsed.data.quoteId}`);
  return { ok: true };
}

/** Copy a quote into a new draft and open it. */
export async function duplicateQuoteAction(quoteId: string): Promise<RecordActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(quoteId).success) return { ok: false, message: MESSAGES.not_found };
  let copy: string;
  try {
    copy = await withSession(session, (tx) => duplicateQuote(tx, session.orgId, quoteId));
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, message: error.reason === "unknown_client" ? "This client is archived. Restore them first to start a new quote." : MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${copy}`);
}
