"use server";

import { revalidatePath } from "next/cache";
import { formatGBP } from "@/core/money";
import { PO_STATUSES, poLineTotal, poRef, poTotals, type PoStatus } from "@/core/costs";
import { formatAddress } from "@/core/clients";
import { ukToday } from "@/core/payment-plan";
import { can } from "@/core/roles";
import { expenseInput, id, purchaseOrderInput } from "@/core/schemas";
import {
  CostError,
  addReceipt,
  createExpense,
  createPurchaseOrder,
  deleteExpense,
  deletePurchaseOrder,
  getPurchaseOrder,
  removeReceipt,
  setPurchaseOrderStatus,
  setRecovered,
  updateExpense,
  updatePurchaseOrder,
  type CostErrorReason,
} from "@/db/costs";
import { memberEmail } from "@/db/sending";
import { getSession, withSession, type Session } from "@/auth/session";
import { emailConfigured, sendEmail } from "@/server/email";
import { storeReceipt } from "@/server/receipts";
import { deleteObject } from "@/server/storage";

export type CostActionResult = { ok: true; id?: string } | { ok: false; message: string };

const NOT_ALLOWED = "Only Admins and the office can change job costs.";
const MESSAGES: Record<CostErrorReason, string> = {
  not_found: "This was removed or changed somewhere else. Reload to see the latest.",
  unknown_project: "Choose one of your projects.",
  unknown_po: "That purchase order isn't on this project.",
  too_many_receipts: "An expense can have up to 6 receipts.",
  invoiced: "This is on an invoice to the client. Cancel that invoice first to change it.",
  not_editable: "This can't be changed any more (cancelled or already sent).",
};

async function editor(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "costs.edit") ? session : null;
}

function refresh(projectId?: string) {
  revalidatePath("/app/purchases");
  revalidatePath("/app/reports");
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
}

async function run(fn: (s: Session) => Promise<string | void>, projectId?: string): Promise<CostActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  let result: string | void;
  try {
    result = await fn(session);
  } catch (error) {
    if (error instanceof CostError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  refresh(projectId);
  return { ok: true, id: result || undefined };
}

const firstIssue = (e: { issues: { message: string; path: PropertyKey[] }[] }) => {
  const i = e.issues[0];
  const field = String(i?.path[0] ?? "");
  const labels: Record<string, string> = {
    description: "Say what it was for.",
    totalPence: "Check the total.",
    vatPence: "The VAT can't be more than the total.",
    spentOn: "Check the date.",
    projectId: "Choose a project.",
    supplierName: "Enter the supplier.",
    supplierEmail: "Check the supplier's email address.",
    lines: "Check the lines: each needs a description and a quantity.",
  };
  return labels[field] ?? "Check what you've entered.";
};

// ── Expenses ─────────────────────────────────────────────────────────────────

export async function saveExpenseAction(expenseId: string | null, input: unknown): Promise<CostActionResult> {
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  if (expenseId !== null && !id.safeParse(expenseId).success) return { ok: false, message: MESSAGES.not_found };
  return run(
    (s) =>
      withSession(s, async (tx) => {
        if (expenseId) {
          await updateExpense(tx, s.orgId, expenseId, parsed.data);
          return expenseId;
        }
        return createExpense(tx, s.orgId, parsed.data, s.memberId);
      }),
    parsed.data.projectId,
  );
}

export async function deleteExpenseAction(expenseId: string): Promise<CostActionResult> {
  if (!id.safeParse(expenseId).success) return { ok: false, message: MESSAGES.not_found };
  let keys: string[] = [];
  const r = await run(async (s) => {
    keys = await withSession(s, (tx) => deleteExpense(tx, s.orgId, expenseId));
  });
  if (r.ok) for (const k of keys) await deleteObject(k);
  return r;
}

/** Attach a receipt (photo shrunk in the browser, or a PDF) to an expense. */
export async function uploadReceiptAction(form: FormData): Promise<CostActionResult> {
  const expenseId = form.get("expenseId");
  if (typeof expenseId !== "string" || !id.safeParse(expenseId).success) return { ok: false, message: MESSAGES.not_found };
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  const stored = await storeReceipt(session.orgId, form.get("file"));
  if (!stored.ok) return stored;
  try {
    await withSession(session, (tx) => addReceipt(tx, session.orgId, expenseId, { key: stored.key, contentType: stored.contentType }));
  } catch (error) {
    await deleteObject(stored.key);
    if (error instanceof CostError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  refresh();
  return { ok: true };
}

export async function removeReceiptAction(expenseId: string, key: string): Promise<CostActionResult> {
  if (!id.safeParse(expenseId).success || typeof key !== "string") return { ok: false, message: MESSAGES.not_found };
  let removed = false;
  const r = await run(async (s) => {
    removed = await withSession(s, (tx) => removeReceipt(tx, s.orgId, expenseId, key));
  });
  if (r.ok && removed) await deleteObject(key);
  return r;
}

/** Mark a purchase made for the client as paid back some other way (or undo that). */
export async function setRecoveredAction(expenseId: string, recovered: boolean): Promise<CostActionResult> {
  if (!id.safeParse(expenseId).success) return { ok: false, message: MESSAGES.not_found };
  return run((s) => withSession(s, (tx) => setRecovered(tx, s.orgId, expenseId, recovered === true ? ukToday() : null)));
}

// ── Purchase orders ──────────────────────────────────────────────────────────

export async function savePurchaseOrderAction(poId: string | null, input: unknown): Promise<CostActionResult> {
  const parsed = purchaseOrderInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  if (poId !== null && !id.safeParse(poId).success) return { ok: false, message: MESSAGES.not_found };
  const r = await run(
    (s) =>
      withSession(s, async (tx) => {
        if (poId) {
          await updatePurchaseOrder(tx, s.orgId, poId, parsed.data);
          return poId;
        }
        return createPurchaseOrder(tx, s.orgId, parsed.data, s.memberId);
      }),
    parsed.data.projectId,
  );
  if (r.ok && r.id) revalidatePath(`/app/purchases/orders/${r.id}`);
  return r;
}

export async function setPurchaseOrderStatusAction(poId: string, status: PoStatus): Promise<CostActionResult> {
  if (!id.safeParse(poId).success || !PO_STATUSES.includes(status)) return { ok: false, message: MESSAGES.not_found };
  const r = await run((s) => withSession(s, (tx) => setPurchaseOrderStatus(tx, s.orgId, poId, status, ukToday())));
  revalidatePath(`/app/purchases/orders/${poId}`);
  return r;
}

export async function deletePurchaseOrderAction(poId: string): Promise<CostActionResult> {
  if (!id.safeParse(poId).success) return { ok: false, message: MESSAGES.not_found };
  return run((s) => withSession(s, (tx) => deletePurchaseOrder(tx, s.orgId, poId)));
}

/** Email the order to the supplier (replies come to you) and mark it as ordered. */
export async function emailPurchaseOrderAction(poId: string): Promise<CostActionResult> {
  if (!id.safeParse(poId).success) return { ok: false, message: MESSAGES.not_found };
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!emailConfigured()) return { ok: false, message: "Email isn't set up yet. Print the order or copy it into an email yourself." };
  const ctx = await withSession(session, async (tx) => ({ found: await getPurchaseOrder(tx, session.orgId, poId), replyTo: await memberEmail(tx, session.orgId, session.memberId) }));
  if (!ctx.found) return { ok: false, message: MESSAGES.not_found };
  const { po, projectName, siteAddress } = ctx.found;
  if (!po.supplierEmail) return { ok: false, message: "Add the supplier's email address first." };
  if (po.lines.length === 0) return { ok: false, message: "Add what you're ordering first." };
  if (po.status === "cancelled") return { ok: false, message: MESSAGES.not_editable };
  const t = poTotals(po.lines, po.vatRateBps);
  const ref = poRef(po.number);
  const result = await sendEmail({
    to: po.supplierEmail,
    replyTo: ctx.replyTo,
    subject: `Purchase order ${ref} from ${session.orgName}`,
    fromName: session.orgName,
    content: {
      company: { name: session.orgName },
      preheader: `${ref}: ${po.lines.length} item${po.lines.length > 1 ? "s" : ""}, ${formatGBP(t.total)} inc. VAT`,
      heading: `Purchase order ${ref}`,
      paragraphs: [
        `Please supply the following${po.neededBy ? ` by ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${po.neededBy}T00:00:00Z`))}` : ""}, quoting ${ref} on your invoice.`,
        `Deliver to: ${siteAddress ? formatAddress(siteAddress) : projectName}.${po.deliveryNotes ? `\n${po.deliveryNotes}` : ""}`,
        `Reply to this email with any questions. ${session.memberName}, ${session.orgName}`,
      ],
      details: [
        ...po.lines.map((l): [string, string] => [`${l.qty} ${l.unit} · ${l.description}`, formatGBP(poLineTotal(l))]),
        ["Total (ex VAT)", formatGBP(t.net)],
        ["VAT", formatGBP(t.vat)],
        ["Total", formatGBP(t.total)],
      ],
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (po.status === "draft") await withSession(session, (tx) => setPurchaseOrderStatus(tx, session.orgId, poId, "ordered", ukToday()));
  refresh(po.projectId);
  revalidatePath(`/app/purchases/orders/${poId}`);
  return { ok: true };
}
