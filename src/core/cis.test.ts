import { describe, expect, it } from "vitest";
import { cisDeduction, isUtr, isVerificationRef, taxMonth } from "./cis";

describe("CIS", () => {
  it("deducts from the labour part only, rounding down", () => {
    // £1,000 before VAT, £300 materials, registered: 20% of £700.
    expect(cisDeduction(100_000, 30_000, 2000)).toBe(14_000);
    expect(cisDeduction(100_000, 30_000, 3000)).toBe(21_000);
    expect(cisDeduction(100_000, 30_000, 0)).toBe(0);
    // Materials can't be more than the payment.
    expect(cisDeduction(10_000, 50_000, 2000)).toBe(0);
    // 20% of £3.33 is 66.6p: 66p.
    expect(cisDeduction(333, 0, 2000)).toBe(66);
  });

  it("works out tax months from the 6th to the 5th", () => {
    expect(taxMonth("2026-10-05")).toMatchObject({ start: "2026-09-06", end: "2026-10-05", dueBy: "2026-10-19" });
    expect(taxMonth("2026-10-06")).toMatchObject({ start: "2026-10-06", end: "2026-11-05", dueBy: "2026-11-19" });
    expect(taxMonth("2027-01-03")).toMatchObject({ start: "2026-12-06", end: "2027-01-05", dueBy: "2027-01-19" });
    expect(taxMonth("2026-12-20").label).toBe("6 Dec – 5 Jan 2027");
  });

  it("checks UTRs and verification references", () => {
    expect(isUtr("12345 67890")).toBe(true);
    expect(isUtr("123456789")).toBe(false);
    expect(isVerificationRef("V1234567890")).toBe(true);
    expect(isVerificationRef("V1234567890/AB")).toBe(true);
    expect(isVerificationRef("1234567890")).toBe(false);
  });
});
