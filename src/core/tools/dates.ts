/** Calendar days as ISO strings (YYYY-MM-DD), in UTC so daylight saving never shifts a day. */

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const isIsoDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toMs(s));

export const addDaysIso = (iso: string, days: number) => new Date(toMs(iso) + days * 86_400_000).toISOString().slice(0, 10);

/** Whole days from `a` to `b` (negative if `b` is earlier). */
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / 86_400_000);

/** The same day `n` months later, kept inside the month (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonthsIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

export const longDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
