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

/** Line total = round(qty × rate × (1 + markup)), excluding VAT. */
export function lineTotal(line: Pick<QuoteLine, "qty" | "rate" | "markup">): Pence {
  return Math.round(line.qty * line.rate * (1 + line.markup / 10_000));
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
