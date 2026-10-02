/**
 * The quote builder's pending-op queue. Pure, so it can be unit-tested away from React.
 */
import { MAX_PATCH_OPS } from "./limits";
import type { QuoteOp } from "./schemas";

/**
 * Add `op` to the queue. A later edit to the same line and field replaces the earlier one in place (typing
 * "1", "12", "125" sends one change), as does renaming the same section again. Nothing else is reordered.
 */
export function enqueueOp(queue: readonly QuoteOp[], op: QuoteOp): QuoteOp[] {
  const same = queue.findIndex(
    (q) =>
      (op.op === "updateLine" && q.op === "updateLine" && q.lineId === op.lineId && q.change.field === op.change.field) ||
      (op.op === "renameSection" && q.op === "renameSection" && q.sectionId === op.sectionId),
  );
  if (same === -1) return [...queue, op];
  // Only replace in place if nothing after it touches the same line or section (a move or removal).
  const target = op.op === "updateLine" ? op.lineId : op.op === "renameSection" ? op.sectionId : "";
  const later = queue.slice(same + 1).some((q) => JSON.stringify(q).includes(target));
  if (later) return [...queue, op];
  return queue.map((q, i) => (i === same ? op : q));
}

/** The next batch to send (at most `MAX_PATCH_OPS`) and what stays queued. */
export function takeBatch(queue: readonly QuoteOp[]): { batch: QuoteOp[]; rest: QuoteOp[] } {
  return { batch: queue.slice(0, MAX_PATCH_OPS), rest: queue.slice(MAX_PATCH_OPS) };
}
