/**
 * The revenue and profit target calculator: from the profit you want and what it costs to run the
 * business, the turnover it takes, and what that means in jobs and quotes. Or the other way: from a
 * turnover, the profit it leaves.
 *
 * - Gross margin: what's left of each job's price after its direct costs (materials, labour and
 *   subcontractors on that job). It pays for overheads, then profit.
 * - Overheads: what the business costs to run whatever the jobs (van, insurance, office, software,
 *   accountant, your salary if you take one).
 * - Turnover needed = (profit + overheads) ÷ gross margin. Break-even = overheads ÷ gross margin.
 *
 * Money is pence (before VAT); percentages are plain numbers (25 means 25%).
 */

/** The VAT registration threshold: taxable turnover over the last 12 months (from 1 April 2024). */
export const VAT_THRESHOLD_PENCE = 90_000_00;

export type ProfitInputs = {
  /** The profit you want a year, before tax. */
  profitPence: number;
  /** Overheads a year. */
  overheadsPence: number;
  /** Gross margin on jobs, %. */
  marginPct: number;
  /** Average job value, before VAT. */
  averageJobPence: number;
  /** Share of quotes that become jobs, %. */
  winRatePct: number;
  /** Weeks a year you're working. */
  weeks: number;
};

export type ProfitPlan = {
  turnoverPence: number;
  grossProfitPence: number;
  directCostsPence: number;
  overheadsPence: number;
  profitPence: number;
  breakEvenPence: number;
  /** Profit as a share of turnover (net margin), %. */
  netMarginPct: number;
  perMonthPence: number;
  perWeekPence: number;
  jobsPerYear: number;
  jobsPerMonth: number;
  quotesPerYear: number;
  quotesPerMonth: number;
  quotesPerWeek: number;
  overVatThreshold: boolean;
};

const valid = (i: Pick<ProfitInputs, "marginPct">) => i.marginPct > 0 && i.marginPct < 100;

function plan(i: ProfitInputs, turnover: number, profit: number): ProfitPlan {
  const m = i.marginPct / 100;
  const grossProfit = Math.round(turnover * m);
  const jobsPerYear = i.averageJobPence > 0 ? Math.ceil(turnover / i.averageJobPence) : 0;
  const quotesPerYear = i.winRatePct > 0 ? Math.ceil(jobsPerYear / (Math.min(i.winRatePct, 100) / 100)) : 0;
  const weeks = Math.min(52, Math.max(1, Math.round(i.weeks) || 1));
  return {
    turnoverPence: turnover,
    grossProfitPence: grossProfit,
    directCostsPence: turnover - grossProfit,
    overheadsPence: i.overheadsPence,
    profitPence: profit,
    breakEvenPence: Math.ceil(i.overheadsPence / m),
    netMarginPct: turnover > 0 ? (profit / turnover) * 100 : 0,
    perMonthPence: Math.round(turnover / 12),
    perWeekPence: Math.round(turnover / weeks),
    jobsPerYear,
    jobsPerMonth: jobsPerYear / 12,
    quotesPerYear,
    quotesPerMonth: quotesPerYear / 12,
    quotesPerWeek: quotesPerYear / weeks,
    overVatThreshold: turnover > VAT_THRESHOLD_PENCE,
  };
}

/** The turnover it takes to make the profit you want. Rounded up to the pound. */
export function turnoverForProfit(i: ProfitInputs): ProfitPlan | null {
  if (!valid(i) || i.profitPence < 0 || i.overheadsPence < 0) return null;
  const turnover = Math.ceil((i.profitPence + i.overheadsPence) / (i.marginPct / 100) / 100) * 100;
  return plan(i, turnover, i.profitPence);
}

/** The profit a turnover leaves (negative is a loss). */
export function profitForTurnover(i: Omit<ProfitInputs, "profitPence">, turnoverPence: number): ProfitPlan | null {
  if (!valid(i) || i.overheadsPence < 0 || turnoverPence < 0) return null;
  const turnover = Math.round(turnoverPence);
  const profit = Math.round(turnover * (i.marginPct / 100)) - i.overheadsPence;
  return plan({ ...i, profitPence: profit }, turnover, profit);
}

/** The turnover needed at a few margins around yours: what each point of margin is worth. */
export function marginSensitivity(i: ProfitInputs, steps = [-10, -5, 0, 5, 10]) {
  return steps
    .map((d) => i.marginPct + d)
    .filter((m) => m > 0 && m < 100)
    .map((m) => ({ marginPct: m, current: m === i.marginPct, plan: turnoverForProfit({ ...i, marginPct: m })! }));
}

/** Overhead lines most building firms have, for the breakdown helper (yearly, pence). */
export const OVERHEAD_SUGGESTIONS: { label: string; pence: number }[] = [
  { label: "Van(s): finance, fuel, insurance, servicing", pence: 9_000_00 },
  { label: "Insurance: public liability, tools, contract works", pence: 1_800_00 },
  { label: "Office, yard or storage", pence: 3_000_00 },
  { label: "Accountant and bookkeeping", pence: 1_800_00 },
  { label: "Phone, software and subscriptions", pence: 1_200_00 },
  { label: "Marketing and website", pence: 1_500_00 },
  { label: "Tools and equipment", pence: 2_000_00 },
  { label: "Your salary (if you pay yourself one)", pence: 0 },
];
