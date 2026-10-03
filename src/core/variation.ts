/**
 * Variations: changes to an accepted quote once the job is under way (extra work, or work left out). Each
 * has its own lines priced like quote lines (cost rate + markup → the client's unit price); an "omission"
 * line is a credit. The client approves or rejects it in their portal, and approved ones are invoiced on
 * their own or added to a payment's invoice. Pure rules shared by the editor, sending and invoicing.
 */
import { applyBps, type Pence } from "./money";
import { lineCost, lineTotal, quoteRef, sellRate } from "./quote";

export const VARIATION_STATUSES = ["draft", "sent", "approved", "rejected", "withdrawn"] as const;
export type VariationStatus = (typeof VARIATION_STATUSES)[number];

/** Most lines on one variation. */
export const MAX_VARIATION_LINES = 200;

export type VariationLine = { id: string; name: string; qty: number; unit: string; ratePence: number; markupBps: number; omit: boolean };

/** "Q-0012-V2": the quote's reference plus the variation's number on that quote. */
export const variationRef = (quoteNumber: number, n: number) => `${quoteRef(quoteNumber)}-V${n}`;

/** A line's signed client price, excluding VAT: omissions are credits. */
export const variationLineTotal = (l: VariationLine): Pence => (l.omit ? -1 : 1) * lineTotal({ qty: l.qty, rate: l.ratePence, markup: l.markupBps });

/** VAT on a signed amount, rounded symmetrically so a credit is the mirror of the same charge. */
const signedVat = (net: Pence, vatBps: number): Pence => Math.sign(net) * applyBps(Math.abs(net), vatBps);

export function variationTotals(lines: VariationLine[], vatBps: number) {
  let cost = 0;
  let net = 0;
  for (const l of lines) {
    const sign = l.omit ? -1 : 1;
    cost += sign * lineCost({ qty: l.qty, rate: l.ratePence });
    net += variationLineTotal(l);
  }
  const vat = signedVat(net, vatBps);
  return { cost, net, vat, total: net + vat, margin: net === 0 ? 0 : Math.round(((net - cost) / Math.abs(net)) * 10_000) };
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
  lines: { id: string; name: string; qty: number; unit: string; unitPrice: number; total: number; omit: boolean }[];
  totals: { net: number; vat: number; total: number };
};

export function buildVariationSnapshot(input: {
  number: number;
  title: string;
  reason: string | null;
  company: VariationSnapshot["company"];
  clientName: string;
  quote: { number: number; title: string };
  vatRateBps: number;
  lines: VariationLine[];
}): VariationSnapshot {
  const totals = variationTotals(input.lines, input.vatRateBps);
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
    lines: input.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit, unitPrice: sellRate({ rate: l.ratePence, markup: l.markupBps }), total: variationLineTotal(l), omit: l.omit })),
    totals: { net: totals.net, vat: totals.vat, total: totals.total },
  };
}
