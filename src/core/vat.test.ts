import { describe, expect, it } from "vitest";
import { invoiceEmail } from "./invoice-email";
import { DEFAULT_PLAN } from "./payment-plan";
import { quoteTotals, stageAmounts } from "./quote";
import { buildSnapshot } from "./quote-snapshot";
import { buildVariationSnapshot, variationTotals } from "./variation";
import { chargedVatBps, REVERSE_CHARGE_WORDING, reverseChargeProblem, vatFor, vatLabel } from "./vat";

const sections = [{ id: "s", name: "Works", lines: [{ id: "l", name: "Labour", qty: 10, unit: "day", rate: 25_000, markup: 2000 }] }];

describe("VAT treatment", () => {
  it("charges no VAT under the reverse charge but works out what the customer pays HMRC", () => {
    expect(chargedVatBps(2000, "reverse_charge")).toBe(0);
    expect(chargedVatBps(2000, "standard")).toBe(2000);
    expect(vatFor(10_000, 2000, "standard")).toEqual({ vat: 2000, reverseChargeVat: 0 });
    expect(vatFor(10_000, 2000, "reverse_charge")).toEqual({ vat: 0, reverseChargeVat: 2000 });
    expect(vatFor(-10_001, 500, "reverse_charge")).toEqual({ vat: 0, reverseChargeVat: -500 });
  });

  it("quote totals leave VAT out of a reverse charge total", () => {
    const std = quoteTotals(sections, 2000);
    const rc = quoteTotals(sections, 2000, "reverse_charge");
    expect(std).toMatchObject({ net: 300_000, vat: 60_000, reverseChargeVat: 0, total: 360_000 });
    expect(rc).toMatchObject({ net: 300_000, vat: 0, reverseChargeVat: 60_000, total: 300_000, margin: std.margin });
    expect(
      stageAmounts(rc.total, [
        { label: "Deposit", share: 5000 },
        { label: "Final", share: 5000 },
      ]),
    ).toEqual([150_000, 150_000]);
  });

  it("variations follow their quote's treatment, credits included", () => {
    const lines = [{ id: "a", name: "Extra socket", qty: 2, unit: "item", ratePence: 5000, markupBps: 0, omit: false }];
    expect(variationTotals(lines, 2000, "reverse_charge")).toMatchObject({ net: 10_000, vat: 0, reverseChargeVat: 2000, total: 10_000 });
    expect(variationTotals([{ ...lines[0], omit: true }], 2000, "reverse_charge")).toMatchObject({ net: -10_000, vat: 0, reverseChargeVat: -2000, total: -10_000 });
    const snap = buildVariationSnapshot({
      number: 1,
      title: "Sockets",
      reason: null,
      company: { name: "A", tradingName: null, vatNumber: "GB1", logoUrl: null, brandColour: null },
      clientName: "B",
      quote: { number: 3, title: "Q" },
      vatRateBps: 2000,
      vatTreatment: "reverse_charge",
      lines,
    });
    expect(snap.vatTreatment).toBe("reverse_charge");
    expect(snap.totals).toEqual({ net: 10_000, vat: 0, total: 10_000, reverseChargeVat: 2000 });
    const std = buildVariationSnapshot({
      number: 1,
      title: "Sockets",
      reason: null,
      company: { name: "A", tradingName: null, vatNumber: null, logoUrl: null, brandColour: null },
      clientName: "B",
      quote: { number: 3, title: "Q" },
      vatRateBps: 2000,
      lines,
    });
    // Standard snapshots look exactly as they did before, so their content hashes don't change.
    expect("vatTreatment" in std).toBe(false);
    expect("reverseChargeVat" in std.totals).toBe(false);
  });

  it("a reverse charge quote snapshot records the treatment and plans payments on the net total", () => {
    const snap = buildSnapshot({
      company: { name: "A", tradingName: null, vatNumber: "GB1", logoUrl: null, brandColour: null, terms: null },
      clientName: "Main Contractor Ltd",
      quote: { number: 1, title: "Second fix", siteAddress: null, validUntil: null, vatRateBps: 2000, vatTreatment: "reverse_charge" },
      versionNo: 1,
      paymentPlan: DEFAULT_PLAN("00000000-0000-4000-8000-000000000001"),
      sections: [
        { id: "s", name: "Works", lines: [{ id: "l", name: "Labour", qty: 10, unit: "day", ratePence: 25_000, markupBps: 2000, note: null, noteVisible: false, kind: "normal" }] },
      ],
    });
    expect(snap.quote.vatTreatment).toBe("reverse_charge");
    expect(snap.totals).toEqual({ net: 300_000, vat: 0, total: 300_000, reverseChargeVat: 60_000 });
    expect(snap.paymentPlan?.reduce((a, s) => a + s.amount, 0)).toBe(300_000);
  });

  it("says what's missing before a reverse charge quote can go out", () => {
    expect(reverseChargeProblem("standard", 0, null)).toBeNull();
    expect(reverseChargeProblem("reverse_charge", 0, "GB123")).toMatch(/VAT rate/);
    expect(reverseChargeProblem("reverse_charge", 2000, " ")).toMatch(/VAT number/);
    expect(reverseChargeProblem("reverse_charge", 2000, "GB123")).toBeNull();
    expect(vatLabel("reverse_charge")).toBe("ex. VAT (reverse charge)");
    expect(vatLabel(undefined)).toBe("inc. VAT");
  });

  it("invoice emails explain the reverse charge and show the VAT to pay HMRC", () => {
    const facts = {
      ref: "INV-0001",
      company: { name: "A", tradingName: null, brandColour: null },
      clientName: "Sam",
      description: "Deposit",
      totalPence: 150_000,
      dueDate: "2026-11-01",
      bank: { accountName: "A", sortCode: "112233", accountNumber: "12345678" },
      link: "https://x",
    };
    const rc = invoiceEmail("new", { ...facts, reverseChargeVatPence: 30_000 }).content;
    expect(rc.paragraphs.join(" ")).toContain(REVERSE_CHARGE_WORDING);
    expect(rc.details).toContainEqual(["VAT you pay to HMRC", "£300.00"]);
    const std = invoiceEmail("new", facts).content;
    expect(std.paragraphs.join(" ")).not.toContain("reverse charge");
  });
});
