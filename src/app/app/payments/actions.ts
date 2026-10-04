"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/roles";
import { createInvoiceInput, id, markPaidInput, paymentSettingsInput } from "@/core/schemas";
import { InvoiceError, createInvoice as raiseInvoice, getInvoice, markPaid, markSent, markUnpaid, savePaymentSettings, voidInvoice, type InvoiceErrorReason } from "@/db/invoices";
import { clientContact, ensurePortalToken, memberEmail } from "@/db/sending";
import { getSession, withSession, type Session } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { emailInvoice } from "@/server/invoice-mail";
import { appOrigin } from "@/server/origin";

const NOT_ALLOWED = "Your role can't manage invoices.";

const MESSAGES: Record<InvoiceErrorReason, string> = {
  not_found: "This invoice no longer exists.",
  not_accepted: "Invoices can only be raised once the client has accepted the quote.",
  unknown_stage: "That payment isn't in the accepted quote's plan.",
  unknown_variation: "A variation you picked isn't approved or is already invoiced. Reload to see the latest.",
  credit_too_big: "The credits are bigger than what's being invoiced. Add them to a larger payment instead.",
  already_invoiced: "That payment has already been invoiced.",
  no_bank_details: "Add your bank details in Settings → Payments first, so the client knows where to pay.",
  not_paid: "This invoice isn't marked as paid.",
  not_open: "Only unpaid invoices can be changed like that.",
  unknown_recharge: "A purchase you picked is already invoiced or was marked as paid back. Reload to see the latest.",
};

export type InvoiceActionResult = { ok: true; invoiceId?: string; emailed?: boolean; emailError?: string } | { ok: false; message: string };

async function manager(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "invoices.manage") ? session : null;
}

const refresh = (invoiceId?: string, quoteId?: string | null) => {
  revalidatePath("/app/payments");
  revalidatePath("/app");
  if (invoiceId) revalidatePath(`/app/invoices/${invoiceId}`);
  if (quoteId) revalidatePath(`/app/quotes/${quoteId}`);
};

/** Email an invoice to its client (now, or again). Records when it was sent. */
async function deliver(session: Session, invoiceId: string): Promise<{ emailed: boolean; emailError?: string }> {
  if (!emailConfigured()) return { emailed: false, emailError: "Email isn't set up yet, so copy the invoice link and send it yourself." };
  const ctx = await withSession(session, async (tx) => {
    const inv = await getInvoice(tx, session.orgId, invoiceId);
    if (!inv) return undefined;
    const client = await clientContact(tx, session.orgId, inv.clientId);
    return { inv, client, token: await ensurePortalToken(tx, session.orgId, inv.clientId), replyTo: await memberEmail(tx, session.orgId, session.memberId) };
  });
  if (!ctx) return { emailed: false, emailError: MESSAGES.not_found };
  if (!ctx.client?.email) return { emailed: false, emailError: "This client has no email address. Add one, or copy the invoice link and send it yourself." };
  const result = await emailInvoice({
    kind: "new",
    orgId: session.orgId,
    origin: await appOrigin(),
    token: ctx.token,
    to: ctx.client.email,
    replyTo: ctx.replyTo,
    signOff: session.memberName,
    invoice: { number: ctx.inv.number, snapshot: ctx.inv.snapshot, dueDate: ctx.inv.dueDate, totalPence: ctx.inv.totalPence, clientName: ctx.client.name },
  });
  if (!result.ok) return { emailed: false, emailError: result.message };
  await withSession(session, (tx) => markSent(tx, session.orgId, invoiceId));
  return { emailed: true };
}

/** Turn one payment of an accepted quote's plan into an invoice, and optionally email it. */
export async function createInvoice(input: unknown): Promise<InvoiceActionResult> {
  const session = await manager();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  const parsed = createInvoiceInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.unknown_stage };
  let created: Awaited<ReturnType<typeof raiseInvoice>>;
  try {
    created = await withSession(session, (tx) => raiseInvoice(tx, session.orgId, { quoteId: parsed.data.quoteId, stageId: parsed.data.stageId, variationIds: parsed.data.variationIds, expenseIds: parsed.data.expenseIds, memberId: session.memberId }));
  } catch (error) {
    if (error instanceof InvoiceError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  const mail = parsed.data.email ? await deliver(session, created.id) : { emailed: false };
  refresh(created.id, parsed.data.quoteId);
  if (parsed.data.expenseIds?.length) revalidatePath("/app/purchases");
  return { ok: true, invoiceId: created.id, ...mail };
}

export async function sendInvoice(invoiceId: string): Promise<InvoiceActionResult> {
  const session = await manager();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(invoiceId).success) return { ok: false, message: MESSAGES.not_found };
  const mail = await deliver(session, invoiceId);
  refresh(invoiceId);
  return mail.emailed ? { ok: true, emailed: true } : { ok: false, message: mail.emailError ?? "The email couldn't be sent." };
}

async function change(invoiceId: string, fn: (session: Session) => Promise<string | null>): Promise<InvoiceActionResult> {
  const session = await manager();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  if (!id.safeParse(invoiceId).success) return { ok: false, message: MESSAGES.not_found };
  let quoteId: string | null;
  try {
    quoteId = await fn(session);
  } catch (error) {
    if (error instanceof InvoiceError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  refresh(invoiceId, quoteId);
  return { ok: true };
}

const quoteOf = async (session: Session, invoiceId: string) => (await withSession(session, (tx) => getInvoice(tx, session.orgId, invoiceId)))?.quoteId ?? null;

export async function markInvoicePaid(input: unknown): Promise<InvoiceActionResult> {
  const parsed = markPaidInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter the date the money arrived." };
  return change(parsed.data.invoiceId, async (session) => {
    await withSession(session, (tx) => markPaid(tx, session.orgId, parsed.data.invoiceId, parsed.data.paidOn, parsed.data.reference));
    return quoteOf(session, parsed.data.invoiceId);
  });
}

export async function markInvoiceUnpaid(invoiceId: string): Promise<InvoiceActionResult> {
  return change(invoiceId, async (session) => {
    await withSession(session, (tx) => markUnpaid(tx, session.orgId, invoiceId));
    return quoteOf(session, invoiceId);
  });
}

export async function voidInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  return change(invoiceId, async (session) => {
    await withSession(session, (tx) => voidInvoice(tx, session.orgId, invoiceId));
    return quoteOf(session, invoiceId);
  });
}

export type PaymentSettingsState = { status: "idle" | "saved" | "error"; errors?: Partial<Record<"bankAccountName" | "bankSortCode" | "bankAccountNumber" | "paymentTermsDays", string>>; message?: string };

/** Bank details, payment terms and reminders. Admin only, like the rest of company settings. */
export async function savePaymentDetails(form: FormData): Promise<PaymentSettingsState> {
  const session = await getSession();
  if (!can(session.role, "settings.manage")) return { status: "error", message: "Only an Admin can change payment details." };
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const parsed = paymentSettingsInput.safeParse({
    bankAccountName: text("bankAccountName"),
    bankSortCode: text("bankSortCode"),
    bankAccountNumber: text("bankAccountNumber"),
    paymentTermsDays: Number(text("paymentTermsDays") ?? "NaN"),
    remindersEnabled: form.get("remindersEnabled") === "on",
  });
  if (!parsed.success) {
    const errors: PaymentSettingsState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "bankSortCode") errors.bankSortCode = "Enter a 6-digit sort code, e.g. 12-34-56";
      if (key === "bankAccountNumber") errors.bankAccountNumber = "Enter an 8-digit account number";
      if (key === "bankAccountName") errors.bankAccountName = "Enter the name on the account";
      if (key === "paymentTermsDays") errors.paymentTermsDays = "Enter a number of days from 0 to 120";
    }
    return { status: "error", errors, message: "Check the highlighted fields." };
  }
  await withSession(session, (tx) => savePaymentSettings(tx, session.orgId, parsed.data));
  revalidatePath("/app/settings");
  return { status: "saved" };
}
