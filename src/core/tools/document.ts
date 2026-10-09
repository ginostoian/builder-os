/**
 * Totals for the free quote and invoice templates: line totals, VAT (standard, reduced, none or the
 * domestic reverse charge) and, on invoices from subcontractors, the CIS deduction on labour.
 * Money is pence.
 */
import { DRC_WORDING } from "./reverse-charge";

export type DocVat = "standard" | "reduced" | "none" | "reverse_charge";
export type LineKind = "labour" | "materials" | "other";
export type DocLine = { description: string; quantity: number; ratePence: number; kind: LineKind };

export const VAT_LABEL: Record<DocVat, string> = {
  standard: "VAT at 20%",
  reduced: "VAT at 5%",
  none: "No VAT",
  reverse_charge: "Reverse charge",
};

export type DocTotals = {
  lineTotals: number[];
  netPence: number;
  vatRateBps: number;
  vatPence: number;
  /** VAT shown on a reverse charge invoice but not charged. */
  reverseChargeVatPence: number;
  totalPence: number;
  labourPence: number;
  cisRateBps: number;
  cisDeductionPence: number;
  /** What the customer pays: the total, less any CIS deduction. */
  amountDuePence: number;
  /** Words the document must carry, if any. */
  vatNote: string | null;
};

export function docTotals(lines: DocLine[], vat: DocVat, cisRateBps = 0): DocTotals {
  const lineTotals = lines.map((l) => (Number.isFinite(l.quantity) && Number.isFinite(l.ratePence) ? Math.round(l.quantity * l.ratePence) : 0));
  const net = lineTotals.reduce((a, b) => a + b, 0);
  const rate = vat === "standard" ? 2000 : vat === "reduced" ? 500 : 0;
  const reverseRate = vat === "reverse_charge" ? 2000 : 0;
  const vatPence = Math.round((net * rate) / 10_000);
  const reverseChargeVatPence = Math.round((net * reverseRate) / 10_000);
  const total = net + vatPence;
  // CIS is taken from labour only, before VAT, rounded down to the penny.
  const labour = lines.reduce((a, l, i) => a + (l.kind === "labour" ? Math.max(0, lineTotals[i]!) : 0), 0);
  const cis = Math.floor((labour * Math.max(0, cisRateBps)) / 10_000);
  return {
    lineTotals,
    netPence: net,
    vatRateBps: rate,
    vatPence,
    reverseChargeVatPence,
    totalPence: total,
    labourPence: labour,
    cisRateBps,
    cisDeductionPence: cis,
    amountDuePence: total - cis,
    vatNote: vat === "reverse_charge" ? `${DRC_WORDING}. VAT at 20%: ${(reverseChargeVatPence / 100).toFixed(2)}.` : null,
  };
}
