/**
 * Xero: the company's connection, which Xero record each of ours became, and the queue of invoices to bring
 * up to date in Xero. Runs in the tenant transaction like everything else. Tokens arrive here already
 * encrypted (src/server/xero/tokens.ts).
 */
import "server-only";
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import type { XeroSettings } from "@/core/xero";
import type { Tx } from "./index";
import { invoices, xeroConnections, xeroJobs, xeroLinks } from "./schema";

export type XeroConnection = typeof xeroConnections.$inferSelect;
export type XeroLinkKind = (typeof xeroLinks.$inferSelect)["kind"];

// ── Connection ───────────────────────────────────────────────────────────────

export async function getXeroConnection(tx: Tx, orgId: string): Promise<XeroConnection | undefined> {
  const [c] = await tx.select().from(xeroConnections).where(eq(xeroConnections.orgId, orgId));
  return c;
}

/** The connection row, locked until the transaction ends: one token refresh at a time per company. */
export async function lockXeroConnection(tx: Tx, orgId: string): Promise<XeroConnection | undefined> {
  const [c] = await tx.select().from(xeroConnections).where(eq(xeroConnections.orgId, orgId)).for("update");
  return c;
}

/**
 * Save a new or renewed connection. Connecting a different Xero organisation forgets the old links and
 * queue (those records live in the other organisation); reconnecting the same one keeps them.
 */
export async function saveXeroConnection(
  tx: Tx,
  orgId: string,
  c: { tenantId: string; tenantName: string; connectionId: string; accessToken: string; refreshToken: string; accessExpiresAt: Date; memberId: string },
) {
  const existing = await getXeroConnection(tx, orgId);
  const sameOrganisation = existing?.tenantId === c.tenantId;
  if (existing && !sameOrganisation) {
    await tx.delete(xeroLinks).where(eq(xeroLinks.orgId, orgId));
    await tx.delete(xeroJobs).where(eq(xeroJobs.orgId, orgId));
  }
  const values = {
    tenantId: c.tenantId,
    tenantName: c.tenantName.slice(0, 200) || "Xero",
    connectionId: c.connectionId,
    accessToken: c.accessToken,
    refreshToken: c.refreshToken,
    accessExpiresAt: c.accessExpiresAt,
    status: "active" as const,
    lastError: null,
    connectedByMemberId: c.memberId,
    // Keep the choices made last time when it's the same organisation; otherwise they're set up next.
    settings: sameOrganisation ? (existing?.settings ?? null) : null,
  };
  await tx
    .insert(xeroConnections)
    .values({ orgId, ...values })
    .onConflictDoUpdate({ target: xeroConnections.orgId, set: values });
}

export async function saveXeroTokens(tx: Tx, orgId: string, t: { accessToken: string; refreshToken: string; accessExpiresAt: Date }) {
  await tx
    .update(xeroConnections)
    .set({ ...t, status: "active" })
    .where(eq(xeroConnections.orgId, orgId));
}

/** Xero won't accept our tokens any more: someone needs to connect again. */
export async function markXeroReconnect(tx: Tx, orgId: string, message: string) {
  await tx
    .update(xeroConnections)
    .set({ status: "reconnect", lastError: message.slice(0, 1000) })
    .where(eq(xeroConnections.orgId, orgId));
}

export async function saveXeroSettings(tx: Tx, orgId: string, settings: XeroSettings, vatRegistered?: boolean): Promise<boolean> {
  const rows = await tx
    .update(xeroConnections)
    .set({ settings, ...(vatRegistered === undefined ? {} : { vatRegistered }) })
    .where(eq(xeroConnections.orgId, orgId))
    .returning({ orgId: xeroConnections.orgId });
  return rows.length > 0;
}

export async function noteXeroSynced(tx: Tx, orgId: string, error: string | null) {
  await tx
    .update(xeroConnections)
    .set({ lastSyncedAt: new Date(), lastError: error?.slice(0, 1000) ?? null })
    .where(eq(xeroConnections.orgId, orgId));
}

/** Forget the connection and its queue. Links stay, so reconnecting the same organisation carries on. */
export async function deleteXeroConnection(tx: Tx, orgId: string) {
  await tx.delete(xeroJobs).where(eq(xeroJobs.orgId, orgId));
  await tx.delete(xeroConnections).where(eq(xeroConnections.orgId, orgId));
}

// ── Links ────────────────────────────────────────────────────────────────────

export async function xeroLink(tx: Tx, orgId: string, kind: XeroLinkKind, localId: string): Promise<string | null> {
  const [l] = await tx
    .select({ xeroId: xeroLinks.xeroId })
    .from(xeroLinks)
    .where(and(eq(xeroLinks.orgId, orgId), eq(xeroLinks.kind, kind), eq(xeroLinks.localId, localId)));
  return l?.xeroId ?? null;
}

export async function setXeroLink(tx: Tx, orgId: string, kind: XeroLinkKind, localId: string, xeroId: string) {
  await tx
    .insert(xeroLinks)
    .values({ orgId, kind, localId, xeroId })
    .onConflictDoUpdate({ target: [xeroLinks.orgId, xeroLinks.kind, xeroLinks.localId], set: { xeroId, createdAt: new Date() } });
}

export async function removeXeroLink(tx: Tx, orgId: string, kind: XeroLinkKind, localId: string) {
  await tx.delete(xeroLinks).where(and(eq(xeroLinks.orgId, orgId), eq(xeroLinks.kind, kind), eq(xeroLinks.localId, localId)));
}

/** Our invoice behind a Xero invoice id (for webhooks). */
export async function invoiceForXeroId(tx: Tx, orgId: string, xeroInvoiceId: string): Promise<string | null> {
  const [l] = await tx
    .select({ localId: xeroLinks.localId })
    .from(xeroLinks)
    .where(and(eq(xeroLinks.orgId, orgId), eq(xeroLinks.kind, "invoice"), eq(xeroLinks.xeroId, xeroInvoiceId)));
  return l?.localId ?? null;
}

// ── Queue ────────────────────────────────────────────────────────────────────

/**
 * Ask for an invoice to be brought up to date in Xero. One open job per invoice: asking again while one is
 * waiting just makes it due now (and gives a stuck one a fresh set of tries).
 */
export async function queueXeroInvoice(tx: Tx, orgId: string, invoiceId: string) {
  const connected = await getXeroConnection(tx, orgId);
  if (!connected?.settings) return false;
  // Example invoices from onboarding never go to Xero.
  const [inv] = await tx.select({ isSample: invoices.isSample }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
  if (!inv || inv.isSample) return false;
  const reopened = await tx
    .update(xeroJobs)
    .set({ status: "pending", runAfter: new Date(), attempts: sql`case when ${xeroJobs.status} = 'failed' then 0 else ${xeroJobs.attempts} end` })
    .where(and(eq(xeroJobs.orgId, orgId), eq(xeroJobs.invoiceId, invoiceId), ne(xeroJobs.status, "done")))
    .returning({ id: xeroJobs.id });
  if (reopened.length === 0) await tx.insert(xeroJobs).values({ orgId, invoiceId }).onConflictDoNothing();
  return true;
}

/** Queue every invoice issued since a date (for a first sync, or after changing the start date). */
export async function queueXeroInvoicesSince(tx: Tx, orgId: string, from: string): Promise<number> {
  const rows = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.isSample, false), sql`${invoices.issueDate} >= ${from}`))
    .orderBy(asc(invoices.number))
    .limit(2_000);
  for (const r of rows) await queueXeroInvoice(tx, orgId, r.id);
  return rows.length;
}

/** How long a run may take over a job before another run can pick it up (it crashed, or timed out). */
const LEASE_MS = 5 * 60_000;

/**
 * Take the jobs due now, oldest first. Each is leased (pushed back a few minutes) rather than locked, so
 * the work with Xero happens outside any database transaction and two runs never do the same job.
 */
export async function claimXeroJobs(tx: Tx, orgId: string, now: Date, limit: number) {
  const due = tx
    .select({ id: xeroJobs.id })
    .from(xeroJobs)
    .where(and(eq(xeroJobs.orgId, orgId), eq(xeroJobs.status, "pending"), lte(xeroJobs.runAfter, now)))
    .orderBy(asc(xeroJobs.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });
  return tx
    .update(xeroJobs)
    .set({ runAfter: new Date(now.getTime() + LEASE_MS) })
    .where(and(eq(xeroJobs.orgId, orgId), inArray(xeroJobs.id, due)))
    .returning({ id: xeroJobs.id, invoiceId: xeroJobs.invoiceId, attempts: xeroJobs.attempts });
}

export async function finishXeroJob(tx: Tx, orgId: string, jobId: string, note: string | null = null) {
  await tx
    .update(xeroJobs)
    .set({ status: "done", doneAt: new Date(), lastError: note?.slice(0, 1000) ?? null })
    .where(and(eq(xeroJobs.orgId, orgId), eq(xeroJobs.id, jobId)));
}

/** A failed try: wait until `retryAt`, or with none, stop until someone presses Retry. */
export async function failXeroJob(tx: Tx, orgId: string, jobId: string, attempts: number, error: string, retryAt: Date | null) {
  await tx
    .update(xeroJobs)
    .set(retryAt ? { attempts, lastError: error.slice(0, 1000), runAfter: retryAt } : { attempts, lastError: error.slice(0, 1000), status: "failed" })
    .where(and(eq(xeroJobs.orgId, orgId), eq(xeroJobs.id, jobId)));
}

/** Retry everything that's stuck. */
export async function retryFailedXeroJobs(tx: Tx, orgId: string): Promise<number> {
  const rows = await tx
    .update(xeroJobs)
    .set({ status: "pending", attempts: 0, runAfter: new Date() })
    .where(and(eq(xeroJobs.orgId, orgId), eq(xeroJobs.status, "failed")))
    .returning({ id: xeroJobs.id });
  return rows.length;
}

/** The sync log: recent jobs with their invoice, newest first, plus counts. */
export async function xeroActivity(tx: Tx, orgId: string, limit = 30) {
  const recent = await tx
    .select({
      id: xeroJobs.id,
      status: xeroJobs.status,
      attempts: xeroJobs.attempts,
      lastError: xeroJobs.lastError,
      runAfter: xeroJobs.runAfter,
      updatedAt: xeroJobs.updatedAt,
      invoiceId: xeroJobs.invoiceId,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
      totalPence: invoices.totalPence,
    })
    .from(xeroJobs)
    .innerJoin(invoices, and(eq(invoices.orgId, xeroJobs.orgId), eq(invoices.id, xeroJobs.invoiceId)))
    .where(eq(xeroJobs.orgId, orgId))
    .orderBy(desc(xeroJobs.updatedAt))
    .limit(limit);
  const counts = await tx
    .select({ status: xeroJobs.status, n: sql<number>`count(*)::int` })
    .from(xeroJobs)
    .where(eq(xeroJobs.orgId, orgId))
    .groupBy(xeroJobs.status);
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  return { recent, pending: n("pending"), failed: n("failed"), done: n("done") };
}

/** Clear finished jobs older than 90 days so the log stays short. */
export async function pruneXeroJobs(tx: Tx, orgId: string) {
  await tx.delete(xeroJobs).where(and(eq(xeroJobs.orgId, orgId), eq(xeroJobs.status, "done"), sql`${xeroJobs.doneAt} < now() - interval '90 days'`));
}
