/**
 * The team: everyone who works for the company, with or without a login (labourers and subcontractors
 * often have none). Certificates and cards with expiry dates, and site visits (check in / check out) that
 * become timesheets. Pure rules shared by the office screens, the site app and the reminder job.
 */
import { addDays } from "./payment-plan";
import { londonToUtc } from "./surveys";

export const WORKER_KINDS = ["employee", "subcontractor"] as const;
export type WorkerKind = (typeof WORKER_KINDS)[number];
export const WORKER_KIND_LABEL: Record<WorkerKind, string> = { employee: "Employee", subcontractor: "Subcontractor" };

/** Common UK site cards and tickets, offered as suggestions (any name is allowed). */
export const CERTIFICATE_SUGGESTIONS = [
  "CSCS card",
  "Gas Safe registration",
  "NICEIC / Part P",
  "18th Edition (BS 7671)",
  "Asbestos awareness",
  "SMSTS",
  "SSSTS",
  "First aid at work",
  "IPAF",
  "PASMA",
  "Working at height",
  "Manual handling",
  "Public liability insurance",
] as const;

/** Certificates are flagged this many days before they expire, and the office is emailed once. */
export const CERT_WARNING_DAYS = 30;

export type CertState = "ok" | "expiring" | "expired" | "no_expiry";

export function certState(expiresOn: string | null, today: string): CertState {
  if (!expiresOn) return "no_expiry";
  if (expiresOn < today) return "expired";
  return expiresOn <= addDays(today, CERT_WARNING_DAYS) ? "expiring" : "ok";
}

/** Minutes between two times, rounded down; an open visit counts up to `now`. */
export function visitMinutes(checkedInAt: Date, checkedOutAt: Date | null, now = new Date()): number {
  return Math.max(0, Math.floor(((checkedOutAt ?? now).getTime() - checkedInAt.getTime()) / 60_000));
}

/** "7h 25m" */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Did a task with these dates (either may be missing) fall on `day`? */
export function taskOnDay(task: { startDate: string | null; dueDate: string | null }, day: string): boolean {
  const from = task.startDate ?? task.dueDate;
  const to = task.dueDate ?? task.startDate;
  return Boolean(from && to && from <= day && day <= to);
}

/** The UK calendar day a moment falls on (YYYY-MM-DD). Site visits are reported in UK time. */
export const londonDay = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(at);

/** "07:42" in UK time. */
export const londonTime = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(at);

/**
 * A week's timesheet: minutes on site per person per day (the day they checked in), and their week total.
 * Open visits count up to `now`.
 */
export function timesheet(
  visits: { workerId: string; checkedInAt: Date; checkedOutAt: Date | null }[],
  days: string[],
  now = new Date(),
): Map<string, { byDay: number[]; total: number; open: boolean }> {
  const out = new Map<string, { byDay: number[]; total: number; open: boolean }>();
  for (const v of visits) {
    const i = days.indexOf(londonDay(v.checkedInAt));
    if (i < 0) continue;
    const row = out.get(v.workerId) ?? { byDay: days.map(() => 0), total: 0, open: false };
    const m = visitMinutes(v.checkedInAt, v.checkedOutAt, now);
    row.byDay[i] += m;
    row.total += m;
    row.open ||= v.checkedOutAt === null;
    out.set(v.workerId, row);
  }
  return out;
}

/** A corrected visit can't run longer than this (a missed check-out is usually the reason for editing). */
export const MAX_VISIT_HOURS = 16;

const minuteOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Turns the office's corrected day and times (UK time) into the visit's instants. A leaving time before
 * the arrival is the next day. Refuses times in the future and visits longer than MAX_VISIT_HOURS.
 */
export function visitTimes(
  input: { day: string; start: string; end?: string },
  now = new Date(),
): { ok: true; checkedInAt: Date; checkedOutAt: Date | null } | { ok: false; reason: "future" | "too_long" } {
  const checkedInAt = londonToUtc(input.day, minuteOf(input.start));
  let checkedOutAt: Date | null = null;
  if (input.end !== undefined) {
    const endMinute = minuteOf(input.end);
    checkedOutAt = londonToUtc(endMinute < minuteOf(input.start) ? addDays(input.day, 1) : input.day, endMinute);
  }
  if (checkedInAt > now || (checkedOutAt && checkedOutAt > now)) return { ok: false, reason: "future" };
  if (checkedOutAt && checkedOutAt.getTime() - checkedInAt.getTime() > MAX_VISIT_HOURS * 3_600_000) return { ok: false, reason: "too_long" };
  return { ok: true, checkedInAt, checkedOutAt };
}

/** A link that opens a check-in location on a map. */
export const mapLink = (lat: string | number, lng: string | number) => `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
