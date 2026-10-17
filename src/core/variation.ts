/**
 * Variations: changes to an accepted quote once the job is under way (extra work, or work left out). Each
 * has its own lines priced like quote lines (cost rate + markup → the client's unit price); an "omission"
 * line is a credit. The client approves or rejects it in their portal, and approved ones are invoiced on
 * their own or added to a payment's invoice. Pure rules shared by the editor, sending and invoicing.
 */
import type { Pence } from "./money";
import { lineCost, lineTotal, quoteRef, sellRate } from "./quote";
import { vatFor, type VatTreatment } from "./vat";

export const VARIATION_STATUSES = ["draft", "sent", "approved", "rejected", "withdrawn"] as const;
export type VariationStatus = (typeof VARIATION_STATUSES)[number];

/** Most lines on one variation. */
export const MAX_VARIATION_LINES = 200;

/** Most photos on one variation. */
export const MAX_VARIATION_PHOTOS = 12;

/** A photo on a draft: its storage key (the URL is built from it when shown or sent). */
export type VariationPhoto = { key: string };

export type VariationLine = { id: string; name: string; qty: number; unit: string; ratePence: number; markupBps: number; omit: boolean };

/** "Q-0012-V2": the quote's reference plus the variation's number on that quote. */
export const variationRef = (quoteNumber: number, n: number) => `${quoteRef(quoteNumber)}-V${n}`;

/** A line's signed client price, excluding VAT: omissions are credits. */
export const variationLineTotal = (l: VariationLine): Pence => (l.omit ? -1 : 1) * lineTotal({ qty: l.qty, rate: l.ratePence, markup: l.markupBps });

/** VAT is rounded symmetrically on a signed amount, so a credit is the mirror of the same charge. */
export function variationTotals(lines: VariationLine[], vatBps: number, treatment: VatTreatment = "standard") {
  let cost = 0;
  let net = 0;
  for (const l of lines) {
    const sign = l.omit ? -1 : 1;
    cost += sign * lineCost({ qty: l.qty, rate: l.ratePence });
    net += variationLineTotal(l);
  }
  const { vat, reverseChargeVat } = vatFor(net, vatBps, treatment);
  return { cost, net, vat, reverseChargeVat, total: net + vat, margin: net === 0 ? 0 : Math.round(((net - cost) / Math.abs(net)) * 10_000) };
}

/** What the client sees and signs: selling prices only, frozen when it's sent. */
export type VariationSnapshot = {
  v: 1;
  ref: string;
  number: number;
  title: string;
  reason: string | null;
  company: { name: string; tradingName: string | null; vatNumber: string | null; logoUrl: string | null; brandColour: string | null };
  client: { name: string };
  quote: { number: number; ref: string; title: string };
  vatRateBps: number;
  /** Older snapshots have none: standard. */
  vatTreatment?: VatTreatment;
  lines: { id: string; name: string; qty: number; unit: string; unitPrice: number; total: number; omit: boolean }[];
  /** reverseChargeVat: the VAT the customer pays to HMRC under the reverse charge (not charged). */
  totals: { net: number; vat: number; total: number; reverseChargeVat?: number };
  /** Site photos, as public URLs (random, unguessable names). Older snapshots have none. */
  photos?: { url: string }[];
};

export function buildVariationSnapshot(input: {
  number: number;
  title: string;
  reason: string | null;
  company: VariationSnapshot["company"];
  clientName: string;
  quote: { number: number; title: string };
  vatRateBps: number;
  vatTreatment?: VatTreatment;
  lines: VariationLine[];
  photoUrls?: string[];
}): VariationSnapshot {
  const treatment = input.vatTreatment ?? "standard";
  const totals = variationTotals(input.lines, input.vatRateBps, treatment);
  return {
    v: 1,
    ref: variationRef(input.quote.number, input.number),
    number: input.number,
    title: input.title,
    reason: input.reason,
    company: input.company,
    client: { name: input.clientName },
    quote: { number: input.quote.number, ref: quoteRef(input.quote.number), title: input.quote.title },
    vatRateBps: input.vatRateBps,
    ...(treatment === "reverse_charge" ? { vatTreatment: treatment } : {}),
    lines: input.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit, unitPrice: sellRate({ rate: l.ratePence, markup: l.markupBps }), total: variationLineTotal(l), omit: l.omit })),
    totals: { net: totals.net, vat: totals.vat, total: totals.total, ...(totals.reverseChargeVat ? { reverseChargeVat: totals.reverseChargeVat } : {}) },
    photos: (input.photoUrls ?? []).map((url) => ({ url })),
  };
}
