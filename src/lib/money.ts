/**
 * Money rules (Technical Implementation Plan §4): money is integer pence,
 * percentages are basis points, and every total is computed here, never ad hoc in the UI.
 */

export type Pence = number;
export type Bps = number;

const gbp = (decimals: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const GBP0 = gbp(0);
const GBP2 = gbp(2);
const NUM2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** £34,851.47 (decimals = 2) or £34,851 (decimals = 0). */
export function formatGBP(pence: Pence, decimals: 0 | 2 = 2): string {
  return (decimals === 2 ? GBP2 : GBP0).format(pence / 100);
}

/** 1,850.00, used for rate cells where the £ sign lives in the column header. */
export function formatRate(pence: Pence): string {
  return NUM2.format(pence / 100);
}

/** 20% / 12.5% */
export function formatBps(bps: Bps): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/** Parse "1,850.00" or "£1850" into pence. Returns null for anything that isn't a number. */
export function parsePence(input: string): Pence | null {
  const n = Number(input.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Percentage of an amount, rounded to the nearest penny. */
export function applyBps(amount: Pence, bps: Bps): Pence {
  return Math.round((amount * bps) / 10_000);
}
