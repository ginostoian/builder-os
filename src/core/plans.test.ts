import { describe, expect, it } from "vitest";
import { entitlement, planFor, planForLookupKey, planHas, type BillingFacts } from "./plans";

const base: BillingFacts = { plan: "free", comped: false, trialEndsAt: null, subscriptionStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
const NOW = new Date("2026-10-05T12:00:00Z");

describe("plans", () => {
  it("unlocks features by plan", () => {
    expect(planHas("free", "invoicing")).toBe(false);
    expect(planHas("essentials", "invoicing")).toBe(true);
    expect(planHas("essentials", "projects")).toBe(false);
    expect(planHas("pro", "projects")).toBe(true);
    expect(planFor("pipeline")).toBe("pro");
  });

  it("works out what a company has right now", () => {
    expect(entitlement(base, NOW)).toMatchObject({ plan: "free", why: "free" });
    expect(entitlement({ ...base, comped: true }, NOW)).toMatchObject({ plan: "pro", why: "comped" });
    // Trial: Pro until it ends, with days left rounded up.
    expect(entitlement({ ...base, trialEndsAt: new Date("2026-10-08T00:00:00Z") }, NOW)).toEqual({ plan: "pro", why: "trial", trialDaysLeft: 3, pastDue: false });
    expect(entitlement({ ...base, trialEndsAt: new Date("2026-10-05T11:00:00Z") }, NOW).plan).toBe("free");
    // A live subscription wins over a trial; past due keeps the plan (Stripe is retrying) but says so.
    expect(entitlement({ ...base, plan: "essentials", subscriptionStatus: "active", trialEndsAt: new Date("2026-10-08T00:00:00Z") }, NOW)).toMatchObject({ plan: "essentials", why: "subscription" });
    expect(entitlement({ ...base, plan: "pro", subscriptionStatus: "past_due" }, NOW)).toMatchObject({ plan: "pro", pastDue: true });
    // Cancelled or unpaid: back to Free.
    expect(entitlement({ ...base, plan: "pro", subscriptionStatus: "canceled" }, NOW).plan).toBe("free");
    expect(entitlement({ ...base, plan: "pro", subscriptionStatus: "unpaid" }, NOW).plan).toBe("free");
  });

  it("maps Stripe prices to plans", () => {
    expect(planForLookupKey("builderos_pro_monthly")).toBe("pro");
    expect(planForLookupKey("builderos_essentials_monthly")).toBe("essentials");
    expect(planForLookupKey("something_else")).toBeNull();
  });
});
