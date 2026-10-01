import { describe, expect, it } from "vitest";
import { parseCompanySettingsForm } from "./company-settings";
import { parsePercentToBps } from "./money";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parsePercentToBps", () => {
  it("accepts plain percentages", () => {
    expect(parsePercentToBps("15", 50_000)).toBe(1500);
    expect(parsePercentToBps("12.5%", 50_000)).toBe(1250);
    expect(parsePercentToBps(" .25 ", 50_000)).toBe(25);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "-5", "1e2", "0x10", "15.125", "abc", "501"]) expect(parsePercentToBps(bad, 50_000), bad).toBeNull();
  });
});

describe("parseCompanySettingsForm", () => {
  it("parses and tidies a valid form", () => {
    const result = parseCompanySettingsForm(
      form({ name: " Hale & Sons ", vatNumber: "gb 123 4567 89", defaultMarkup: "15", defaultVatRate: "20", tradingName: "", quoteTerms: "Valid 30 days." }),
    );
    expect(result).toEqual({
      ok: true,
      value: { name: "Hale & Sons", vatNumber: "GB123456789", defaultMarkupBps: 1500, defaultVatRateBps: 2000, quoteTerms: "Valid 30 days." },
    });
  });

  it("ignores fields it doesn't know, so a form can't reach billing columns or the tenant", () => {
    const result = parseCompanySettingsForm(form({ name: "Hale", defaultVatRate: "20", plan: "pro", orgId: "x", stripeCustomerId: "cus_x" }));
    const set = result.ok ? Object.entries(result.value).filter(([, v]) => v !== undefined).map(([k]) => k) : [];
    expect(set.sort()).toEqual(["defaultMarkupBps", "defaultVatRateBps", "name"]);
  });

  it("reports each bad field", () => {
    const result = parseCompanySettingsForm(
      form({ name: "", vatNumber: "123", logoUrl: "javascript:alert(1)", brandColour: "orange", defaultMarkup: "lots", defaultVatRate: "20" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["brandColour", "defaultMarkupBps", "logoUrl", "name", "vatNumber"]);
      expect(result.errors.name).toBe("Enter your company name");
    }
  });

  it("rejects a file where text is expected", () => {
    const data = form({ defaultVatRate: "20" });
    data.set("name", new Blob(["x"]), "name.txt");
    expect(parseCompanySettingsForm(data).ok).toBe(false);
  });
});
