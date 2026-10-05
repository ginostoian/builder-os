"use server";

import { revalidatePath } from "next/cache";
import { MAX_PHOTO_BYTES, orgFileKey, sniffImage } from "@/core/files";
import { ukToday } from "@/core/payment-plan";
import { TASK_STATUSES, type TaskStatus } from "@/core/projects";
import { can } from "@/core/roles";
import { geoInput, id, multiLine, pence, singleLine } from "@/core/schemas";
import { vatInGross } from "@/core/costs";
import { TEXT } from "@/core/limits";
import { ProjectError, addDiaryEntry, addDiaryPhoto } from "@/db/projects";
import { CostError, addReceipt, createExpense } from "@/db/costs";
import { SiteError, checkIn, checkOut, claimSyncOp, isMyJob, recordSyncResult, setMyTaskStatus, workerForMember } from "@/db/site";
import { londonDay } from "@/core/team";
import { z } from "zod";
import type { Tx } from "@/db";
import { getSession, withSession, type Session } from "@/auth/session";
import { hasFeature, upgradeMessage } from "@/server/plan";
import { and, eq } from "drizzle-orm";
import { formatGBP } from "@/core/money";
import { membersWithRoles, notify } from "@/db/notifications";
import { projects, siteSyncOps, workers } from "@/db/schema";
import { storeReceipt } from "@/server/receipts";
import { deleteObject, putObject, randomName, storageConfigured } from "@/server/storage";

/**
 * What a worker does from their phone. Every action works out who they are from the session and only
 * touches their own tasks, their own visits and the jobs they're on.
 */

export type SiteActionResult = { ok: true; id?: string } | { ok: false; message: string };

type Me = { session: Session; workerId: string; memberId: string };

const MESSAGES = {
  no_worker: "You're not on the team list yet. Ask the office to add you.",
  not_found: "This was removed or changed in the office. Pull down to refresh.",
  not_yours: "That isn't one of your jobs any more. Pull down to refresh.",
  not_allowed: "Your login can't use the site app.",
} as const;

async function me(): Promise<Me | { ok: false; message: string }> {
  const session = await getSession();
  if (!can(session.role, "site.app")) return { ok: false, message: MESSAGES.not_allowed };
  if (!(await hasFeature("site_app"))) return { ok: false, message: upgradeMessage("site_app") };
  const w = await withSession(session, (tx) => workerForMember(tx, session.orgId, session.memberId));
  if (!w) return { ok: false, message: MESSAGES.no_worker };
  return { session, workerId: w.id, memberId: session.memberId };
}

async function run(fn: (m: Me) => Promise<string | void>, ...paths: string[]): Promise<SiteActionResult> {
  const m = await me();
  if ("ok" in m) return m;
  let result: string | void;
  try {
    result = await fn(m);
  } catch (error) {
    if (error instanceof SiteError) return { ok: false, message: MESSAGES[error.reason] };
    if (error instanceof ProjectError) return { ok: false, message: error.reason === "too_many_photos" ? "That update has as many photos as it can take. Post another one." : MESSAGES.not_found };
    throw error;
  }
  revalidatePath("/m", "layout");
  for (const p of paths) revalidatePath(p);
  return { ok: true, id: result || undefined };
}

const reasonInput = multiLine(200).optional();

/**
 * Something done in the site app with no signal, sent once the phone is back online: its id (so a resend
 * does nothing) and when it really happened (from the phone; up to a week ago, not in the future).
 */
export type SyncMeta = { opId: string; at: string; queued: boolean };
const syncInput = z.strictObject({ opId: id, at: z.iso.datetime({ offset: true }), queued: z.boolean() });
const MAX_OFFLINE_DAYS = 7;

function parseSync(sync: unknown): { opId: string; at: Date; queued: boolean } | undefined | "bad" {
  if (sync === undefined || sync === null) return undefined;
  const p = syncInput.safeParse(sync);
  if (!p.success) return "bad";
  const now = Date.now();
  // Sent straight away: the server's clock decides, as always. Only a queued change uses the phone's.
  if (!p.data.queued) return { opId: p.data.opId, at: new Date(now), queued: false };
  const at = new Date(p.data.at);
  // A phone clock a little ahead is fine (it's clamped to now); a week-old change is too stale to trust.
  if (at.getTime() < now - MAX_OFFLINE_DAYS * 86_400_000) return "bad";
  return { opId: p.data.opId, at: new Date(Math.min(at.getTime(), now)), queued: true };
}

/** A photo sent from the offline outbox carries its own op id. */
function optionalOpId(form: FormData): string | undefined | "bad" {
  const v = form.get("opId");
  if (v === null) return undefined;
  return typeof v === "string" && id.safeParse(v).success ? v : "bad";
}

/** Whether an offline op already went through (checked before uploading anything). */
async function syncSeen(tx: Tx, m: Me, opId: string) {
  const [row] = await tx.select({ memberId: siteSyncOps.memberId }).from(siteSyncOps).where(and(eq(siteSyncOps.orgId, m.session.orgId), eq(siteSyncOps.id, opId)));
  return Boolean(row);
}

const STALE = "This was saved on your phone too long ago to send. Tell the office what happened.";

/**
 * Runs a change once: the first time an offline op arrives it goes ahead (and may record what it made);
 * a resend returns what the first one made. Changes made online skip all this.
 */
async function once(tx: Tx, m: Me, sync: { opId: string } | undefined, fn: () => Promise<string | void>): Promise<string | void> {
  if (!sync) return fn();
  const done = await claimSyncOp(tx, m.session.orgId, m.memberId, sync.opId);
  if (done) return done.resultId ?? undefined;
  const result = await fn();
  // Remember what it made (an update or receipt id), so a resend's photos still find it.
  if (result && id.safeParse(result).success) await recordSyncResult(tx, m.session.orgId, sync.opId, result);
  return result;
}

export async function setMyTaskStatusAction(taskId: string, status: TaskStatus, reason?: string, sync?: SyncMeta): Promise<SiteActionResult> {
  if (!id.safeParse(taskId).success || !TASK_STATUSES.includes(status)) return { ok: false, message: MESSAGES.not_found };
  const r = reasonInput.safeParse(reason?.trim() || undefined);
  if (!r.success) return { ok: false, message: "Keep the reason short." };
  const off = parseSync(sync);
  if (off === "bad") return { ok: false, message: STALE };
  let projectId = "";
  const result = await run(async (m) => {
    await withSession(m.session, (tx) =>
      once(tx, m, off, async () => {
        projectId = await setMyTaskStatus(tx, m.session.orgId, m.workerId, taskId, status, r.data, off ? londonDay(off.at) : ukToday(), off?.at);
      }),
    );
  });
  if (result.ok) revalidatePath(`/app/projects/${projectId}`);
  return result;
}

export async function checkInAction(projectId: string, geo?: unknown, sync?: SyncMeta): Promise<SiteActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, message: MESSAGES.not_found };
  const g = geoInput.safeParse(geo ?? undefined);
  const off = parseSync(sync);
  if (off === "bad") return { ok: false, message: STALE };
  return run((m) => withSession(m.session, (tx) => once(tx, m, off, () => checkIn(tx, m.session.orgId, m, projectId, g.success ? g.data : undefined, off))), "/app/team");
}

export async function checkOutAction(geo?: unknown, sync?: SyncMeta): Promise<SiteActionResult> {
  const g = geoInput.safeParse(geo ?? undefined);
  const off = parseSync(sync);
  if (off === "bad") return { ok: false, message: STALE };
  return run(async (m) => {
    await withSession(m.session, (tx) =>
      once(tx, m, off, async () => {
        await checkOut(tx, m.session.orgId, m.workerId, g.success ? g.data : undefined, off);
      }),
    );
  }, "/app/team");
}

/** Post a site update to a job's diary. The office decides whether the client sees it. */
export async function postSiteUpdateAction(projectId: string, body: string, sync?: SyncMeta): Promise<SiteActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, message: MESSAGES.not_found };
  const text = multiLine(TEXT.note).safeParse(body.trim() || "Photos from site");
  if (!text.success) return { ok: false, message: "That update is too long." };
  const off = parseSync(sync);
  if (off === "bad") return { ok: false, message: STALE };
  return run(async (m) => {
    return withSession(m.session, (tx) =>
      once(tx, m, off, async () => {
        if (!(await isMyJob(tx, m.session.orgId, m, projectId))) throw new SiteError("not_yours");
        return addDiaryEntry(tx, m.session.orgId, { projectId, entryDate: off ? londonDay(off.at) : ukToday(), body: text.data, shareWithClient: false }, m.memberId);
      }),
    );
  }, `/app/projects/${projectId}`);
}

class StoreError extends Error {}

/** Add a photo (shrunk on the phone first) to an update I just posted. */
export async function uploadSitePhoto(form: FormData): Promise<SiteActionResult> {
  if (!storageConfigured()) return { ok: false, message: "Photo storage isn't set up yet. Ask the office." };
  const projectId = form.get("projectId");
  const entryId = form.get("entryId");
  const file = form.get("photo");
  if (typeof projectId !== "string" || !id.safeParse(projectId).success || typeof entryId !== "string" || !id.safeParse(entryId).success) return { ok: false, message: MESSAGES.not_found };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "That photo is too large." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, message: "Use a JPEG, PNG or WebP photo." };
  const opId = optionalOpId(form);
  if (opId === "bad") return { ok: false, message: MESSAGES.not_found };
  return run(async (m) => {
    const mine = await withSession(m.session, async (tx) => (await isMyJob(tx, m.session.orgId, m, projectId)) && !(opId && (await syncSeen(tx, m, opId))));
    if (!mine) return;
    const key = orgFileKey(m.session.orgId, "photos", randomName(), type.ext);
    const stored = await putObject(key, bytes, type.mime);
    if (!stored.ok) throw new StoreError(stored.message);
    try {
      const added = await withSession(m.session, (tx) => once(tx, m, opId ? { opId } : undefined, () => addDiaryPhoto(tx, m.session.orgId, projectId, entryId, key, { memberId: m.session.memberId }).then(() => key)));
      // A resend that raced the first one: keep theirs, drop ours.
      if (added !== key) await deleteObject(key);
    } catch (error) {
      await deleteObject(key);
      throw error;
    }
  }, `/app/projects/${projectId}`).catch((error: unknown) => {
    if (error instanceof StoreError) return { ok: false as const, message: error.message };
    throw error;
  });
}

// ── Receipts ─────────────────────────────────────────────────────────────────

const receiptInput = {
  description: singleLine(TEXT.line),
  supplier: singleLine(TEXT.name).optional(),
  totalPence: pence,
};

/**
 * Log something bought for a job, from the receipt in hand: what, where from, how much. It goes into the
 * job's costs for the office to check. "Includes VAT" assumes 20%; "for the client" marks it to bill back.
 */
export async function addSiteReceiptAction(projectId: string, input: { description: string; supplier?: string; totalPence: number; includesVat: boolean; forClient: boolean }, sync?: SyncMeta): Promise<SiteActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, message: MESSAGES.not_found };
  const description = receiptInput.description.safeParse((input.description ?? "").trim());
  const supplier = receiptInput.supplier.safeParse(input.supplier?.trim() || undefined);
  const total = receiptInput.totalPence.safeParse(input.totalPence);
  if (!description.success) return { ok: false, message: "Say what you bought." };
  if (!supplier.success) return { ok: false, message: "Check the shop's name." };
  if (!total.success || total.data === 0) return { ok: false, message: "Enter the total from the receipt." };
  const off = parseSync(sync);
  if (off === "bad") return { ok: false, message: STALE };
  return run(
    (m) =>
      withSession(m.session, (tx) => once(tx, m, off, async () => {
        if (!(await isMyJob(tx, m.session.orgId, m, projectId))) throw new SiteError("not_yours");
        const expenseId = await createExpense(
          tx,
          m.session.orgId,
          {
            projectId,
            category: "materials",
            supplier: supplier.data,
            description: description.data,
            spentOn: off ? londonDay(off.at) : ukToday(),
            totalPence: total.data,
            vatPence: input.includesVat === true ? vatInGross(total.data, 2000) : 0,
            rechargeable: input.forClient === true,
            rechargeMarkupBps: 0,
          },
          m.memberId,
        );
        const office = await membersWithRoles(tx, m.session.orgId, ["admin", "office"]);
        const who = await tx.select({ name: workers.name }).from(workers).where(and(eq(workers.orgId, m.session.orgId), eq(workers.id, m.workerId)));
        const job = await tx.select({ name: projects.name }).from(projects).where(and(eq(projects.orgId, m.session.orgId), eq(projects.id, projectId)));
        await notify(
          tx,
          m.session.orgId,
          office,
          {
            kind: "receipt_added",
            title: `${who[0]?.name ?? "Someone"} logged ${formatGBP(total.data)}: ${description.data}`,
            body: [job[0]?.name, input.forClient === true ? "To bill back to the client" : null].filter(Boolean).join(" · "),
            href: `/app/projects/${projectId}?view=costs`,
          },
          m.memberId,
        );
        return expenseId;
      })),
    `/app/projects/${projectId}`,
    "/app/purchases",
  );
}

/** A photo (or PDF) of a receipt I just logged. */
export async function uploadSiteReceiptAction(form: FormData): Promise<SiteActionResult> {
  const expenseId = form.get("expenseId");
  if (typeof expenseId !== "string" || !id.safeParse(expenseId).success) return { ok: false, message: MESSAGES.not_found };
  const opId = optionalOpId(form);
  if (opId === "bad") return { ok: false, message: MESSAGES.not_found };
  const m = await me();
  if ("ok" in m) return m;
  if (opId && (await withSession(m.session, (tx) => syncSeen(tx, m, opId)))) return { ok: true };
  const stored = await storeReceipt(m.session.orgId, form.get("file"));
  if (!stored.ok) return stored;
  try {
    const added = await withSession(m.session, (tx) => once(tx, m, opId ? { opId } : undefined, () => addReceipt(tx, m.session.orgId, expenseId, { key: stored.key, contentType: stored.contentType }, m.memberId).then(() => stored.key)));
    if (added !== stored.key) await deleteObject(stored.key);
  } catch (error) {
    await deleteObject(stored.key);
    if (error instanceof CostError) return { ok: false, message: error.reason === "too_many_receipts" ? "That receipt has as many photos as it can take." : MESSAGES.not_found };
    throw error;
  }
  revalidatePath("/m", "layout");
  revalidatePath("/app/purchases");
  return { ok: true };
}
