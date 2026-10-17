import { formatGBP } from "@/core/money";
import { REVERSE_CHARGE_WORDING, type VatTreatment } from "@/core/vat";

const rate = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;

/**
 * The VAT line under a document's subtotal. Under the reverse charge it shows the VAT the client pays to
 * HMRC (not charged, so not in the total) and the wording HMRC expects on the invoice.
 */
export function VatRow({ rateBps, vat, treatment, reverseChargeVat }: { rateBps: number; vat: number; treatment?: VatTreatment; reverseChargeVat?: number }) {
  if (treatment !== "reverse_charge") {
    return (
      <div className="flex justify-between text-ink-2">
        <span>VAT {rate(rateBps)}</span>
        <span>{formatGBP(vat)}</span>
      </div>
    );
  }
  return (
    <>
      <div className="flex justify-between text-ink-2">
        <span>VAT {rate(rateBps)}, reverse charge</span>
        <span>{formatGBP(reverseChargeVat ?? 0)} not charged</span>
      </div>
      <p className="my-1 rounded-md bg-muted px-2.5 py-1.5 text-[12.5px] font-medium text-ink">{REVERSE_CHARGE_WORDING}. VAT Act 1994 Section 55A.</p>
    </>
  );
}
