/**
 * The free CIS deduction calculator on the website. Same rule as the app (see core/cis.ts): the deduction
 * is the rate times the labour part of a payment (before VAT, less materials), rounded down to the penny.
 */
import { CIS_RATE_BPS, cisDeduction, taxMonth, type CisStatus } from "@/core/cis";

/**
 * How VAT works on the subcontractor's invoice:
 * - none: the subcontractor isn't VAT registered
 * - reverse_charge: VAT registered, and the domestic reverse charge applies (the usual case between
 *   VAT-registered builders): the contractor accounts for the VAT, the subcontractor isn't paid it
 * - standard: VAT registered and charging VAT normally (for example, the contractor is an end user)
 */
export type CisVat = "none" | "reverse_charge" | "standard";

export type CisCalcInput = { labourPence: number; materialsPence: number; status: CisStatus; vat: CisVat; vatRateBps?: number; paidOn?: string };

export type CisCalcResult = {
  rateBps: number;
  /** Labour plus materials, before VAT. */
  grossPence: number;
  /** The part the deduction is taken from. */
  labourPence: number;
  materialsPence: number;
  deductionPence: number;
  /** VAT the subcontractor charges and is paid (standard VAT only). */
  vatPence: number;
  /** VAT the contractor accounts for to HMRC instead of paying it (reverse charge only). */
  reverseChargeVatPence: number;
  /** What the invoice totals: gross, plus VAT when it's charged normally. */
  invoiceTotalPence: number;
  /** What the contractor actually pays the subcontractor. */
  paymentPence: number;
  /** The tax month the payment falls in, and when the return and payment are due. */
  taxMonth: ReturnType<typeof taxMonth> | null;
};

export function cisCalc(i: CisCalcInput): CisCalcResult {
  const labourPence = Math.max(0, Math.round(i.labourPence));
  const materialsPence = Math.max(0, Math.round(i.materialsPence));
  const grossPence = labourPence + materialsPence;
  const rateBps = CIS_RATE_BPS[i.status];
  const deductionPence = cisDeduction(grossPence, materialsPence, rateBps);
  const vatRate = i.vatRateBps ?? 2000;
  const vatOnGross = Math.round((grossPence * vatRate) / 10_000);
  const vatPence = i.vat === "standard" ? vatOnGross : 0;
  const reverseChargeVatPence = i.vat === "reverse_charge" ? vatOnGross : 0;
  const invoiceTotalPence = grossPence + vatPence;
  return {
    rateBps,
    grossPence,
    labourPence,
    materialsPence,
    deductionPence,
    vatPence,
    reverseChargeVatPence,
    invoiceTotalPence,
    paymentPence: invoiceTotalPence - deductionPence,
    taxMonth: i.paidOn && /^\d{4}-\d{2}-\d{2}$/.test(i.paidOn) ? taxMonth(i.paidOn) : null,
  };
}

/**
 * Working backwards: the labour charge that leaves the subcontractor at least `netPence` after the
 * deduction (net ÷ (1 − rate), rounded up to the penny).
 */
export function labourForNet(netPence: number, status: CisStatus): number {
  const rate = CIS_RATE_BPS[status];
  const net = Math.max(0, Math.round(netPence));
  if (rate === 0) return net;
  return Math.ceil((net * 10_000) / (10_000 - rate));
}
