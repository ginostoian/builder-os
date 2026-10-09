import { describe, expect, it } from "vitest";
import { cisCalc, labourForNet } from "./cis";
import { marginToMarkup, markupToMargin, mixUpCost, priceFrom } from "./margin";
import { marginSensitivity, profitForTurnover, turnoverForProfit, VAT_THRESHOLD_PENCE } from "./profit-target";
import { drcInvoice, drcStep, DRC_WORDING, formatDrcAnswers, parseDrcAnswers, type DrcAnswers } from "./reverse-charge";

describe("CIS calculator", () => {
  it("deducts from labour only, before VAT, rounded down", () => {
    const r = cisCalc({ labourPence: 1_000_00, materialsPence: 250_00, status: "standard", vat: "none" });
    expect(r.grossPence).toBe(1_250_00);
    expect(r.deductionPence).toBe(200_00);
    expect(r.paymentPence).toBe(1_050_00);
    expect(cisCalc({ labourPence: 333, materialsPence: 0, status: "standard", vat: "none" }).deductionPence).toBe(66);
  });

  it("uses 30% unregistered and 0% gross", () => {
    expect(cisCalc({ labourPence: 1_000_00, materialsPence: 0, status: "higher", vat: "none" }).deductionPence).toBe(300_00);
    expect(cisCalc({ labourPence: 1_000_00, materialsPence: 0, status: "gross", vat: "none" }).deductionPence).toBe(0);
  });

  it("adds VAT to the payment when charged normally, never to the deduction", () => {
    const r = cisCalc({ labourPence: 1_000_00, materialsPence: 200_00, status: "standard", vat: "standard" });
    expect(r.vatPence).toBe(240_00);
    expect(r.invoiceTotalPence).toBe(1_440_00);
    expect(r.deductionPence).toBe(200_00);
    expect(r.paymentPence).toBe(1_240_00);
  });

  it("leaves VAT out of the payment under the reverse charge", () => {
    const r = cisCalc({ labourPence: 1_000_00, materialsPence: 0, status: "standard", vat: "reverse_charge" });
    expect(r.vatPence).toBe(0);
    expect(r.reverseChargeVatPence).toBe(200_00);
    expect(r.paymentPence).toBe(800_00);
  });

  it("finds the tax month and due date", () => {
    const r = cisCalc({ labourPence: 100, materialsPence: 0, status: "standard", vat: "none", paidOn: "2026-10-03" });
    expect(r.taxMonth?.start).toBe("2026-09-06");
    expect(r.taxMonth?.dueBy).toBe("2026-10-19");
  });

  it("works back from the net a subcontractor wants", () => {
    expect(labourForNet(800_00, "standard")).toBe(1_000_00);
    expect(labourForNet(700_00, "higher")).toBe(1_000_00);
    expect(labourForNet(500_00, "gross")).toBe(500_00);
    for (const net of [1, 99, 12_345, 987_654]) {
      const g = labourForNet(net, "standard");
      const after = (x: number) => x - Math.floor((x * 2000) / 10_000);
      expect(after(g)).toBeGreaterThanOrEqual(net);
      expect(after(g)).toBeLessThanOrEqual(net + 1);
    }
  });
});

describe("reverse charge checker", () => {
  const all: DrcAnswers = { supplierVat: "yes", customerVat: "yes", cis: "yes", rate: "standard", endUser: "no", staffOnly: "no" };

  it("asks the questions in order", () => {
    expect("next" in drcStep({}) && drcStep({})).toMatchObject({ next: { id: "supplierVat" } });
    expect(drcStep({ supplierVat: "yes" })).toMatchObject({ next: { id: "customerVat" } });
    expect(drcStep({ ...all, staffOnly: undefined })).toMatchObject({ next: { id: "staffOnly" } });
  });

  it("applies only when every condition is met", () => {
    expect(drcStep(all)).toMatchObject({ outcome: { kind: "applies" } });
    expect(drcStep({ ...all, rate: "reduced" })).toMatchObject({ outcome: { kind: "applies" } });
    expect(drcStep({ supplierVat: "no" })).toMatchObject({ outcome: { kind: "no_vat" } });
    expect(drcStep({ supplierVat: "yes", customerVat: "no" })).toMatchObject({ outcome: { kind: "normal_vat" } });
    expect(drcStep({ supplierVat: "yes", customerVat: "yes", cis: "no" })).toMatchObject({ outcome: { kind: "normal_vat" } });
    expect(drcStep({ supplierVat: "yes", customerVat: "yes", cis: "yes", rate: "zero" })).toMatchObject({ outcome: { kind: "zero_rated" } });
    expect(drcStep({ ...all, endUser: "yes" })).toMatchObject({ outcome: { kind: "normal_vat" } });
    expect(drcStep({ ...all, staffOnly: "yes" })).toMatchObject({ outcome: { kind: "normal_vat" } });
  });

  it("shows the VAT on the invoice but the customer pays only the net", () => {
    const step = drcStep(all);
    if (!("outcome" in step)) throw new Error("expected an outcome");
    expect(drcInvoice(10_000_00, step.outcome, "standard")).toEqual({ netPence: 10_000_00, vatRateBps: 2000, vatPence: 2_000_00, customerPaysPence: 10_000_00, vatToHmrcByCustomerPence: 2_000_00 });
    expect(drcInvoice(10_000_00, { kind: "normal_vat", reason: "" }, "reduced").customerPaysPence).toBe(10_500_00);
    expect(drcInvoice(10_000_00, { kind: "no_vat", reason: "" }, undefined).customerPaysPence).toBe(10_000_00);
    expect(DRC_WORDING).toMatch(/reverse charge/i);
  });

  it("round-trips answers through a link and ignores junk", () => {
    expect(parseDrcAnswers(formatDrcAnswers(all))).toEqual(all);
    expect(parseDrcAnswers("yes,maybe,yes")).toEqual({ supplierVat: "yes" });
    expect(parseDrcAnswers("<script>")).toEqual({});
    expect(parseDrcAnswers(null)).toEqual({});
  });
});

describe("markup and margin", () => {
  it("converts both ways", () => {
    expect(markupToMargin(25)).toBeCloseTo(20);
    expect(markupToMargin(100)).toBeCloseTo(50);
    expect(marginToMarkup(20)).toBeCloseTo(25);
    expect(marginToMarkup(50)).toBeCloseTo(100);
    expect(marginToMarkup(100)).toBe(Infinity);
  });

  it("prices from markup, margin or a price", () => {
    expect(priceFrom(1_000_00, "markup", 25)).toMatchObject({ pricePence: 1_250_00, profitPence: 250_00 });
    expect(priceFrom(1_000_00, "margin", 20)).toMatchObject({ pricePence: 1_250_00 });
    expect(priceFrom(1_000_00, "price", 1_500_00)!.marginPct).toBeCloseTo(33.333, 2);
    expect(priceFrom(1_000_00, "margin", 100)).toBeNull();
    expect(priceFrom(0, "markup", 20)).toBeNull();
    expect(priceFrom(1_000_00, "price", -5)).toBeNull();
  });

  it("shows what confusing them costs", () => {
    const r = mixUpCost(10_000_00, 20)!;
    expect(r.wantedPricePence).toBe(12_500_00);
    expect(r.chargedPricePence).toBe(12_000_00);
    expect(r.shortfallPence).toBe(500_00);
    expect(r.actualMarginPct).toBeCloseTo(16.667, 2);
  });
});

describe("revenue and profit target", () => {
  const base = { profitPence: 60_000_00, overheadsPence: 30_000_00, marginPct: 30, averageJobPence: 15_000_00, winRatePct: 25, weeks: 46 };

  it("works out the turnover, jobs and quotes", () => {
    const p = turnoverForProfit(base)!;
    expect(p.turnoverPence).toBe(300_000_00);
    expect(p.grossProfitPence).toBe(90_000_00);
    expect(p.directCostsPence).toBe(210_000_00);
    expect(p.breakEvenPence).toBe(100_000_00);
    expect(p.netMarginPct).toBeCloseTo(20);
    expect(p.jobsPerYear).toBe(20);
    expect(p.quotesPerYear).toBe(80);
    expect(p.perMonthPence).toBe(25_000_00);
    expect(p.overVatThreshold).toBe(true);
  });

  it("rounds turnover up to the pound and refuses impossible margins", () => {
    expect(turnoverForProfit({ ...base, profitPence: 1_00, overheadsPence: 0, marginPct: 33 })!.turnoverPence).toBe(4_00);
    expect(turnoverForProfit({ ...base, marginPct: 0 })).toBeNull();
    expect(turnoverForProfit({ ...base, marginPct: 100 })).toBeNull();
  });

  it("works the other way: profit from a turnover", () => {
    expect(profitForTurnover(base, 200_000_00)!.profitPence).toBe(30_000_00);
    expect(profitForTurnover(base, 50_000_00)!.profitPence).toBe(-15_000_00);
    expect(profitForTurnover(base, 50_000_00)!.overVatThreshold).toBe(false);
    expect(VAT_THRESHOLD_PENCE).toBe(90_000_00);
  });

  it("shows the turnover needed at nearby margins", () => {
    const rows = marginSensitivity(base);
    expect(rows.map((r) => r.marginPct)).toEqual([20, 25, 30, 35, 40]);
    expect(rows.find((r) => r.current)!.plan.turnoverPence).toBe(300_000_00);
    expect(rows[0]!.plan.turnoverPence).toBe(450_000_00);
    expect(marginSensitivity({ ...base, marginPct: 8 }).map((r) => r.marginPct)).toEqual([3, 8, 13, 18]);
  });
});
