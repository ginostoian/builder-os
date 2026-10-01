import { describe, expect, it } from "vitest";
import { lineTotal, quoteTotals, stageAmounts } from "./quote";

const line = (qty: number, rate: number, markup: number) => ({ id: "x", name: "x", unit: "item", qty, rate, markup });

describe("quote maths", () => {
  it("applies per-line markup and rounds to the penny", () => {
    expect(lineTotal({ qty: 1, rate: 185_000, markup: 1200 })).toBe(207_200);
    expect(lineTotal({ qty: 6.2, rate: 14_500, markup: 1500 })).toBe(103_385);
  });

  it("computes VAT on the net and margin on the net price", () => {
    const t = quoteTotals([{ id: "s", name: "s", lines: [line(2, 10_000, 2500), line(1, 5_000, 0)] }], 2000);
    expect(t).toEqual({ cost: 25_000, markup: 5_000, net: 30_000, vat: 6_000, total: 36_000, margin: 1667 });
  });

  it("handles an empty quote", () => {
    expect(quoteTotals([], 2000)).toEqual({ cost: 0, markup: 0, net: 0, vat: 0, total: 0, margin: 0 });
  });

  it("splits stages so they always sum to the total, whatever the rounding", () => {
    const stages = [{ label: "a", share: 3333 }, { label: "b", share: 3333 }, { label: "c", share: 3334 }];
    for (const total of [0, 1, 99, 100_001, 3_485_136, 999_999_999]) {
      const amounts = stageAmounts(total, stages);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
