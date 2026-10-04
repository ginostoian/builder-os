/**
 * Survey visits: the company's booking settings and surveyors' hours, and the bookings themselves. A lead
 * has at most one live booking, mirrored in `leads.visit_at`. The database refuses two overlapping live
 * bookings for one person (exclusion constraint, migration 0017), so a race between two clients picking the
 * same slot can't double-book anyone.
 */
import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { formatAddress } from "@/core/clients";
import { OPEN_STAGES, type LeadStage } from "@/core/pipeline";
import { DEFAULT_SURVEY_SETTINGS, availableSlots, slotLabels, type Busy, type Slot, type SurveySettings, type SurveyWindow } from "@/core/surveys";
import { londonDay } from "@/core/team";
import type { Tx } from "./index";
import { notify } from "./notifications";
import { logLeadActivity, setFollowUp, setStage } from "./pipeline";
import { leads, members, organizations, surveyBookings, surveyHours, surveySettings } from "./schema";

export type SurveyErrorReason = "not_found" | "closed" | "taken" | "unavailable" | "unknown_member" | "no_booking";

export class SurveyError extends Error {
  constructor(readonly reason: SurveyErrorReason) {
    super(reason);
  }
}

// ── Settings and hours ───────────────────────────────────────────────────────

export async function getSurveySettings(tx: Tx, orgId: string): Promise<SurveySettings> {
  const [s] = await tx
    .select({ enabled: surveySettings.enabled, visitMinutes: surveySettings.visitMinutes, bufferMinutes: surveySettings.bufferMinutes, minNoticeHours: surveySettings.minNoticeHours, maxDaysAhead: surveySettings.maxDaysAhead, postcodes: surveySettings.postcodes })
    .from(surveySettings)
    .where(eq(surveySettings.orgId, orgId));
  return s ?? DEFAULT_SURVEY_SETTINGS;
}

export async function saveSurveySettings(tx: Tx, orgId: string, input: SurveySettings) {
  const values = { enabled: input.enabled, visitMinutes: input.visitMinutes, bufferMinutes: input.bufferMinutes, minNoticeHours: input.minNoticeHours, maxDaysAhead: input.maxDaysAhead, postcodes: input.postcodes };
  await tx.insert(surveySettings).values({ orgId, ...values }).onConflictDoUpdate({ target: surveySettings.orgId, set: values });
}

/** Everyone's weekly survey hours, active people only. */
export async function listSurveyHours(tx: Tx, orgId: string): Promise<(SurveyWindow & { name: string })[]> {
  return tx
    .select({ memberId: surveyHours.memberId, weekday: surveyHours.weekday, startMinute: surveyHours.startMinute, endMinute: surveyHours.endMinute, name: members.name })
    .from(surveyHours)
    .innerJoin(members, and(eq(members.orgId, surveyHours.orgId), eq(members.id, surveyHours.memberId)))
    .where(and(eq(surveyHours.orgId, orgId), eq(members.active, true)))
    .orderBy(asc(members.name), asc(surveyHours.weekday), asc(surveyHours.startMinute));
}

/** Replace one person's weekly hours. Overlapping windows on a day are merged by the caller's validation. */
export async function setSurveyHours(tx: Tx, orgId: string, memberId: string, windows: Omit<SurveyWindow, "memberId">[]) {
  const [m] = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, memberId), eq(members.active, true)));
  if (!m) throw new SurveyError("unknown_member");
  await tx.delete(surveyHours).where(and(eq(surveyHours.orgId, orgId), eq(surveyHours.memberId, memberId)));
  if (windows.length) await tx.insert(surveyHours).values(windows.map((w) => ({ orgId, memberId, ...w })));
}

// ── Availability ─────────────────────────────────────────────────────────────

async function liveBookings(tx: Tx, orgId: string, from: Date, to: Date): Promise<Busy[]> {
  return tx
    .select({ memberId: surveyBookings.memberId, startsAt: surveyBookings.startsAt, endsAt: surveyBookings.endsAt })
    .from(surveyBookings)
    .where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.status, "booked"), lt(surveyBookings.startsAt, to), gte(surveyBookings.endsAt, from)));
}

/** What a client can book right now. `except` leaves out the lead's own booking (they're moving it). */
export async function openSlots(tx: Tx, orgId: string, now: Date, except?: string): Promise<{ settings: SurveySettings; slots: Slot[] }> {
  const settings = await getSurveySettings(tx, orgId);
  if (!settings.enabled) return { settings, slots: [] };
  const windows = await listSurveyHours(tx, orgId);
  const to = new Date(now.getTime() + (settings.maxDaysAhead + 2) * 86_400_000);
  let busy = await liveBookings(tx, orgId, new Date(now.getTime() - 86_400_000), to);
  if (except) {
    const own = await currentBooking(tx, orgId, except);
    if (own) busy = busy.filter((b) => !(b.memberId === own.memberId && b.startsAt.getTime() === own.startsAt.getTime()));
  }
  return { settings, slots: availableSlots({ settings, windows, busy, now }) };
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function currentBooking(tx: Tx, orgId: string, leadId: string) {
  const [b] = await tx
    .select({ id: surveyBookings.id, memberId: surveyBookings.memberId, memberName: members.name, startsAt: surveyBookings.startsAt, endsAt: surveyBookings.endsAt, bookedBy: surveyBookings.bookedBy })
    .from(surveyBookings)
    .leftJoin(members, and(eq(members.orgId, surveyBookings.orgId), eq(members.id, surveyBookings.memberId)))
    .where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.leadId, leadId), eq(surveyBookings.status, "booked")));
  return b ?? null;
}

/** How many times this lead's visit has been booked or moved: the calendar invite's SEQUENCE. */
export async function bookingSequence(tx: Tx, orgId: string, leadId: string): Promise<number> {
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(surveyBookings).where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.leadId, leadId)));
  return Math.max(0, (r?.n ?? 1) - 1);
}

const isOverlap = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23P01" || e?.cause?.code === "23P01";
};

/**
 * Put a visit in the diary (replacing any earlier one) and on the lead. Doesn't move the lead's stage:
 * `bookSurvey` does that. Throws `taken` if the surveyor already has a visit then.
 */
export async function placeBooking(tx: Tx, orgId: string, leadId: string, b: { startsAt: Date; minutes: number; memberId: string | null; by: "client" | "office"; actor: string | null }) {
  if (b.memberId) {
    const [m] = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, b.memberId), eq(members.active, true)));
    if (!m) throw new SurveyError("unknown_member");
  }
  const now = new Date();
  await tx
    .update(surveyBookings)
    .set({ status: "cancelled", cancelledAt: now })
    .where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.leadId, leadId), eq(surveyBookings.status, "booked")));
  const endsAt = new Date(b.startsAt.getTime() + b.minutes * 60_000);
  let id: string;
  try {
    // A savepoint, so a clash leaves the transaction usable for the caller's error handling.
    id = await tx.transaction(async (sp) => {
      const [row] = await sp.insert(surveyBookings).values({ orgId, leadId, memberId: b.memberId, startsAt: b.startsAt, endsAt, bookedBy: b.by }).returning({ id: surveyBookings.id });
      return row.id;
    });
  } catch (error) {
    if (isOverlap(error)) throw new SurveyError("taken");
    throw error;
  }
  await tx.update(leads).set({ visitAt: b.startsAt }).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  const when = slotLabels(b.startsAt);
  await logLeadActivity(tx, orgId, leadId, "visit", `Site visit booked for ${when.day} at ${when.time}${b.by === "client" ? " (booked online by the client)" : ""}`, b.actor);
  return id;
}

async function openLead(tx: Tx, orgId: string, leadId: string) {
  const [l] = await tx.select({ id: leads.id, name: leads.name, stage: leads.stage, postcode: leads.postcode, ownerMemberId: leads.ownerMemberId }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!l) throw new SurveyError("not_found");
  if (!(OPEN_STAGES as readonly LeadStage[]).includes(l.stage)) throw new SurveyError("closed");
  return l;
}

/** Leads at New or Contacted move to Site visit when a visit is booked; later ones stay where they are. */
async function moveToSiteVisit(tx: Tx, orgId: string, leadId: string, stage: LeadStage, actor: string | null) {
  if (stage === "new" || stage === "contacted") await setStage(tx, orgId, leadId, { stage: "site_visit" }, actor);
}

async function tellSurveyor(tx: Tx, orgId: string, leadId: string, name: string, memberId: string | null, startsAt: Date, kind: "survey_booked" | "survey_cancelled", what: string, actor: string | null) {
  const when = slotLabels(startsAt);
  const recipients = memberId ? [memberId] : [];
  await notify(tx, orgId, recipients, { kind, title: `${name} ${what}: ${when.dayShort}, ${when.time}`, href: `/app/pipeline/${leadId}` }, actor);
}

/** The office books or moves a visit, choosing who goes. They can book outside the online hours. */
export async function bookSurvey(tx: Tx, orgId: string, leadId: string, input: { startsAt: Date; memberId: string | null; minutes?: number }, actor: string) {
  const lead = await openLead(tx, orgId, leadId);
  const settings = await getSurveySettings(tx, orgId);
  const before = await currentBooking(tx, orgId, leadId);
  const id = await placeBooking(tx, orgId, leadId, { startsAt: input.startsAt, minutes: input.minutes ?? settings.visitMinutes, memberId: input.memberId, by: "office", actor });
  await moveToSiteVisit(tx, orgId, leadId, lead.stage, actor);
  await tellSurveyor(tx, orgId, leadId, lead.name, input.memberId, input.startsAt, "survey_booked", before ? "survey moved" : "survey booked", actor);
  return { id, moved: Boolean(before) };
}

/** The client picks a time online. It must be one of the times on offer; the surveyor is assigned here. */
export async function clientBookSurvey(tx: Tx, orgId: string, leadId: string, startsAt: Date, now = new Date()) {
  const lead = await openLead(tx, orgId, leadId);
  const before = await currentBooking(tx, orgId, leadId);
  const { settings, slots } = await openSlots(tx, orgId, now, leadId);
  const slot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!slot) throw new SurveyError("unavailable");
  const id = await placeBooking(tx, orgId, leadId, { startsAt, minutes: settings.visitMinutes, memberId: slot.memberId, by: "client", actor: null });
  await moveToSiteVisit(tx, orgId, leadId, lead.stage, null);
  await tellSurveyor(tx, orgId, leadId, lead.name, slot.memberId, startsAt, "survey_booked", before ? "moved their survey" : "booked a survey", null);
  return { id, memberId: slot.memberId, moved: Boolean(before) };
}

/**
 * Cancel the live visit. When the client cancels, the lead gets a follow-up for today so someone rebooks it.
 */
export async function cancelSurvey(tx: Tx, orgId: string, leadId: string, by: "client" | "office", actor: string | null, today = londonDay(new Date())) {
  const [l] = await tx.select({ name: leads.name }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!l) throw new SurveyError("not_found");
  const b = await currentBooking(tx, orgId, leadId);
  // Clients can only cancel visits still to come.
  if (!b || (by === "client" && b.startsAt.getTime() <= Date.now())) throw new SurveyError("no_booking");
  await tx.update(surveyBookings).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.id, b.id)));
  await tx.update(leads).set({ visitAt: null }).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  await logLeadActivity(tx, orgId, leadId, "visit", by === "client" ? "The client cancelled the site visit" : "Site visit cancelled", actor);
  if (by === "client") {
    await setFollowUp(tx, orgId, leadId, today, "Rebook the site visit");
    await tellSurveyor(tx, orgId, leadId, l.name, b.memberId, b.startsAt, "survey_cancelled", "cancelled their survey", null);
  } else if (b.memberId && b.memberId !== actor) {
    await tellSurveyor(tx, orgId, leadId, l.name, b.memberId, b.startsAt, "survey_cancelled", "survey cancelled", actor);
  }
  return b;
}

/** Who can be sent on a survey: active staff (not employees, who only use the site app). */
export async function surveyors(tx: Tx, orgId: string) {
  return tx
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true), inArray(members.role, ["admin", "office", "estimator", "site_lead"])))
    .orderBy(asc(members.name));
}

// ── What the client sees on the booking page ─────────────────────────────────

export async function bookingPageContext(tx: Tx, orgId: string, leadId: string) {
  const [row] = await tx
    .select({
      lead: { id: leads.id, name: leads.name, email: leads.email, phone: leads.phone, address: leads.address, postcode: leads.postcode, projectType: leads.projectType, stage: leads.stage, token: leads.unsubscribeToken },
      company: { name: organizations.name, tradingName: organizations.tradingName, logoUrl: organizations.logoUrl, brandColour: organizations.brandColour },
    })
    .from(leads)
    .innerJoin(organizations, eq(organizations.id, leads.orgId))
    .where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!row) return null;
  return { ...row, booking: await currentBooking(tx, orgId, leadId) };
}

/** The client confirms or corrects how to reach them and where the visit is. */
export async function updateVisitDetails(tx: Tx, orgId: string, leadId: string, d: { phone?: string; addressLine?: string; postcode?: string }) {
  const [l] = await tx.select({ address: leads.address, postcode: leads.postcode, phone: leads.phone }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!l) throw new SurveyError("not_found");
  const set: Partial<typeof leads.$inferInsert> = {};
  if (d.phone && d.phone !== l.phone) set.phone = d.phone;
  if (d.postcode && d.postcode !== l.postcode) set.postcode = d.postcode;
  if (d.addressLine && d.addressLine !== l.address?.line1) set.address = { line1: d.addressLine, town: l.address?.town ?? "", postcode: d.postcode ?? l.postcode ?? l.address?.postcode ?? "" };
  if (Object.keys(set).length) await tx.update(leads).set(set).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
}

/** Where the visit is, in one line: the address, or at least the postcode. */
export function visitPlace(l: { address: Parameters<typeof formatAddress>[0]; postcode: string | null }) {
  return formatAddress(l.address) || l.postcode || null;
}

// ── The site app and reminders ───────────────────────────────────────────────

/** My visits on these UK days, for the site app. */
export async function mySurveys(tx: Tx, orgId: string, memberId: string, from: Date, to: Date) {
  return tx
    .select({
      id: surveyBookings.id,
      startsAt: surveyBookings.startsAt,
      endsAt: surveyBookings.endsAt,
      leadId: leads.id,
      name: leads.name,
      phone: leads.phone,
      address: leads.address,
      postcode: leads.postcode,
      projectType: leads.projectType,
      description: leads.description,
      budget: leads.budget,
    })
    .from(surveyBookings)
    .innerJoin(leads, and(eq(leads.orgId, surveyBookings.orgId), eq(leads.id, surveyBookings.leadId)))
    .where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.memberId, memberId), eq(surveyBookings.status, "booked"), gte(surveyBookings.startsAt, from), lt(surveyBookings.startsAt, to)))
    .orderBy(asc(surveyBookings.startsAt));
}

/** Visits between `from` and `to` whose client hasn't had a reminder, with what the email needs. */
export async function surveysToRemind(tx: Tx, orgId: string, from: Date, to: Date) {
  return tx
    .select({
      id: surveyBookings.id,
      startsAt: surveyBookings.startsAt,
      leadId: leads.id,
      name: leads.name,
      email: leads.email,
      optOut: leads.emailOptOut,
      token: leads.unsubscribeToken,
      address: leads.address,
      postcode: leads.postcode,
      surveyor: members.name,
    })
    .from(surveyBookings)
    .innerJoin(leads, and(eq(leads.orgId, surveyBookings.orgId), eq(leads.id, surveyBookings.leadId)))
    .leftJoin(members, and(eq(members.orgId, surveyBookings.orgId), eq(members.id, surveyBookings.memberId)))
    .where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.status, "booked"), isNull(surveyBookings.reminderSentAt), gte(surveyBookings.startsAt, from), lt(surveyBookings.startsAt, to)))
    .limit(200);
}

/** Claim a reminder before sending it, so overlapping runs send it once. */
export async function claimSurveyReminder(tx: Tx, orgId: string, bookingId: string): Promise<boolean> {
  const rows = await tx
    .update(surveyBookings)
    .set({ reminderSentAt: new Date() })
    .where(and(eq(surveyBookings.orgId, orgId), eq(surveyBookings.id, bookingId), isNull(surveyBookings.reminderSentAt), eq(surveyBookings.status, "booked")))
    .returning({ id: surveyBookings.id });
  return rows.length === 1;
}
