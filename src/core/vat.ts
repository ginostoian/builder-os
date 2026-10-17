/**
 * How VAT is handled on a job. Most work is "standard": the builder charges VAT and pays it to HMRC. Under
 * the construction domestic reverse charge (since 1 March 2021), work for a VAT and CIS registered business
 * that isn't the end user is "reverse_charge": the invoice shows the VAT but doesn't charge it, and the
 * customer accounts for it to HMRC instead. Quotes, variations and invoices all follow their quote's treatment.
 */
import { applyBps, type Bps, type Pence } from "./money";
import { DRC_WORDING } from "./tools/reverse-charge";

export const VAT_TREATMENTS = ["standard", "reverse_charge"] as const;
export type VatTreatment = (typeof VAT_TREATMENTS)[number];

/** The wording HMRC expects on a reverse charge invoice. */
export const REVERSE_CHARGE_WORDING = DRC_WORDING;

export const isReverseCharge = (t: VatTreatment | null | undefined) => t === "reverse_charge";

/** The VAT rate actually charged: none under the reverse charge. */
export const chargedVatBps = (rate: Bps, t: VatTreatment | null | undefined): Bps => (isReverseCharge(t) ? 0 : rate);

/** VAT on a net amount, split into what's charged and what the customer accounts for under the reverse charge. */
export function vatFor(net: Pence, rate: Bps, t: VatTreatment | null | undefined): { vat: Pence; reverseChargeVat: Pence } {
  const v = Math.sign(net) * applyBps(Math.abs(net), rate);
  return isReverseCharge(t) ? { vat: 0, reverseChargeVat: v } : { vat: v, reverseChargeVat: 0 };
}

/** Why a reverse charge quote can't be sent yet, or null when it's fine. */
export function reverseChargeProblem(t: VatTreatment | null | undefined, rate: Bps, companyVatNumber: string | null | undefined): string | null {
  if (!isReverseCharge(t)) return null;
  if (rate <= 0) return "The reverse charge needs a VAT rate. Choose 20% or 5%.";
  if (!companyVatNumber?.trim()) return "Add your VAT number in Settings first: a reverse charge invoice must show it.";
  return null;
}

/** "inc. VAT", or under the reverse charge (where the total has no VAT in it) "plus reverse charge VAT". */
export const vatLabel = (t: VatTreatment | null | undefined) => (isReverseCharge(t) ? "ex. VAT (reverse charge)" : "inc. VAT");
