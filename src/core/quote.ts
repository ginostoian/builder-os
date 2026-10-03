import { applyBps, type Bps, type Pence } from "./money";

export type QuoteLine = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  rate: Pence;
  markup: Bps;
  note?: string;
  attachment?: string;
};

export type QuoteSection = {
  id: string;
  name: string;
  lines: QuoteLine[];
};

export type PaymentStage = { label: string; share: Bps };

/** Cost of a line before markup. */
export function lineCost(line: Pick<QuoteLine, "qty" | "rate">): Pence {
  return Math.round(line.qty * line.rate);
}

/**
 * The client's unit price: rate plus markup, rounded to the penny. Integer maths, so 1450 × 1.15 is exact.
 * Rounding the unit price first means quantity × the unit price a client sees always equals the line total.
 */
export function sellRate(line: Pick<QuoteLine, "rate" | "markup">): Pence {
  return Math.round((line.rate * (10_000 + line.markup)) / 10_000);
}

/** Line total = round(qty × sellRate), excluding VAT. */
export function lineTotal(line: Pick<QuoteLine, "qty" | "rate" | "markup">): Pence {
  return Math.round(line.qty * sellRate(line));
}

export function sectionTotal(section: QuoteSection): Pence {
  return section.lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export type QuoteTotals = {
  cost: Pence;
  markup: Pence;
  net: Pence;
  vat: Pence;
  total: Pence;
  /** Gross margin as basis points of the net price. */
  margin: Bps;
};

export function quoteTotals(sections: QuoteSection[], vatRate: Bps): QuoteTotals {
  let cost = 0;
  let net = 0;
  for (const s of sections) {
    for (const l of s.lines) {
      cost += lineCost(l);
      net += lineTotal(l);
    }
  }
  const vat = applyBps(net, vatRate);
  return {
    cost,
    markup: net - cost,
    net,
    vat,
    total: net + vat,
    margin: net === 0 ? 0 : Math.round(((net - cost) / net) * 10_000),
  };
}

/** Split a total across payment stages; the last stage absorbs rounding so stages always sum to the total. */
export function stageAmounts(total: Pence, stages: PaymentStage[]): Pence[] {
  let allocated = 0;
  return stages.map((s, i) => {
    if (i === stages.length - 1) return total - allocated;
    const amount = applyBps(total, s.share);
    allocated += amount;
    return amount;
  });
}

/** Display reference for a quote number: 7 → "Q-0007". */
export const quoteRef = (n: number) => `Q-${String(n).padStart(4, "0")}`;

/** Move `id` to `position` within `ids` (clamped), returning the new order. Adds it if it wasn't there. */
export function placeAt(ids: readonly string[], id: string, position: number): string[] {
  const rest = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(position, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
