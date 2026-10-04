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
import { SiteError, checkIn, checkOut, isMyJob, setMyTaskStatus, workerForMember } from "@/db/site";
import { getSession, withSession, type Session } from "@/auth/session";
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

export async function setMyTaskStatusAction(taskId: string, status: TaskStatus, reason?: string): Promise<SiteActionResult> {
  if (!id.safeParse(taskId).success || !TASK_STATUSES.includes(status)) return { ok: false, message: MESSAGES.not_found };
  const r = reasonInput.safeParse(reason?.trim() || undefined);
  if (!r.success) return { ok: false, message: "Keep the reason short." };
  let projectId = "";
  const result = await run(async (m) => {
    projectId = await withSession(m.session, (tx) => setMyTaskStatus(tx, m.session.orgId, m.workerId, taskId, status, r.data, ukToday()));
  });
  if (result.ok) revalidatePath(`/app/projects/${projectId}`);
  return result;
}

export async function checkInAction(projectId: string, geo?: unknown): Promise<SiteActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, message: MESSAGES.not_found };
  const g = geoInput.safeParse(geo ?? undefined);
  return run((m) => withSession(m.session, (tx) => checkIn(tx, m.session.orgId, m, projectId, g.success ? g.data : undefined)), "/app/team");
}

export async function checkOutAction(geo?: unknown): Promise<SiteActionResult> {
  const g = geoInput.safeParse(geo ?? undefined);
  return run(async (m) => {
    await withSession(m.session, (tx) => checkOut(tx, m.session.orgId, m.workerId, g.success ? g.data : undefined));
  }, "/app/team");
}

/** Post a site update to a job's diary. The office decides whether the client sees it. */
export async function postSiteUpdateAction(projectId: string, body: string): Promise<SiteActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, message: MESSAGES.not_found };
  const text = multiLine(TEXT.note).safeParse(body.trim() || "Photos from site");
  if (!text.success) return { ok: false, message: "That update is too long." };
  return run(async (m) => {
    return withSession(m.session, async (tx) => {
      if (!(await isMyJob(tx, m.session.orgId, m, projectId))) throw new SiteError("not_yours");
      return addDiaryEntry(tx, m.session.orgId, { projectId, entryDate: ukToday(), body: text.data, shareWithClient: false }, m.memberId);
    });
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
  return run(async (m) => {
    const mine = await withSession(m.session, (tx) => isMyJob(tx, m.session.orgId, m, projectId));
    if (!mine) throw new SiteError("not_yours");
    const key = orgFileKey(m.session.orgId, "photos", randomName(), type.ext);
    const stored = await putObject(key, bytes, type.mime);
    if (!stored.ok) throw new StoreError(stored.message);
    try {
      await withSession(m.session, (tx) => addDiaryPhoto(tx, m.session.orgId, projectId, entryId, key));
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
export async function addSiteReceiptAction(projectId: string, input: { description: string; supplier?: string; totalPence: number; includesVat: boolean; forClient: boolean }): Promise<SiteActionResult> {
  if (!id.safeParse(projectId).success) return { ok: false, message: MESSAGES.not_found };
  const description = receiptInput.description.safeParse((input.description ?? "").trim());
  const supplier = receiptInput.supplier.safeParse(input.supplier?.trim() || undefined);
  const total = receiptInput.totalPence.safeParse(input.totalPence);
  if (!description.success) return { ok: false, message: "Say what you bought." };
  if (!supplier.success) return { ok: false, message: "Check the shop's name." };
  if (!total.success || total.data === 0) return { ok: false, message: "Enter the total from the receipt." };
  return run(
    (m) =>
      withSession(m.session, async (tx) => {
        if (!(await isMyJob(tx, m.session.orgId, m, projectId))) throw new SiteError("not_yours");
        return createExpense(
          tx,
          m.session.orgId,
          {
            projectId,
            category: "materials",
            supplier: supplier.data,
            description: description.data,
            spentOn: ukToday(),
            totalPence: total.data,
            vatPence: input.includesVat === true ? vatInGross(total.data, 2000) : 0,
            rechargeable: input.forClient === true,
            rechargeMarkupBps: 0,
          },
          m.memberId,
        );
      }),
    `/app/projects/${projectId}`,
    "/app/purchases",
  );
}

/** A photo (or PDF) of a receipt I just logged. */
export async function uploadSiteReceiptAction(form: FormData): Promise<SiteActionResult> {
  const expenseId = form.get("expenseId");
  if (typeof expenseId !== "string" || !id.safeParse(expenseId).success) return { ok: false, message: MESSAGES.not_found };
  const m = await me();
  if ("ok" in m) return m;
  const stored = await storeReceipt(m.session.orgId, form.get("file"));
  if (!stored.ok) return stored;
  try {
    await withSession(m.session, (tx) => addReceipt(tx, m.session.orgId, expenseId, { key: stored.key, contentType: stored.contentType }, m.memberId));
  } catch (error) {
    await deleteObject(stored.key);
    if (error instanceof CostError) return { ok: false, message: error.reason === "too_many_receipts" ? "That receipt has as many photos as it can take." : MESSAGES.not_found };
    throw error;
  }
  revalidatePath("/m", "layout");
  revalidatePath("/app/purchases");
  return { ok: true };
}
