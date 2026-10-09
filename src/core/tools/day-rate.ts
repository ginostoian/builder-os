/**
 * The day rate calculator: what to charge a day so that, after the days you can't bill and the costs of
 * running your business, you earn what you want. Includes a rough income tax and National Insurance
 * estimate for a sole trader in England, Wales or Northern Ireland (2026/27 rates; Scotland's income tax
 * bands differ).
 *
 * Money is pence; percentages are plain numbers.
 */

/** 2026/27 (frozen to April 2031): personal allowance, basic rate band, higher rate limit, Class 4 NI. */
export const TAX_2026 = {
  personalAllowance: 12_570_00,
  allowanceTaperFrom: 100_000_00,
  basicBand: 37_700_00,
  additionalFrom: 125_140_00,
  basicRate: 0.2,
  higherRate: 0.4,
  additionalRate: 0.45,
  class4Lower: 12_570_00,
  class4Upper: 50_270_00,
  class4Main: 0.06,
  class4Upper2: 0.02,
} as const;

/** Income tax and Class 4 NI on a sole trader's profit (no other income, no allowances beyond the personal allowance). */
export function soleTraderTax(profitPence: number) {
  const t = TAX_2026;
  const profit = Math.max(0, profitPence);
  const allowance = Math.max(0, t.personalAllowance - Math.max(0, Math.floor((profit - t.allowanceTaperFrom) / 2)));
  const taxable = Math.max(0, profit - allowance);
  const basic = Math.min(taxable, t.basicBand);
  const additional = Math.max(0, profit - t.additionalFrom);
  const higher = Math.max(0, taxable - basic - additional);
  const incomeTax = Math.round(basic * t.basicRate + higher * t.higherRate + additional * t.additionalRate);
  const ni = Math.round(Math.max(0, Math.min(profit, t.class4Upper) - t.class4Lower) * t.class4Main + Math.max(0, profit - t.class4Upper) * t.class4Upper2);
  return { incomeTaxPence: incomeTax, niPence: ni, takeHomePence: profit - incomeTax - ni };
}

/** The profit that leaves `takeHomePence` after tax and NI (to the penny). */
export function profitForTakeHome(takeHomePence: number): number {
  const want = Math.max(0, Math.round(takeHomePence));
  let lo = want;
  let hi = want * 3 + 100_000_00;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (soleTraderTax(mid).takeHomePence >= want) hi = mid;
    else lo = mid;
  }
  return soleTraderTax(lo).takeHomePence >= want ? lo : hi;
}

export type DayRateInput = {
  /** What you want to earn a year: before tax, or take-home after tax. */
  incomePence: number;
  basis: "before_tax" | "take_home";
  /** Business costs a year: van, tools, insurance, phone, software, accountant. */
  costsPence: number;
  daysPerWeek: number;
  holidayWeeks: number;
  bankHolidays: number;
  /** Sick days, bad weather and days between jobs. */
  lostDays: number;
  /** Unpaid days a week spent quoting, buying materials and on paperwork. */
  adminDaysPerWeek: number;
  hoursPerDay: number;
};

export type DayRateResult = {
  dayRatePence: number;
  hourlyPence: number;
  halfDayPence: number;
  weeklyPence: number;
  billableDays: number;
  workingWeeks: number;
  turnoverPence: number;
  profitPence: number;
  incomeTaxPence: number;
  niPence: number;
  takeHomePence: number;
  /** What the same income would need as a naive "salary ÷ 260 days" rate, to show the gap. */
  naiveDayRatePence: number;
};

export function dayRate(i: DayRateInput): DayRateResult | null {
  if (!(i.incomePence >= 0) || !(i.costsPence >= 0) || !(i.daysPerWeek > 0 && i.daysPerWeek <= 7)) return null;
  const workingWeeks = Math.max(0, 52 - Math.max(0, i.holidayWeeks));
  const workDays = workingWeeks * i.daysPerWeek - Math.max(0, i.bankHolidays) - Math.max(0, i.lostDays);
  const billableDays = Math.round((workDays - workingWeeks * Math.max(0, i.adminDaysPerWeek)) * 10) / 10;
  if (!(billableDays > 0)) return null;
  const profit = i.basis === "take_home" ? profitForTakeHome(i.incomePence) : Math.round(i.incomePence);
  const turnover = profit + Math.round(i.costsPence);
  const dayRatePence = Math.ceil(turnover / billableDays / 100) * 100;
  const tax = soleTraderTax(profit);
  const hours = i.hoursPerDay > 0 ? i.hoursPerDay : 8;
  return {
    dayRatePence,
    hourlyPence: Math.ceil(dayRatePence / hours / 10) * 10,
    halfDayPence: Math.ceil(dayRatePence / 2 / 100) * 100,
    weeklyPence: dayRatePence * Math.min(5, i.daysPerWeek),
    billableDays,
    workingWeeks,
    turnoverPence: turnover,
    profitPence: profit,
    incomeTaxPence: tax.incomeTaxPence,
    niPence: tax.niPence,
    takeHomePence: tax.takeHomePence,
    naiveDayRatePence: Math.round(profit / 260 / 100) * 100,
  };
}
