/**
 * Statutory interest and compensation under the Late Payment of Commercial Debts (Interest) Act 1998, for
 * invoices to other businesses (not homeowners):
 *
 * - Interest is simple, at 8% a year over the Bank of England's reference rate. The reference rate is
 *   the base rate on 31 December (for debts that become late from January to June) or 30 June (from July
 *   to December), and it stays fixed for that debt.
 * - It runs from the day after the agreed due date, or 30 days after the invoice if none was agreed.
 * - A fixed sum per invoice: £40 under £1,000, £70 under £10,000, £100 from £10,000.
 *
 * Money is pence.
 */
import { addDaysIso, daysBetween } from "./dates";

/** Bank of England base rate on each reference date. Add a row each January and July. */
export const REFERENCE_RATES: { from: string; ratePct: number; setOn: string }[] = [
  { from: "2024-01-01", ratePct: 5.25, setOn: "31 December 2023" },
  { from: "2024-07-01", ratePct: 5.25, setOn: "30 June 2024" },
  { from: "2025-01-01", ratePct: 4.75, setOn: "31 December 2024" },
  { from: "2025-07-01", ratePct: 4.25, setOn: "30 June 2025" },
  { from: "2026-01-01", ratePct: 3.75, setOn: "31 December 2025" },
  { from: "2026-07-01", ratePct: 3.75, setOn: "30 June 2026" },
];

export const STATUTORY_MARGIN_PCT = 8;

/** The reference rate for a debt that became late on `day`, and whether it's the latest one we know. */
export function referenceRateFor(day: string): { ratePct: number; setOn: string; estimated: boolean } {
  const rows = REFERENCE_RATES.filter((r) => r.from <= day);
  const row = rows[rows.length - 1] ?? REFERENCE_RATES[0]!;
  const last = REFERENCE_RATES[REFERENCE_RATES.length - 1]!;
  // Beyond the last period we know, the rate may have changed: say so.
  const estimated = rows.length === 0 || (row === last && daysBetween(last.from, day) >= 183);
  return { ratePct: row.ratePct, setOn: row.setOn, estimated };
}

export const fixedCompensation = (amountPence: number) => (amountPence < 1_000_00 ? 40_00 : amountPence < 10_000_00 ? 70_00 : 100_00);

export type LateInvoice = { amountPence: number; invoiceDate: string; termsDays: number };

export type LateInvoiceResult = {
  dueDate: string;
  daysLate: number;
  ratePct: number;
  rateSetOn: string;
  rateEstimated: boolean;
  dailyInterestPence: number;
  interestPence: number;
  compensationPence: number;
  totalClaimPence: number;
};

/** What you can claim on one invoice, as of `today` (or the day it was paid). */
export function lateInvoice(inv: LateInvoice, today: string): LateInvoiceResult | null {
  if (!(inv.amountPence > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(inv.invoiceDate)) return null;
  // No agreed terms: 30 days. Contract terms over 60 days are often unfair, but we use what's typed.
  const terms = Number.isFinite(inv.termsDays) && inv.termsDays >= 0 ? Math.round(inv.termsDays) : 30;
  const dueDate = addDaysIso(inv.invoiceDate, terms);
  const daysLate = Math.max(0, daysBetween(dueDate, today));
  const ref = referenceRateFor(addDaysIso(dueDate, 1));
  const ratePct = ref.ratePct + STATUTORY_MARGIN_PCT;
  const daily = (inv.amountPence * ratePct) / 100 / 365;
  const interestPence = Math.round(daily * daysLate);
  const compensationPence = daysLate > 0 ? fixedCompensation(inv.amountPence) : 0;
  return {
    dueDate,
    daysLate,
    ratePct,
    rateSetOn: ref.setOn,
    rateEstimated: ref.estimated,
    dailyInterestPence: Math.round(daily),
    interestPence,
    compensationPence,
    totalClaimPence: interestPence + compensationPence,
  };
}
