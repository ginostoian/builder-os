import { describe, expect, it } from "vitest";
import { MAX_PATCH_OPS } from "./limits";
import { placeAt, quoteRef } from "./quote";
import { enqueueOp, takeBatch } from "./quote-ops";
import type { QuoteOp } from "./schemas";

const L = "6f1c2b1e-8a4e-4b4b-9a51-1b2c3d4e5f60";
const M = "7a2d3c2f-9b5f-4c5c-8b62-2c3d4e5f6071";
const qty = (lineId: string, value: number): QuoteOp => ({ op: "updateLine", lineId, change: { field: "qty", value } });

describe("enqueueOp", () => {
  it("merges repeated edits to the same cell", () => {
    let q: QuoteOp[] = [];
    q = enqueueOp(q, qty(L, 1));
    q = enqueueOp(q, qty(M, 5));
    q = enqueueOp(q, qty(L, 12));
    expect(q).toEqual([qty(L, 12), qty(M, 5)]);
  });

  it("keeps edits to different fields and doesn't jump over a move", () => {
    let q: QuoteOp[] = [qty(L, 1), { op: "moveLine", lineId: L, sectionId: M, position: 0 }];
    q = enqueueOp(q, qty(L, 2));
    expect(q.map((o) => o.op)).toEqual(["updateLine", "moveLine", "updateLine"]);
    q = enqueueOp(q, { op: "updateLine", lineId: L, change: { field: "unit", value: "m" } });
    expect(q).toHaveLength(4);
  });

  it("merges section renames", () => {
    const q = enqueueOp([{ op: "renameSection", sectionId: M, name: "A" }], { op: "renameSection", sectionId: M, name: "B" });
    expect(q).toEqual([{ op: "renameSection", sectionId: M, name: "B" }]);
  });
});

describe("takeBatch", () => {
  it("splits big queues into allowed patch sizes", () => {
    const ops = Array.from({ length: MAX_PATCH_OPS + 3 }, (_, i) => qty(L, i));
    const { batch, rest } = takeBatch(ops);
    expect(batch).toHaveLength(MAX_PATCH_OPS);
    expect(rest).toHaveLength(3);
  });
});

describe("quote helpers", () => {
  it("formats quote numbers", () => {
    expect(quoteRef(7)).toBe("Q-0007");
    expect(quoteRef(12345)).toBe("Q-12345");
  });

  it("places an id at a clamped position", () => {
    expect(placeAt(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(placeAt(["a", "b"], "x", 99)).toEqual(["a", "b", "x"]);
    expect(placeAt(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });
});
