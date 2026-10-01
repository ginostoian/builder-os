import { describe, expect, it } from "vitest";
import { formatBps, formatGBP, parsePence } from "./money";
import { lineTotal, quoteTotals, sectionTotal, stageAmounts } from "./quote";
import { paymentPlan, quoteSections, VAT_RATE } from "./demo-data";

describe("quote maths", () => {
  it("applies per-line markup and rounds to the penny", () => {
    expect(lineTotal({ qty: 1, rate: 185_000, markup: 1200 })).toBe(207_200);
    expect(lineTotal({ qty: 6.2, rate: 14_500, markup: 1500 })).toBe(103_385);
  });

  it("matches the Q-1042 figures shown in the design", () => {
    const t = quoteTotals(quoteSections, VAT_RATE);
    expect(formatGBP(t.cost)).toBe("£26,032.00");
    expect(formatGBP(t.net)).toBe("£29,042.80");
    expect(formatGBP(t.total)).toBe("£34,851.36");
    expect(formatBps(t.margin)).toBe("10.37%");
    expect(quoteSections.map((s) => formatGBP(sectionTotal(s), 0))).toEqual(["£4,178", "£13,468", "£6,635", "£4,761"]);
  });

  it("splits stages so they always sum to the total", () => {
    const t = quoteTotals(quoteSections, VAT_RATE);
    const amounts = stageAmounts(t.total, paymentPlan);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(t.total);
  });

  it("parses typed money", () => {
    expect(parsePence("1,850.00")).toBe(185_000);
    expect(parsePence("£14")).toBe(1_400);
    expect(parsePence("abc")).toBeNull();
  });
});
