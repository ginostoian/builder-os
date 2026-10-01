import { describe, expect, it } from "vitest";
import { MAX_PATCH_OPS, MAX_RATE_PENCE } from "./limits";
import { clientInput, httpsUrl, orgSettingsInput, qty, quoteLineInput, quotePatch, serviceInput } from "./schemas";

const uuid = "6f1c2b1e-8a4e-4b4b-9a51-1b2c3d4e5f60";
const validLine = { name: "Skim plaster", qty: 6.2, unit: "m²", ratePence: 14_500, markupBps: 1500 };

describe("schemas", () => {
  it("accepts a valid line and fills defaults", () => {
    expect(quoteLineInput.parse(validLine)).toEqual({ ...validLine, noteVisible: false, kind: "normal" });
  });

  it("rejects unknown keys so clients can't set orgId or id", () => {
    expect(quoteLineInput.safeParse({ ...validLine, orgId: uuid }).success).toBe(false);
    expect(serviceInput.safeParse({ category: "Plaster", name: "Skim", unit: "m²", ratePence: 1, id: uuid }).success).toBe(false);
  });

  it("enforces money, markup and quantity bounds", () => {
    expect(quoteLineInput.safeParse({ ...validLine, ratePence: -1 }).success).toBe(false);
    expect(quoteLineInput.safeParse({ ...validLine, ratePence: 1.5 }).success).toBe(false);
    expect(quoteLineInput.safeParse({ ...validLine, ratePence: MAX_RATE_PENCE + 1 }).success).toBe(false);
    expect(quoteLineInput.safeParse({ ...validLine, markupBps: 50_001 }).success).toBe(false);
    expect(qty.safeParse(1.234).success).toBe(true);
    expect(qty.safeParse(1.2345).success).toBe(false);
    expect(qty.safeParse(Number.NaN).success).toBe(false);
    expect(qty.safeParse(Infinity).success).toBe(false);
  });

  it("rejects control characters and blank names", () => {
    expect(clientInput.safeParse({ name: "   " }).success).toBe(false);
    expect(clientInput.safeParse({ name: "Okafor\u0000" }).success).toBe(false);
    expect(clientInput.safeParse({ name: "Okafor\nInjected" }).success).toBe(false);
    expect(quoteLineInput.parse({ ...validLine, note: "Line one\nLine two" }).note).toBe("Line one\nLine two");
  });

  it("only accepts https URLs", () => {
    expect(httpsUrl.safeParse("https://cdn.example.com/logo.png").success).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "http://example.com/a.png", "https://localhost/a.png"]) {
      expect(httpsUrl.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("normalises UK VAT numbers and postcodes", () => {
    const settings = orgSettingsInput.parse({ name: "Hale & Sons", vatNumber: "gb 123 4567 89", defaultMarkupBps: 1500, defaultVatRateBps: 2000 });
    expect(settings.vatNumber).toBe("GB123456789");
    expect(orgSettingsInput.safeParse({ name: "x", vatNumber: "123", defaultMarkupBps: 0, defaultVatRateBps: 0 }).success).toBe(false);
    const c = clientInput.parse({ name: "Okafor", address: { line1: "14 Elm Road", town: "Bristol", postcode: "bs6 5ab" } });
    expect(c.address?.postcode).toBe("BS6 5AB");
  });

  it("validates autosave patches", () => {
    const ok = quotePatch.safeParse({ quoteId: uuid, baseVersion: 3, ops: [{ op: "updateLine", lineId: uuid, change: { field: "qty", value: 2 } }] });
    expect(ok.success).toBe(true);
    // A cell edit can't target fields outside the allow-list.
    const bad = quotePatch.safeParse({ quoteId: uuid, baseVersion: 3, ops: [{ op: "updateLine", lineId: uuid, change: { field: "orgId", value: uuid } }] });
    expect(bad.success).toBe(false);
    const tooMany = Array.from({ length: MAX_PATCH_OPS + 1 }, () => ({ op: "removeLine", lineId: uuid }));
    expect(quotePatch.safeParse({ quoteId: uuid, baseVersion: 0, ops: tooMany }).success).toBe(false);
    expect(quotePatch.safeParse({ quoteId: "1 OR 1=1", baseVersion: 0, ops: [{ op: "removeLine", lineId: uuid }] }).success).toBe(false);
  });
});
