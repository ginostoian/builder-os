"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can, type Permission } from "@/core/roles";
import { bookSurveyInput, id, surveyHoursInput, surveySettingsInput } from "@/core/schemas";
import { slotLabels } from "@/core/surveys";
import { hasFeature, planBlock } from "@/server/plan";
import { getSession, withSession, type Session } from "@/auth/session";
import { getLead } from "@/db/pipeline";
import { SurveyError, bookSurvey, cancelSurvey, currentBooking, getSurveySettings, openSlots, saveSurveySettings, setSurveyHours, surveyors, type SurveyErrorReason } from "@/db/surveys";
import { appOrigin, bookingUrl } from "@/server/origin";
import { emailSurveyChange } from "@/server/surveys";
import { runCompanyAutomations } from "@/server/automations";

export type SurveyActionResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<SurveyErrorReason, string> = {
  not_found: "This lead was removed or changed somewhere else. Reload to see the latest.",
  closed: "This lead is won or lost, so it can't have a visit booked.",
  taken: "They already have a visit that overlaps this time. Pick another time or someone else.",
  unavailable: "That time isn't free any more.",
  unknown_member: "Choose someone on your team.",
  no_booking: "There's no visit booked.",
};

async function allowed(permission: Permission): Promise<Session | null> {
  const s = await getSession();
  return can(s.role, permission) && (await hasFeature("pipeline")) ? s : null;
}

function refresh(leadId?: string) {
  revalidatePath("/app/pipeline");
  revalidatePath("/app/calendar");
  revalidatePath("/m");
  if (leadId) revalidatePath(`/app/pipeline/${leadId}`);
}

/** What the booking dialog offers: who can go, and the next free times (with who'd go). */
export async function surveyOptionsAction(leadId: string) {
  const s = await allowed("leads.edit");
  if (!s || !id.safeParse(leadId).success) return null;
  return withSession(s, async (tx) => {
    const found = await getLead(tx, s.orgId, leadId);
    if (!found) return null;
    const people = await surveyors(tx, s.orgId);
    const settings = await getSurveySettings(tx, s.orgId);
    const { slots } = await openSlots(tx, s.orgId, new Date(), leadId);
    const names = new Map(people.map((p) => [p.id, p.name]));
    const booking = await currentBooking(tx, s.orgId, leadId);
    return {
      surveyors: people,
      minutes: settings.visitMinutes,
      onlineBooking: settings.enabled,
      defaultMemberId: booking?.memberId ?? found.lead.ownerMemberId ?? s.memberId,
      current: booking ? { iso: booking.startsAt.toISOString(), memberId: booking.memberId } : null,
      free: slots.slice(0, 12).map((x) => ({ ...slotLabels(x.startsAt), memberId: x.memberId, memberName: names.get(x.memberId) ?? "" })),
      hasEmail: Boolean(found.lead.email),
    };
  });
}

export async function bookSurveyAction(leadId: string, input: unknown): Promise<SurveyActionResult> {
  const s = await allowed("leads.edit");
  if (!s) return { ok: false, message: (await planBlock("pipeline")) ?? "Your role can't book visits." };
  const parsed = bookSurveyInput.safeParse(input);
  if (!parsed.success || !id.safeParse(leadId).success) return { ok: false, message: "Choose a date and time." };
  const d = parsed.data;
  try {
    const result = await withSession(s, async (tx) => {
      const r = await bookSurvey(tx, s.orgId, leadId, { startsAt: new Date(d.startsAt), memberId: d.memberId, minutes: d.minutes }, s.memberId);
      return { ...r, visit: (await currentBooking(tx, s.orgId, leadId))! };
    });
    if (d.emailClient) {
      const origin = await appOrigin();
      after(() => emailSurveyChange(s.orgId, leadId, result.visit, result.moved ? "moved" : "booked", origin));
    }
    after(() => runCompanyAutomations(s.orgId).catch(() => undefined));
  } catch (error) {
    if (error instanceof SurveyError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  refresh(leadId);
  return { ok: true };
}

export async function cancelSurveyAction(leadId: string, emailClient: boolean): Promise<SurveyActionResult> {
  const s = await allowed("leads.edit");
  if (!s) return { ok: false, message: (await planBlock("pipeline")) ?? "Your role can't change visits." };
  if (!id.safeParse(leadId).success) return { ok: false, message: MESSAGES.not_found };
  try {
    const visit = await withSession(s, (tx) => cancelSurvey(tx, s.orgId, leadId, "office", s.memberId));
    if (emailClient === true && visit.startsAt.getTime() > Date.now()) {
      const origin = await appOrigin();
      after(() => emailSurveyChange(s.orgId, leadId, visit, "cancelled", origin));
    }
  } catch (error) {
    if (error instanceof SurveyError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  refresh(leadId);
  return { ok: true };
}

/** The lead's booking page, to send by text or WhatsApp. */
export async function bookingLinkAction(leadId: string): Promise<{ ok: true; link: string } | { ok: false; message: string }> {
  const s = await allowed("leads.edit");
  if (!s || !id.safeParse(leadId).success) return { ok: false, message: (s ? null : await planBlock("pipeline")) ?? "Your role can't share booking links." };
  const found = await withSession(s, (tx) => getLead(tx, s.orgId, leadId));
  if (!found) return { ok: false, message: MESSAGES.not_found };
  return { ok: true, link: bookingUrl(await appOrigin(), found.lead.unsubscribeToken) };
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function saveSurveySettingsAction(input: unknown): Promise<SurveyActionResult> {
  const s = await allowed("automations.manage");
  if (!s) return { ok: false, message: (await planBlock("pipeline")) ?? "Only Admins and the office can change survey booking." };
  const parsed = surveySettingsInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the numbers and postcode areas." };
  await withSession(s, (tx) => saveSurveySettings(tx, s.orgId, parsed.data));
  revalidatePath("/app/pipeline/surveys");
  return { ok: true };
}

export async function saveSurveyHoursAction(input: unknown): Promise<SurveyActionResult> {
  const s = await allowed("automations.manage");
  if (!s) return { ok: false, message: (await planBlock("pipeline")) ?? "Only Admins and the office can change survey hours." };
  const parsed = surveyHoursInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the times." };
  try {
    await withSession(s, (tx) => setSurveyHours(tx, s.orgId, parsed.data.memberId, parsed.data.windows));
  } catch (error) {
    if (error instanceof SurveyError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath("/app/pipeline/surveys");
  return { ok: true };
}
