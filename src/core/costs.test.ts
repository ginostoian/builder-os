import { describe, expect, it } from "vitest";
import { costOf, labourCost, margin, poRef, poTotals, rechargeNet, vatInGross } from "./costs";

describe("costs", () => {
  it("costs labour by the minute from a day rate", () => {
    expect(labourCost(480, 20_000)).toBe(20_000);
    expect(labourCost(240, 20_000)).toBe(10_000);
    expect(labourCost(515, 18_000)).toBe(19_313);
  });

  it("counts VAT as a cost only for companies that can't reclaim it", () => {
    expect(costOf({ netPence: 10_000, totalPence: 12_000 }, true)).toBe(10_000);
    expect(costOf({ netPence: 10_000, totalPence: 12_000 }, false)).toBe(12_000);
  });

  it("works out VAT inside a gross amount and recharge prices", () => {
    expect(vatInGross(12_000, 2000)).toBe(2_000);
    expect(vatInGross(999, 2000)).toBe(166);
    expect(rechargeNet(10_000, 0)).toBe(10_000);
    expect(rechargeNet(10_000, 1000)).toBe(11_000);
  });

  it("totals purchase orders and margins", () => {
    expect(poTotals([{ qty: 12, unitPricePence: 850 }, { qty: 2.5, unitPricePence: 1_999 }], 2000)).toEqual({ net: 15_198, vat: 3_040, total: 18_238 });
    expect(poRef(7)).toBe("PO-0007");
    expect(margin(100_000, 75_000)).toEqual({ profit: 25_000, percent: 25 });
    expect(margin(0, 5_000)).toEqual({ profit: -5_000, percent: null });
  });
});
