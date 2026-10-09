/**
 * Markup and margin, the two ways of describing the same profit:
 *
 * - markup is profit as a share of cost: £1,000 cost + 25% markup = £1,250
 * - margin is profit as a share of the selling price: £250 profit on £1,250 = 20% margin
 *
 * Percentages here are plain numbers (25 means 25%). Money is pence.
 */

export const markupToMargin = (markupPct: number) => (markupPct <= -100 ? NaN : (markupPct / (100 + markupPct)) * 100);
export const marginToMarkup = (marginPct: number) => (marginPct >= 100 ? Infinity : (marginPct / (100 - marginPct)) * 100);

export type PriceMode = "markup" | "margin" | "price";

export type PriceResult = { costPence: number; pricePence: number; profitPence: number; markupPct: number; marginPct: number };

/**
 * The full picture from a cost and one of: a markup %, a margin % or a selling price. Null when it can't
 * be worked out (no cost, a margin of 100% or more, or a negative price).
 */
export function priceFrom(costPence: number, mode: PriceMode, value: number): PriceResult | null {
  const cost = Math.round(costPence);
  if (!(cost > 0) || !Number.isFinite(value)) return null;
  let price: number;
  if (mode === "markup") {
    if (value <= -100) return null;
    price = Math.round(cost * (1 + value / 100));
  } else if (mode === "margin") {
    if (value >= 100) return null;
    price = Math.round(cost / (1 - value / 100));
  } else {
    price = Math.round(value);
  }
  if (!(price > 0)) return null;
  const profit = price - cost;
  return { costPence: cost, pricePence: price, profitPence: profit, markupPct: (profit / cost) * 100, marginPct: (profit / price) * 100 };
}

/**
 * The classic mistake: wanting a `pct` margin but adding `pct` as a markup. How much the price falls
 * short, and the margin actually made.
 */
export function mixUpCost(costPence: number, pct: number) {
  if (!(costPence > 0) || !(pct > 0) || pct >= 100) return null;
  const wanted = Math.round(costPence / (1 - pct / 100));
  const got = Math.round(costPence * (1 + pct / 100));
  return { wantedPricePence: wanted, chargedPricePence: got, shortfallPence: wanted - got, actualMarginPct: markupToMargin(pct) };
}

/** The common markups with their margins, for the quick reference table. */
export const REFERENCE_MARKUPS = [10, 15, 20, 25, 30, 33.33, 40, 50, 60, 75, 100];

/** "25%" or "33.3%": up to one decimal place, no trailing zero. */
export const pct = (n: number, decimals = 1) => (Number.isFinite(n) ? `${Number(n.toFixed(decimals))}%` : "n/a");
