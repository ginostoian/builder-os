"use client";

import * as React from "react";
import { addSiteReceiptAction, checkInAction, checkOutAction, postSiteUpdateAction, setMyTaskStatusAction, uploadSitePhoto, uploadSiteReceiptAction, type SiteActionResult } from "@/app/m/actions";
import type { TaskStatus } from "@/core/projects";
import { all, newId, remove, save, subscribe, type Op, type OpBody } from "./outbox";

/**
 * Sending site app changes: straight away when there's signal, or into the phone's outbox when there
 * isn't (or the connection drops part-way). The outbox is sent in order as soon as the phone is back
 * online. Every change carries an id, so a resend never doubles anything up.
 */

export type SendResult = { status: "sent"; id?: string; warning?: string } | { status: "queued" } | { status: "failed"; message: string };

/** Thrown for a dropped connection (as opposed to the server saying no). */
class Offline extends Error {}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Offline();
  try {
    return await fn();
  } catch {
    // A failed fetch, a timeout or a sign-in hiccup: try again later rather than lose it.
    throw new Offline();
  }
}

/** Runs one change, step by step. `persist` saves progress (e.g. photos already uploaded) as it goes. */
async function run(op: Op, queued: boolean, persist: boolean): Promise<SiteActionResult & { warning?: string }> {
  const meta = { opId: op.id, at: op.at, queued };
  switch (op.kind) {
    case "check_in":
      return call(() => checkInAction(op.projectId, op.geo, meta));
    case "check_out":
      return call(() => checkOutAction(op.geo, meta));
    case "task":
      return call(() => setMyTaskStatusAction(op.taskId, op.status as TaskStatus, op.reason, meta));
    case "update":
    case "receipt": {
      let parentId = op.kind === "update" ? op.entryId : op.expenseId;
      if (!parentId) {
        const r = await call(() => (op.kind === "update" ? postSiteUpdateAction(op.projectId, op.body, meta) : addSiteReceiptAction(op.projectId, op.input, meta)));
        if (!r.ok || !r.id) return r.ok ? { ok: false, message: "Couldn't save that. Try again." } : r;
        parentId = r.id;
        if (op.kind === "update") op.entryId = parentId;
        else op.expenseId = parentId;
        if (persist) await save(op);
      }
      let warning: string | undefined;
      while (op.photos.length) {
        const p = op.photos[0];
        const form = new FormData();
        form.set("opId", p.opId);
        if (op.kind === "update") {
          form.set("projectId", op.projectId);
          form.set("entryId", parentId);
          form.set("photo", new File([p.blob], p.name, { type: p.type }));
        } else {
          form.set("expenseId", parentId);
          form.set("file", new File([p.blob], p.name, { type: p.type }));
        }
        const u = await call(() => (op.kind === "update" ? uploadSitePhoto(form) : uploadSiteReceiptAction(form)));
        // Turned down (too big, wrong type): skip that photo, but say so.
        if (!u.ok) warning = u.message;
        op.photos.shift();
        if (persist) await save(op);
      }
      return { ok: true, id: parentId, warning };
    }
  }
}

/**
 * Send a change now, or queue it. A change queued earlier must go first (a check-out can't overtake its
 * check-in), so if anything is waiting this one waits too.
 */
export async function send(memberId: string, body: OpBody): Promise<SendResult> {
  const waiting = (await all()).some((o) => o.memberId === memberId && !o.failed);
  const op = { ...body, id: newId(), at: new Date().toISOString(), memberId, seq: Date.now() } as Op;
  if (!waiting) {
    try {
      const r = await run(op, false, false);
      return r.ok ? { status: "sent", id: r.id, warning: r.warning } : { status: "failed", message: r.message };
    } catch (e) {
      if (!(e instanceof Offline)) throw e;
    }
  }
  // Keep what's done (e.g. the update was posted but a photo wasn't) and finish it later.
  await save(op);
  void flush(memberId);
  return { status: "queued" };
}

let flushing: Promise<number> | null = null;

/** Sends everything waiting, in order. Stops at the first dropped connection. Returns how many went. */
export function flush(memberId: string): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
    // Make sure the sign-in is fresh after a long time offline.
    try {
      await (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<unknown> } } }).Clerk?.session?.getToken?.();
    } catch {
      return 0;
    }
    for (const op of await all()) {
      if (op.memberId !== memberId || op.failed) continue;
      try {
        const r = await run(op, true, true);
        if (r.ok) {
          await remove(op.id);
          sent++;
        } else {
          await save({ ...op, failed: r.message });
        }
      } catch (e) {
        if (e instanceof Offline) break;
        throw e;
      }
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** What's waiting in the outbox for this person, kept up to date. */
export function useOutbox(memberId: string | undefined) {
  const [ops, setOps] = React.useState<Op[]>([]);
  React.useEffect(() => {
    if (!memberId) return;
    let live = true;
    const load = () => void all().then((o) => live && setOps(o.filter((x) => x.memberId === memberId)));
    load();
    const off = subscribe(load);
    return () => {
      live = false;
      off();
    };
  }, [memberId]);
  return ops;
}
