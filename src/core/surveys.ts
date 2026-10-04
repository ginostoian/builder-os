/**
 * Online survey booking: which visit times a client can pick, worked out from each surveyor's weekly hours
 * (UK time), the visits they already have, travel time and notice. Pure functions, no database.
 */
import { addDays } from "./payment-plan";

export type SurveySettings = {
  enabled: boolean;
  visitMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  postcodes: string[];
};

export const DEFAULT_SURVEY_SETTINGS: SurveySettings = { enabled: false, visitMinutes: 60, bufferMinutes: 30, minNoticeHours: 24, maxDaysAhead: 21, postcodes: [] };

export type SurveyWindow = { memberId: string; weekday: number; startMinute: number; endMinute: number };
export type Busy = { memberId: string | null; startsAt: Date; endsAt: Date };
export type Slot = { startsAt: Date; memberId: string };

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
/** Visits start on the half hour, whatever their length. */
export const SLOT_STEP_MINUTES = 30;

const LONDON = "Europe/London";

/** Minutes London is ahead of UTC at this instant (0 in winter, 60 in summer). */
function londonOffset(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((local - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** The instant of `minute` past midnight on `day` (YYYY-MM-DD) in UK time. */
export function londonToUtc(day: string, minute: number): Date {
  const naive = Date.parse(`${day}T00:00:00Z`) + minute * 60_000;
  // Two passes settle the offset either side of a clock change.
  let at = naive - londonOffset(new Date(naive)) * 60_000;
  at = naive - londonOffset(new Date(at)) * 60_000;
  return new Date(at);
}

/** UK date (YYYY-MM-DD), minute past midnight and weekday (1 = Monday) of an instant. */
export function londonParts(at: Date): { day: string; minute: number; weekday: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const day = `${p.year}-${p.month}-${p.day}`;
  return { day, minute: Number(p.hour) * 60 + Number(p.minute), weekday: weekdayOf(day) };
}

/** 1 = Monday … 7 = Sunday. */
export const weekdayOf = (day: string) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** "LS6" from "ls6 2ab"; the whole thing if there's no space and it's short. */
export function outwardCode(postcode: string): string {
  const p = postcode.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
  if (p.includes(" ")) return p.split(/\s+/)[0];
  // No space: the inward code is always the last three characters.
  return p.length > 4 ? p.slice(0, -3) : p;
}

/**
 * Whether a postcode is in the areas a company covers. "LS" covers LS1 to LS29 (but not "L1"); "LS6"
 * covers only LS6. No areas set: everywhere. No postcode given: we can't tell, so yes.
 */
export function postcodeCovered(postcode: string | null | undefined, areas: string[]): boolean {
  if (areas.length === 0 || !postcode?.trim()) return true;
  const out = outwardCode(postcode);
  return areas.some((raw) => {
    const area = raw.toUpperCase().replace(/\s+/g, "");
    if (!area) return false;
    if (/\d/.test(area)) return out === area;
    // Letters only: an area like "LS" matches "LS6" but not "LSX" or "L6".
    return out.startsWith(area) && /^\d/.test(out.slice(area.length));
  });
}

/** Tidy a list typed by a person ("LS, bd1 ,  hx") into ["LS", "BD1", "HX"]. */
export function parsePostcodeAreas(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((a) => a.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter((a) => /^[A-Z]{1,2}(\d[A-Z\d]?)?$/.test(a)))].slice(0, 100);
}

/**
 * Times a client can book, earliest first. Each start time is offered once, given to the surveyor free then
 * with the fewest visits that day (so work spreads out). A surveyor is free when nothing of theirs overlaps
 * the visit plus travel time either side.
 */
export function availableSlots(input: { settings: SurveySettings; windows: SurveyWindow[]; busy: Busy[]; now: Date }): Slot[] {
  const { settings, windows, busy, now } = input;
  if (windows.length === 0) return [];
  const earliest = now.getTime() + settings.minNoticeHours * 3_600_000;
  const today = londonParts(now).day;
  const pad = settings.bufferMinutes * 60_000;
  const length = settings.visitMinutes * 60_000;
  const byMember = new Map<string, Busy[]>();
  for (const b of busy) if (b.memberId) byMember.set(b.memberId, [...(byMember.get(b.memberId) ?? []), b]);

  const slots: Slot[] = [];
  for (let i = 0; i <= settings.maxDaysAhead; i++) {
    const day = addDays(today, i);
    const weekday = weekdayOf(day);
    const dayStart = londonToUtc(day, 0).getTime();
    const dayEnd = londonToUtc(addDays(day, 1), 0).getTime();
    const visitsThatDay = (memberId: string) => (byMember.get(memberId) ?? []).filter((b) => b.startsAt.getTime() >= dayStart && b.startsAt.getTime() < dayEnd).length;
    const offers = new Map<number, string[]>();
    for (const w of windows.filter((x) => x.weekday === weekday)) {
      for (let m = w.startMinute; m + settings.visitMinutes <= w.endMinute; m += SLOT_STEP_MINUTES) {
        const start = londonToUtc(day, m).getTime();
        if (start < earliest) continue;
        const end = start + length;
        const clash = (byMember.get(w.memberId) ?? []).some((b) => b.startsAt.getTime() < end + pad && b.endsAt.getTime() > start - pad);
        if (!clash) offers.set(start, [...(offers.get(start) ?? []), w.memberId]);
      }
    }
    for (const [start, members] of [...offers.entries()].sort((a, b) => a[0] - b[0])) {
      const [memberId] = [...new Set(members)].sort((a, b) => visitsThatDay(a) - visitsThatDay(b) || a.localeCompare(b));
      slots.push({ startsAt: new Date(start), memberId });
    }
  }
  return slots;
}

/** "Thursday 8 October", "10:30" in UK time, computed the same on server and browser. */
export function slotLabels(at: Date): { day: string; dayShort: string; time: string; iso: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: LONDON }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { day: `${p.weekday} ${p.day} ${p.month}`, dayShort: `${String(p.weekday).slice(0, 3)} ${p.day} ${String(p.month).slice(0, 3)}`, time: `${p.hour}:${p.minute}`, iso: at.toISOString() };
}

/** "9:00" style label for a minute past midnight. */
export const minuteLabel = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/** Minutes past midnight from "09:30" (or "9:30"); null if it isn't a time. */
export function parseMinute(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

// ── Calendar file (.ics) ─────────────────────────────────────────────────────

const icsTime = (at: Date) => at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines over 75 octets, as the spec requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * A calendar invite for a booked visit. `sequence` goes up each time it moves; a cancelled one replaces the
 * event in the client's calendar when they open it.
 */
export function surveyIcs(e: { uid: string; startsAt: Date; endsAt: Date; summary: string; location?: string | null; description?: string | null; organizer: string; sequence: number; cancelled?: boolean; now?: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Builder OS//Surveys//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.sequence}`,
    `DTSTAMP:${icsTime(e.now ?? new Date())}`,
    `DTSTART:${icsTime(e.startsAt)}`,
    `DTEND:${icsTime(e.endsAt)}`,
    `SUMMARY:${icsText(e.summary)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    `ORGANIZER;CN=${icsText(e.organizer)}:mailto:noreply@builderos.app`,
    `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Google Maps directions to an address or postcode. */
export const mapsLink = (place: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
