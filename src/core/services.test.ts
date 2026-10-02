import { describe, expect, it } from "vitest";
import { can } from "./roles";
import { bundleRate, parseBundleForm, parseServiceForm } from "./services";

const uuidA = "6f1c2b1e-8a4e-4b4b-9a51-1b2c3d4e5f60";
const uuidB = "7a2d3c2f-9b5f-4c5c-8b62-2c3d4e5f6071";

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  return f;
};

describe("parseServiceForm", () => {
  it("parses pounds to pence and a blank markup to the company default", () => {
    expect(parseServiceForm(form({ category: "Plastering", name: "Skim, walls", unit: "m²", rate: "£1,014.50", markup: "" }))).toEqual({
      ok: true,
      value: { category: "Plastering", name: "Skim, walls", unit: "m²", ratePence: 101_450, kind: "service" },
    });
  });

  it("parses a markup override to basis points", () => {
    const result = parseServiceForm(form({ category: "Plastering", name: "Skim", unit: "m²", rate: "14", markup: "12.5%" }));
    expect(result.ok && result.value.defaultMarkupBps).toBe(1250);
  });

  it("ignores fields it doesn't know, including kind", () => {
    const result = parseServiceForm(form({ category: "A", name: "B", unit: "job", rate: "1", kind: "bundle", orgId: uuidA }));
    expect(result).toEqual({ ok: true, value: { category: "A", name: "B", unit: "job", ratePence: 100, kind: "service" } });
  });

  it("explains every bad field", () => {
    expect(parseServiceForm(form({ rate: "-5", markup: "600" }))).toEqual({
      ok: false,
      errors: {
        rate: "Enter a rate in pounds, e.g. 14.50",
        markup: "Enter a percentage between 0 and 500, or leave it blank",
        category: "Choose or type a category",
        name: "Enter a name",
        unit: "Enter a unit, e.g. m² or job",
      },
    });
    expect(parseServiceForm(form({ category: "A", name: "B", unit: "job", rate: "1.234" })).ok).toBe(false);
    expect(parseServiceForm(form({ category: "A", name: "B", unit: "job", rate: "20000000" })).ok).toBe(false);
  });
});

describe("parseBundleForm", () => {
  const base = { category: "Bathrooms", name: "Bathroom refit", unit: "job" };

  it("pairs services with quantities and skips empty rows", () => {
    const result = parseBundleForm(form({ ...base, itemServiceId: [uuidA, "", uuidB], itemQty: ["1", "4", "2.5"] }));
    expect(result).toEqual({
      ok: true,
      value: { ...base, items: [{ serviceId: uuidA, qty: 1 }, { serviceId: uuidB, qty: 2.5 }] },
    });
  });

  it("needs at least one service, each once, with a positive quantity", () => {
    expect(parseBundleForm(form(base))).toEqual({ ok: false, errors: { items: "Add at least one service" } });
    expect(parseBundleForm(form({ ...base, itemServiceId: [uuidA, uuidA], itemQty: ["1", "1"] }))).toEqual({
      ok: false,
      errors: { items: "Each service can only appear once" },
    });
    expect(parseBundleForm(form({ ...base, itemServiceId: [uuidA], itemQty: ["0"] }))).toMatchObject({ ok: false, errors: { items: expect.stringMatching(/more than 0/) } });
    expect(parseBundleForm(form({ ...base, itemServiceId: [uuidA], itemQty: ["two"] }))).toMatchObject({ ok: false, errors: { items: expect.stringMatching(/quantity/) } });
    expect(parseBundleForm(form({ ...base, itemServiceId: ["not-a-uuid"], itemQty: ["1"] }))).toMatchObject({ ok: false, errors: { items: "Pick a service for each row" } });
  });

  it("never takes a rate from the form", () => {
    const result = parseBundleForm(form({ ...base, rate: "1", ratePence: "1", itemServiceId: [uuidA], itemQty: ["1"] }));
    expect(result.ok && "ratePence" in result.value).toBe(false);
  });
});

describe("bundleRate", () => {
  it("sums items, rounding each to the penny like a quote line", () => {
    expect(bundleRate([{ qty: 6.2, ratePence: 1_450 }, { qty: 1, ratePence: 185_000 }, { qty: 0.333, ratePence: 1 }])).toBe(8_990 + 185_000 + 0);
    expect(bundleRate([])).toBe(0);
  });
});

describe("library permissions", () => {
  it("keeps rates away from site staff and lets estimators manage the library", () => {
    expect(can("site_lead", "library.view")).toBe(false);
    expect(can("employee", "library.view")).toBe(false);
    expect(can("office", "library.view")).toBe(true);
    expect(can("office", "library.manage")).toBe(false);
    expect(can("estimator", "library.manage")).toBe(true);
    expect(can("admin", "library.manage")).toBe(true);
  });
});
