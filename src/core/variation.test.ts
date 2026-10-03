import { describe, expect, it } from "vitest";
import { buildVariationSnapshot, variationRef, variationTotals, type VariationLine } from "./variation";

const line = (over: Partial<VariationLine> = {}): VariationLine => ({ id: crypto.randomUUID(), name: "Extra socket", qty: 2, unit: "item", ratePence: 6_000, markupBps: 2000, omit: false, ...over });

describe("variations", () => {
  it("prices lines like a quote and treats omissions as credits", () => {
    const t = variationTotals([line(), line({ name: "Leave out skirting", qty: 10, unit: "m", ratePence: 800, markupBps: 1500, omit: true })], 2000);
    // 2 × £72.00 = £144.00; minus 10 × £9.20 = £92.00 → £52.00 net, £10.40 VAT.
    expect(t).toMatchObject({ net: 5_200, vat: 1_040, total: 6_240 });
    expect(t.cost).toBe(12_000 - 8_000);
  });

  it("makes a credit the mirror image of the same charge", () => {
    const charge = variationTotals([line({ qty: 1, ratePence: 333, markupBps: 0 })], 2000);
    const credit = variationTotals([line({ qty: 1, ratePence: 333, markupBps: 0, omit: true })], 2000);
    expect(credit).toMatchObject({ net: -charge.net, vat: -charge.vat, total: -charge.total });
  });

  it("freezes a client-safe snapshot with no cost rates or markups", () => {
    const s = buildVariationSnapshot({
      number: 2,
      title: "Extra sockets",
      reason: "Client asked for two more in the kitchen",
      company: { name: "Hale", tradingName: null, vatNumber: null, logoUrl: null, brandColour: null },
      clientName: "Sarah",
      quote: { number: 12, title: "Kitchen" },
      vatRateBps: 2000,
      lines: [line()],
    });
    expect(s.ref).toBe(variationRef(12, 2));
    expect(s.ref).toBe("Q-0012-V2");
    expect(s.lines[0]).toMatchObject({ unitPrice: 7_200, total: 14_400 });
    expect(JSON.stringify(s)).not.toMatch(/ratePence|markup/i);
  });
});
