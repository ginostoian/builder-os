import { describe, expect, it } from "vitest";
import { addMonthsIso, daysBetween } from "./dates";
import { dayRate, profitForTakeHome, soleTraderTax } from "./day-rate";
import { fixedCompensation, lateInvoice, referenceRateFor } from "./late-payment";
import { retentionForJob, retentionForYear } from "./retention";

describe("dates", () => {
  it("adds months without spilling into the next month", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-10-09", 12)).toBe("2027-10-09");
    expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59);
  });
});

describe("retention", () => {
  const job = { contractPence: 200_000_00, retentionPct: 5, firstReleasePct: 50, buildMonths: 6, defectsMonths: 12, delayDays: 30, borrowingPct: 8, completion: "2027-03-31" };

  it("splits the retention and dates the releases", () => {
    const r = retentionForJob(job)!;
    expect(r.retentionPence).toBe(10_000_00);
    expect(r.firstReleasePence).toBe(5_000_00);
    expect(r.secondReleasePence).toBe(5_000_00);
    expect(r.firstReleaseDate).toBe("2027-04-30");
    expect(r.secondReleaseDate).toBe("2028-04-30");
    expect(r.firstHeldDays).toBe(Math.round(3 * (365 / 12) + 30));
    expect(r.secondHeldDays).toBe(Math.round(15 * (365 / 12) + 30));
  });

  it("costs the money held at the borrowing rate", () => {
    const r = retentionForJob(job)!;
    const expected = Math.round((5_000_00 * 0.08 * r.firstHeldDays) / 365 + (5_000_00 * 0.08 * r.secondHeldDays) / 365);
    expect(r.costPence).toBe(expected);
    expect(retentionForJob({ ...job, borrowingPct: 0 })!.costPence).toBe(0);
  });

  it("refuses nonsense", () => {
    expect(retentionForJob({ ...job, contractPence: 0 })).toBeNull();
    expect(retentionForJob({ ...job, retentionPct: 101 })).toBeNull();
  });

  it("averages what a year of work keeps held", () => {
    const y = retentionForYear(1_000_000_00, job)!;
    expect(y.heldEachYearPence).toBe(50_000_00);
    // Half held ~4 months, half ~16 months: about £41,000 tied up on average.
    expect(y.averageHeldPence).toBeGreaterThan(40_000_00);
    expect(y.averageHeldPence).toBeLessThan(42_000_00);
    expect(y.yearlyCostPence).toBe(Math.round(y.averageHeldPence * 0.08));
  });
});

describe("late payment interest", () => {
  it("uses the reference rate for the half-year the debt became late", () => {
    expect(referenceRateFor("2026-03-01").ratePct).toBe(3.75);
    expect(referenceRateFor("2025-08-01").ratePct).toBe(4.25);
    expect(referenceRateFor("2025-02-01").ratePct).toBe(4.75);
    expect(referenceRateFor("2026-08-01").estimated).toBe(false);
    expect(referenceRateFor("2027-03-01").estimated).toBe(true);
  });

  it("adds fixed compensation by size", () => {
    expect(fixedCompensation(999_99)).toBe(40_00);
    expect(fixedCompensation(1_000_00)).toBe(70_00);
    expect(fixedCompensation(9_999_99)).toBe(70_00);
    expect(fixedCompensation(10_000_00)).toBe(100_00);
  });

  it("works out simple daily interest from the due date", () => {
    const r = lateInvoice({ amountPence: 10_000_00, invoiceDate: "2026-07-01", termsDays: 30 }, "2026-09-30")!;
    expect(r.dueDate).toBe("2026-07-31");
    expect(r.daysLate).toBe(61);
    expect(r.ratePct).toBe(11.75);
    expect(r.interestPence).toBe(Math.round(((10_000_00 * 11.75) / 100 / 365) * 61));
    expect(r.compensationPence).toBe(100_00);
    expect(r.totalClaimPence).toBe(r.interestPence + 100_00);
  });

  it("claims nothing before the due date", () => {
    const r = lateInvoice({ amountPence: 500_00, invoiceDate: "2026-09-20", termsDays: 30 }, "2026-10-01")!;
    expect(r.daysLate).toBe(0);
    expect(r.totalClaimPence).toBe(0);
    expect(lateInvoice({ amountPence: 0, invoiceDate: "2026-09-20", termsDays: 30 }, "2026-10-01")).toBeNull();
  });
});

describe("day rate", () => {
  it("taxes a sole trader at 2026/27 rates", () => {
    expect(soleTraderTax(12_570_00)).toEqual({ incomeTaxPence: 0, niPence: 0, takeHomePence: 12_570_00 });
    const t = soleTraderTax(50_270_00);
    expect(t.incomeTaxPence).toBe(7_540_00);
    expect(t.niPence).toBe(2_262_00);
    const high = soleTraderTax(60_000_00);
    expect(high.incomeTaxPence).toBe(7_540_00 + Math.round(9_730_00 * 0.4));
    expect(high.niPence).toBe(2_262_00 + Math.round(9_730_00 * 0.02));
    // The allowance is gone by £125,140.
    expect(soleTraderTax(125_140_00).incomeTaxPence).toBe(Math.round(37_700_00 * 0.2 + (125_140_00 - 37_700_00) * 0.4));
  });

  it("finds the profit for a take-home", () => {
    for (const want of [10_000_00, 40_000_00, 75_000_00]) {
      const p = profitForTakeHome(want);
      expect(soleTraderTax(p).takeHomePence).toBeGreaterThanOrEqual(want);
      expect(soleTraderTax(p - 1).takeHomePence).toBeLessThan(want);
    }
  });

  it("spreads income and costs over the days you can bill", () => {
    const r = dayRate({ incomePence: 45_000_00, basis: "before_tax", costsPence: 15_000_00, daysPerWeek: 5, holidayWeeks: 4, bankHolidays: 8, lostDays: 10, adminDaysPerWeek: 0.5, hoursPerDay: 8 })!;
    expect(r.workingWeeks).toBe(48);
    expect(r.billableDays).toBe(48 * 5 - 8 - 10 - 24);
    expect(r.turnoverPence).toBe(60_000_00);
    expect(r.dayRatePence).toBe(Math.ceil(60_000_00 / 198 / 100) * 100);
    expect(r.dayRatePence % 100).toBe(0);
    expect(r.naiveDayRatePence).toBeLessThan(r.dayRatePence);
    expect(dayRate({ incomePence: 1, basis: "before_tax", costsPence: 0, daysPerWeek: 5, holidayWeeks: 52, bankHolidays: 0, lostDays: 0, adminDaysPerWeek: 0, hoursPerDay: 8 })).toBeNull();
  });
});

import { docTotals } from "./document";

describe("quote and invoice totals", () => {
  const lines = [
    { description: "Labour", quantity: 5, ratePence: 250_00, kind: "labour" as const },
    { description: "Plasterboard", quantity: 20, ratePence: 12_50, kind: "materials" as const },
  ];

  it("adds VAT at the chosen rate", () => {
    const t = docTotals(lines, "standard");
    expect(t.netPence).toBe(1_500_00);
    expect(t.vatPence).toBe(300_00);
    expect(t.totalPence).toBe(1_800_00);
    expect(docTotals(lines, "reduced").vatPence).toBe(75_00);
    expect(docTotals(lines, "none").totalPence).toBe(1_500_00);
  });

  it("shows but doesn't charge reverse charge VAT", () => {
    const t = docTotals(lines, "reverse_charge");
    expect(t.vatPence).toBe(0);
    expect(t.reverseChargeVatPence).toBe(300_00);
    expect(t.totalPence).toBe(1_500_00);
    expect(t.vatNote).toMatch(/reverse charge/i);
  });

  it("deducts CIS from labour only", () => {
    const t = docTotals(lines, "reverse_charge", 2000);
    expect(t.labourPence).toBe(1_250_00);
    expect(t.cisDeductionPence).toBe(250_00);
    expect(t.amountDuePence).toBe(1_250_00);
  });

  it("treats blank lines as nothing", () => {
    expect(docTotals([{ description: "", quantity: NaN, ratePence: 0, kind: "other" }], "standard").totalPence).toBe(0);
  });
});
