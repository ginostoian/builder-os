import { describe, expect, it } from "vitest";
import { DEFAULT_ESTIMATOR, PROJECTS, PROJECT_TYPES, describeProject, describeRange, estimate, estimatorSettings, priceKey } from "./estimator";

const mid = { region: "east_midlands", vat: false };

describe("estimator", () => {
  it("prices area projects by the m², with a range either side", () => {
    const e = estimate({ type: "single_extension", size: 20, finish: "standard" }, { region: "london", vat: false })!;
    // 2,300 × 1.25 × 20 = 57,500, ±12%.
    expect(e.mid).toBe(58000);
    expect(e.low).toBe(51000);
    expect(e.high).toBe(64000);
    expect(e.perM2).toEqual({ low: 2530, high: 3220 });
  });

  it("prices fixed projects by kind and finish, and adds VAT when asked", () => {
    const e = estimate({ type: "loft", variant: "dormer", finish: "premium" }, { region: "south_east", vat: true })!;
    expect(e.mid).toBe(Math.round((45000 * 1.12 * 1.25 * 1.2) / 1000) * 1000);
    expect(e.vat).toBe(true);
    expect(estimate({ type: "loft", variant: "nope", finish: "standard" }, mid)).toBeNull();
  });

  it("applies the company's adjustment, or its own prices without the region factor", () => {
    const typical = estimate({ type: "bathroom", variant: "family", finish: "standard" }, mid)!;
    const dearer = estimate({ type: "bathroom", variant: "family", finish: "standard" }, { ...mid, adjustPct: 20 })!;
    expect(dearer.mid).toBeGreaterThan(typical.mid);
    const own = estimate({ type: "bathroom", variant: "family", finish: "standard" }, { region: "london", vat: false, prices: { [priceKey("bathroom", "family")]: 10000 } })!;
    expect(own.mid).toBe(10000);
  });

  it("keeps sizes within sensible limits", () => {
    const tiny = estimate({ type: "single_extension", size: 1, finish: "standard" }, mid)!;
    const min = estimate({ type: "single_extension", size: PROJECTS.single_extension.minSize, finish: "standard" }, mid)!;
    expect(tiny.mid).toBe(min.mid);
  });

  it("validates company settings", () => {
    expect(estimatorSettings.safeParse(DEFAULT_ESTIMATOR).success).toBe(true);
    expect(estimatorSettings.safeParse({ ...DEFAULT_ESTIMATOR, types: [] }).success).toBe(false);
    expect(estimatorSettings.safeParse({ ...DEFAULT_ESTIMATOR, region: "mars" }).success).toBe(false);
    expect(estimatorSettings.safeParse({ ...DEFAULT_ESTIMATOR, adjustPct: 500 }).success).toBe(false);
  });

  it("describes the project and range in words", () => {
    expect(describeProject({ type: "single_extension", size: 24, finish: "premium" })).toBe("Single-storey extension, 24 m², premium finish");
    expect(describeProject({ type: "kitchen", variant: "large", finish: "basic" })).toBe("New kitchen, supplied and fitted, Large (over 15 m²), basic finish");
    expect(describeRange({ low: 40000, mid: 45000, high: 50000, vat: true })).toBe("£40,000 to £50,000 including VAT");
  });

  it("has a working estimate for every project type", () => {
    for (const t of PROJECT_TYPES) {
      const spec = PROJECTS[t];
      const e = estimate({ type: t, size: spec.defaultSize, variant: spec.variants?.[0]?.id, finish: "standard" }, mid);
      expect(e && e.low < e.mid && e.mid < e.high).toBe(true);
    }
  });
});
