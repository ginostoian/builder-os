import { describe, expect, it } from "vitest";
import { formatBps, formatGBP } from "@/core/money";
import { quoteTotals, sectionTotal, stageAmounts } from "@/core/quote";
import { paymentPlan, quoteSections, VAT_RATE } from "./demo-data";

describe("demo data", () => {
  it("matches the Q-1042 figures shown in the design", () => {
    const t = quoteTotals(quoteSections, VAT_RATE);
    expect(formatGBP(t.cost)).toBe("£26,032.00");
    expect(formatGBP(t.net)).toBe("£29,042.80");
    expect(formatGBP(t.total)).toBe("£34,851.36");
    expect(formatBps(t.margin)).toBe("10.37%");
    expect(quoteSections.map((s) => formatGBP(sectionTotal(s), 0))).toEqual(["£4,178", "£13,468", "£6,635", "£4,761"]);
  });

  it("payment plan stages sum to the quote total", () => {
    const t = quoteTotals(quoteSections, VAT_RATE);
    const amounts = stageAmounts(t.total, paymentPlan);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(t.total);
  });
});
