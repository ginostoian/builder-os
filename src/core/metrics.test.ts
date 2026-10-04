import { describe, expect, it } from "vitest";
import { bucketOf, lastMonths, mrrByMonth, stickiness, trialConversion, type CompanyFacts } from "./metrics";

const now = new Date("2026-10-15T12:00:00Z");
const base: CompanyFacts = { plan: "free", comped: false, trialEndsAt: null, subscriptionStatus: null, mrrPence: 0 };

describe("bucketOf", () => {
  it("puts each company in one bucket", () => {
    expect(bucketOf({ ...base, comped: true, plan: "pro", subscriptionStatus: "active", mrrPence: 11900 }, now)).toBe("comped");
    expect(bucketOf({ ...base, plan: "essentials", subscriptionStatus: "active", mrrPence: 4900 }, now)).toBe("paying");
    expect(bucketOf({ ...base, plan: "pro", subscriptionStatus: "past_due", mrrPence: 11900 }, now)).toBe("past_due");
    expect(bucketOf({ ...base, trialEndsAt: new Date("2026-10-20T00:00:00Z") }, now)).toBe("trial");
    expect(bucketOf({ ...base, trialEndsAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe("free");
    expect(bucketOf({ ...base, plan: "free", subscriptionStatus: "canceled" }, now)).toBe("free");
  });
});

describe("mrrByMonth", () => {
  it("rebuilds past MRR from events and splits the movements", () => {
    const months = lastMonths(now, 3);
    expect(months).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    const events = [
      // A pays Essentials from August, upgrades to Pro in September.
      { orgId: "a", at: new Date("2026-08-03T00:00:00Z"), before: 0, after: 4900 },
      { orgId: "a", at: new Date("2026-09-10T00:00:00Z"), before: 4900, after: 11900 },
      // B paid Pro since before August, cancels in September.
      { orgId: "b", at: new Date("2026-09-20T00:00:00Z"), before: 11900, after: 0 },
      // C starts in October, downgrades the same month.
      { orgId: "c", at: new Date("2026-10-02T00:00:00Z"), before: 0, after: 11900 },
      { orgId: "c", at: new Date("2026-10-05T00:00:00Z"), before: 11900, after: 4900 },
    ];
    const current = new Map([
      ["a", 11900],
      ["b", 0],
      ["c", 4900],
    ]);
    const [aug, sep, oct] = mrrByMonth(current, events, months);
    expect(aug).toMatchObject({ start: 11900, end: 16800, newMrr: 4900, churned: 0, payingAtStart: 1, logoChurn: 0 });
    expect(sep).toMatchObject({ start: 16800, end: 11900, expansion: 7000, churned: 11900, payingAtStart: 2, churnedCompanies: 1, logoChurn: 0.5 });
    expect(sep.revenueChurn).toBeCloseTo(11900 / 16800);
    expect(oct).toMatchObject({ start: 11900, end: 16800, newMrr: 11900, contraction: 7000, churned: 0, revenueChurn: 7000 / 11900 });
  });

  it("has no rates without paying companies", () => {
    const [m] = mrrByMonth(new Map(), [], lastMonths(now, 1));
    expect(m).toMatchObject({ start: 0, end: 0, logoChurn: null, revenueChurn: null });
  });
});

describe("trialConversion and stickiness", () => {
  it("counts trials that ended recently and now pay", () => {
    const ended = new Date("2026-10-01T00:00:00Z");
    const r = trialConversion(
      [
        { ...base, trialEndsAt: ended, deletedAt: null },
        { ...base, trialEndsAt: ended, plan: "pro", subscriptionStatus: "active", mrrPence: 11900, deletedAt: null },
        { ...base, trialEndsAt: new Date("2026-10-30T00:00:00Z"), deletedAt: null },
        { ...base, trialEndsAt: ended, comped: true, deletedAt: null },
      ],
      now,
    );
    expect(r).toEqual({ ended: 2, converted: 1, rate: 0.5 });
    expect(stickiness(5, 20)).toBe(0.25);
    expect(stickiness(0, 0)).toBeNull();
  });
});
