import { describe, expect, it } from "vitest";
import { buildSnapshot, canonicalJson, isExpired } from "./quote-snapshot";
import { portalCommentInput, portalDecisionInput } from "./schemas";

const input = {
  company: { name: "Hale & Sons", tradingName: null, vatNumber: "GB123456789", logoUrl: null, brandColour: null, terms: "30 days" },
  clientName: "Sarah",
  quote: { number: 7, title: "Kitchen", siteAddress: null, validUntil: "2026-10-31", vatRateBps: 2000 },
  versionNo: 1,
  sections: [
    {
      id: "s1",
      name: "Prep",
      lines: [
        { id: "l1", name: "Skim", qty: 6.2, unit: "m²", ratePence: 1_450, markupBps: 1500, note: "Two coats", noteVisible: true, kind: "normal" },
        { id: "l2", name: "Board", qty: 3, unit: "m²", ratePence: 1_333, markupBps: 1250, note: "Internal only", noteVisible: false, kind: "normal" },
      ],
    },
  ],
};

describe("buildSnapshot", () => {
  it("keeps only what the client should see, priced at selling rates", () => {
    const s = buildSnapshot(input);
    expect(s.sections[0].lines).toEqual([
      { id: "l1", name: "Skim", qty: 6.2, unit: "m²", unitPrice: 1_668, total: 10_342, note: "Two coats", kind: "normal" },
      { id: "l2", name: "Board", qty: 3, unit: "m²", unitPrice: 1_500, total: 4_500, note: null, kind: "normal" },
    ]);
    expect(JSON.stringify(s)).not.toMatch(/markup|ratePence|Internal only/i);
    expect(s.sections[0].total).toBe(14_842);
    expect(s.totals).toEqual({ net: 14_842, vat: 2_968, total: 17_810 });
    expect(s.quote).toMatchObject({ ref: "Q-0007", versionNo: 1 });
  });

  it("makes each line's total equal quantity × the unit price shown", () => {
    for (const l of buildSnapshot(input).sections[0].lines) expect(l.total).toBe(Math.round(l.qty * l.unitPrice));
  });
});

describe("canonicalJson", () => {
  it("is the same whatever the key order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe(canonicalJson({ a: [{ c: null, d: 2 }], b: 1 }));
    expect(canonicalJson({ a: undefined, b: "x" })).toBe('{"b":"x"}');
  });
});

describe("isExpired", () => {
  it("counts the whole valid-until day in UK time", () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired("2026-10-31", new Date("2026-10-31T23:30:00Z"))).toBe(false); // 23:30 GMT on the 31st
    expect(isExpired("2026-06-30", new Date("2026-06-30T23:30:00Z"))).toBe(true); // 00:30 BST on 1 July
    expect(isExpired("2026-10-31", new Date("2026-11-01T00:00:01Z"))).toBe(true);
  });
});

describe("portal inputs", () => {
  it("needs an explicit agreement to accept, and a signature", () => {
    expect(portalDecisionInput.safeParse({ decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }).success).toBe(true);
    expect(portalDecisionInput.safeParse({ decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: false }).success).toBe(false);
    expect(portalDecisionInput.safeParse({ decision: "accepted", fullName: "Sarah Hale", agree: true }).success).toBe(false);
    expect(portalDecisionInput.safeParse({ decision: "declined", fullName: "Sarah Hale" }).success).toBe(true);
  });

  it("rejects empty comments and unknown keys", () => {
    expect(portalCommentInput.safeParse({ name: "Sarah", body: "   " }).success).toBe(false);
    expect(portalCommentInput.safeParse({ name: "Sarah", body: "Can we use oak?", orgId: "x" }).success).toBe(false);
  });
});
