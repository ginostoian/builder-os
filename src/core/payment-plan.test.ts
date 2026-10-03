import { describe, expect, it } from "vitest";
import { addDays, computePlan, invoiceState, reminderDue, splitVat, weeklyInstalments, type PlanStage } from "./payment-plan";

const s = (amountKind: PlanStage["amountKind"], amountValue?: number): PlanStage => ({ id: Math.random().toString(36), label: "x", amountKind, amountValue, dueKind: "milestone" });
const amounts = (r: ReturnType<typeof computePlan>) => r.stages.map((x) => x.amount);

describe("computePlan", () => {
  it("splits percentages, takes fixed amounts, and puts the rest on the balance", () => {
    const r = computePlan([s("percent", 2500), s("fixed", 100_000), s("balance")], 1_000_000);
    expect(r.ok).toBe(true);
    expect(amounts(r)).toEqual([250_000, 100_000, 650_000]);
  });

  it("lets the last payment absorb penny rounding of 100%", () => {
    const r = computePlan([s("percent", 3333), s("percent", 3333), s("percent", 3334)], 100_001);
    expect(r.ok).toBe(true);
    expect(amounts(r).reduce((a, b) => a + b, 0)).toBe(100_001);
  });

  it("explains plans that don't add up", () => {
    expect(computePlan([s("percent", 5000)], 1_000)).toMatchObject({ ok: false, error: expect.stringMatching(/less than/) });
    expect(computePlan([s("fixed", 2_000), s("balance")], 1_000)).toMatchObject({ ok: false, error: expect.stringMatching(/more than/) });
    expect(computePlan([s("balance"), s("balance")], 1_000)).toMatchObject({ ok: false, error: expect.stringMatching(/Only one/) });
    expect(computePlan([], 1_000)).toMatchObject({ ok: false });
  });
});

describe("weeklyInstalments", () => {
  it("splits a share of the total into weekly dated payments", () => {
    const stages = weeklyInstalments({ count: 3, startDate: "2026-10-26", totalBps: 8000, ids: ["a", "b", "c"] });
    expect(stages.map((x) => [x.amountValue, x.dueDate])).toEqual([
      [2666, "2026-10-26"],
      [2666, "2026-11-02"],
      [2668, "2026-11-09"],
    ]);
    // With a 20% deposit, the whole plan is exactly 100%.
    const plan = computePlan([{ id: "d", label: "Deposit", amountKind: "percent", amountValue: 2000, dueKind: "on_acceptance" }, ...stages], 1_234_567);
    expect(plan.ok && amounts(plan).reduce((a, b) => a + b, 0)).toBe(1_234_567);
  });
});

describe("money and dates", () => {
  it("splits VAT so net + VAT is exactly the gross", () => {
    expect(splitVat(120_000, 2000)).toEqual({ net: 100_000, vat: 20_000 });
    const { net, vat } = splitVat(99_999, 2000);
    expect(net + vat).toBe(99_999);
    expect(splitVat(5_000, 0)).toEqual({ net: 5_000, vat: 0 });
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-12-30", 7)).toBe("2027-01-06");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("says where an invoice stands", () => {
    expect(invoiceState("issued", "2026-10-01", "2026-10-03")).toBe("overdue");
    expect(invoiceState("issued", "2026-10-03", "2026-10-03")).toBe("due_today");
    expect(invoiceState("issued", "2026-10-08", "2026-10-03")).toBe("due_soon");
    expect(invoiceState("issued", "2026-10-20", "2026-10-03")).toBe("upcoming");
    expect(invoiceState("paid", "2026-10-01", "2026-10-03")).toBe("paid");
  });
});

describe("reminderDue", () => {
  const due = "2026-10-10";
  it("sends 3 days before, on the day, and 3 and 7 days late, once each", () => {
    expect(reminderDue("2026-10-06", due, new Set())).toBeNull();
    expect(reminderDue("2026-10-07", due, new Set())).toBe("before");
    expect(reminderDue("2026-10-08", due, new Set(["before"]))).toBeNull();
    expect(reminderDue("2026-10-10", due, new Set(["before"]))).toBe("due");
    expect(reminderDue("2026-10-13", due, new Set(["before", "due"]))).toBe("overdue_3");
    expect(reminderDue("2026-10-17", due, new Set(["before", "due", "overdue_3"]))).toBe("overdue_7");
    expect(reminderDue("2026-11-30", due, new Set(["before", "due", "overdue_3", "overdue_7"]))).toBeNull();
  });

  it("only sends the latest reminder reached, never a backlog or an earlier one", () => {
    expect(reminderDue("2026-10-20", due, new Set())).toBe("overdue_7");
    expect(reminderDue("2026-10-10", due, new Set())).toBe("due");
    expect(reminderDue("2026-10-07", due, new Set(["overdue_3"]))).toBeNull();
  });
});
