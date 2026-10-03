"use client";

import * as React from "react";
import { saveQuoteChanges } from "@/app/app/quotes/actions";
import { enqueueOp, takeBatch } from "@/core/quote-ops";
import type { PaymentPlanInput, QuoteHeaderInput, QuoteOp } from "@/core/schemas";

export type SaveStatus = "saved" | "pending" | "saving" | "retrying" | "blocked";

const DEBOUNCE_MS = 500;
const RETRY_MS = [2_000, 5_000, 10_000, 30_000];

/**
 * Autosave for one quote. Edits are queued and sent half a second after the last one, one save at a time,
 * each against the version the previous save returned. If the server refuses a save (someone else changed
 * the quote, or it was sent), saving stops and `message` says why: the screen no longer matches the server,
 * so the person has to reload rather than overwrite. Network failures are retried with backoff.
 */
export function useQuoteSaver(quoteId: string, initialVersion: number) {
  const version = React.useRef(initialVersion);
  const queue = React.useRef<QuoteOp[]>([]);
  const header = React.useRef<QuoteHeaderInput | undefined>(undefined);
  const plan = React.useRef<PaymentPlanInput | undefined>(undefined);
  const inFlight = React.useRef(false);
  const blocked = React.useRef(false);
  const attempts = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [message, setMessage] = React.useState<string>();
  const [savedAt, setSavedAt] = React.useState<Date>();

  const hasWork = () => queue.current.length > 0 || header.current !== undefined || plan.current !== undefined;

  const flush = React.useCallback(async function run(): Promise<void> {
    clearTimeout(timer.current);
    if (inFlight.current || blocked.current) return;
    if (!hasWork()) return setStatus("saved");

    const { batch, rest } = takeBatch(queue.current);
    const sentHeader = header.current;
    const sentPlan = plan.current;
    queue.current = rest;
    header.current = undefined;
    plan.current = undefined;
    inFlight.current = true;
    setStatus("saving");

    let result: Awaited<ReturnType<typeof saveQuoteChanges>> | undefined;
    try {
      result = await saveQuoteChanges({ quoteId, baseVersion: version.current, header: sentHeader, ops: batch, paymentPlan: sentPlan });
    } catch {
      // Offline or the server didn't answer: put everything back in order and try again later.
      queue.current = [...batch, ...queue.current];
      header.current ??= sentHeader;
      plan.current ??= sentPlan;
      inFlight.current = false;
      const delay = RETRY_MS[Math.min(attempts.current, RETRY_MS.length - 1)];
      attempts.current++;
      setStatus("retrying");
      timer.current = setTimeout(() => void run(), delay);
      return;
    }
    inFlight.current = false;
    attempts.current = 0;
    if (!result.ok) {
      blocked.current = true;
      setStatus("blocked");
      setMessage(result.message);
      return;
    }
    version.current = result.version;
    setSavedAt(new Date());
    if (hasWork()) return run();
    setStatus("saved");
  }, [quoteId]);

  const schedule = React.useCallback(() => {
    if (blocked.current) return;
    setStatus((s) => (s === "saving" ? s : "pending"));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [flush]);

  const push = React.useCallback(
    (...ops: QuoteOp[]) => {
      for (const op of ops) queue.current = enqueueOp(queue.current, op);
      schedule();
    },
    [schedule],
  );

  const saveHeader = React.useCallback(
    (h: QuoteHeaderInput) => {
      header.current = h;
      schedule();
    },
    [schedule],
  );

  /** Replace the payment plan (the whole plan is sent; it's small). */
  const savePlan = React.useCallback(
    (p: PaymentPlanInput) => {
      plan.current = p;
      schedule();
    },
    [schedule],
  );

  // Warn before leaving with unsaved changes, and try to send them when the tab is hidden.
  React.useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (hasWork() || inFlight.current) e.preventDefault();
    };
    const hidden = () => document.visibilityState === "hidden" && void flush();
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
      clearTimeout(timer.current);
    };
  }, [flush]);

  /**
   * Save everything now and wait for it, then return the saved version (for sending exactly what's on
   * screen). Null if saving is blocked or still failing after ~15 s.
   */
  const settle = React.useCallback(async (): Promise<number | null> => {
    const deadline = Date.now() + 15_000;
    await flush();
    while (inFlight.current || hasWork()) {
      if (blocked.current || Date.now() > deadline) return null;
      await new Promise((r) => setTimeout(r, 100));
      if (!inFlight.current) await flush();
    }
    return blocked.current ? null : version.current;
  }, [flush]);

  return { push, saveHeader, savePlan, flush, settle, status, message, savedAt };
}
