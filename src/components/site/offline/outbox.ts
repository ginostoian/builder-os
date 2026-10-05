"use client";

/**
 * The site app's outbox: changes made with no signal, kept on the phone (IndexedDB, photos included)
 * until they can be sent. Each change has its own id and the time it really happened, so sending it twice
 * does nothing the second time and the office sees the right times.
 */

export type Geo = { lat: number; lng: number } | undefined;
export type QueuedPhoto = { opId: string; blob: Blob; name: string; type: string };
export type ReceiptInput = { description: string; supplier?: string; totalPence: number; includesVat: boolean; forClient: boolean };

export type OpBody =
  | { kind: "check_in"; projectId: string; projectName: string; geo?: Geo }
  | { kind: "check_out"; geo?: Geo }
  | { kind: "task"; taskId: string; status: string; reason?: string }
  | { kind: "update"; projectId: string; projectName: string; body: string; photos: QueuedPhoto[]; entryId?: string }
  | { kind: "receipt"; projectId: string; projectName: string; input: ReceiptInput; photos: QueuedPhoto[]; expenseId?: string };

export type Op = OpBody & {
  id: string;
  /** When it happened, from the phone's clock (ISO). */
  at: string;
  memberId: string;
  /** Order they were made in. */
  seq: number;
  /** Set when the office's system turned it down (it won't be retried). */
  failed?: string;
};

const DB = "builderos-site";
const STORE = "outbox";
const CHANNEL = "builderos-outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => (db.close(), resolve(req ? req.result : undefined));
    t.onerror = () => (db.close(), reject(t.error));
    t.onabort = () => (db.close(), reject(t.error));
  });
}

// Other tabs (and this one) hear about every change, so counts and screens stay in step.
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
function changed() {
  for (const l of listeners) l();
  channel?.postMessage("changed");
}
export function subscribe(fn: () => void): () => void {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => listeners.forEach((l) => l());
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const newId = () => crypto.randomUUID();

export async function all(): Promise<Op[]> {
  try {
    const ops = ((await tx("readonly", (s) => s.getAll())) ?? []) as Op[];
    return ops.sort((a, b) => a.seq - b.seq);
  } catch {
    // Private browsing on some phones has no IndexedDB: nothing queued.
    return [];
  }
}

export async function save(op: Op) {
  await tx("readwrite", (s) => s.put(op));
  changed();
}

export async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  changed();
}

/** Clears everything (signing out, or another person signing in on this phone). */
export async function clearAll() {
  try {
    await tx("readwrite", (s) => s.clear());
    changed();
  } catch {
    /* nothing stored */
  }
}
