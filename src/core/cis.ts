/**
 * The Construction Industry Scheme (CIS), for companies that pay subcontractors. Optional: a company turns
 * it on in settings. When it's on, a payment to a subcontractor records how much was for materials, and
 * the deduction is worked out from their verified status:
 *
 * - gross: paid in full, no deduction
 * - standard: registered with HMRC, 20% off the labour part
 * - higher: not registered (or not verified), 30% off the labour part
 *
 * The labour part is the payment before VAT, less materials. Deductions are rounded down to the penny.
 * Tax months run from the 6th of one month to the 5th of the next; the monthly return (CIS300) is due by
 * the 19th after the tax month ends.
 */
import { addDays } from "./payment-plan";

export const CIS_STATUSES = ["gross", "standard", "higher"] as const;
export type CisStatus = (typeof CIS_STATUSES)[number];

export const CIS_RATE_BPS: Record<CisStatus, number> = { gross: 0, standard: 2000, higher: 3000 };

export const CIS_STATUS_LABEL: Record<CisStatus, string> = {
  gross: "Gross (0%)",
  standard: "Registered (20%)",
  higher: "Not registered (30%)",
};

/** A Unique Taxpayer Reference: 10 digits (spaces allowed when typed). */
export const isUtr = (s: string) => /^\d{10}$/.test(s.replace(/\s+/g, ""));
export const normaliseUtr = (s: string) => s.replace(/\s+/g, "");

/** HMRC's verification reference, e.g. V1234567890 or V1234567890/AB for the higher rate. */
export const isVerificationRef = (s: string) => /^V\d{10}(\/?[A-Z]{1,2})?$/i.test(s.trim());

/** The deduction on a payment: rate × (amount before VAT − materials), rounded down to the penny. */
export function cisDeduction(netPence: number, materialsPence: number, rateBps: number): number {
  const labour = Math.max(0, netPence - Math.min(materialsPence, netPence));
  return Math.floor((labour * rateBps) / 10_000);
}

/** The tax month a day falls in: the 6th of one month up to the 5th of the next. */
export function taxMonth(day: string): { start: string; end: string; label: string; dueBy: string } {
  const [y, m, d] = day.split("-").map(Number);
  // Days 1–5 belong to the tax month that started on the 6th of the previous month.
  const startMonth = d >= 6 ? new Date(Date.UTC(y, m - 1, 6)) : new Date(Date.UTC(y, m - 2, 6));
  const start = startMonth.toISOString().slice(0, 10);
  const nextStart = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + 1, 6)).toISOString().slice(0, 10);
  const end = addDays(nextStart, -1);
  const dueBy = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + 1, 19)).toISOString().slice(0, 10);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  return { start, end, dueBy, label: `${fmt(start)} – ${fmt(end)} ${end.slice(0, 4)}` };
}

/** Totals for one subcontractor in a tax month, as they go on the monthly return. */
export type CisLine = { workerId: string; name: string; utr: string | null; status: CisStatus | null; verificationRef: string | null; grossPence: number; materialsPence: number; deductionPence: number; payments: number };
