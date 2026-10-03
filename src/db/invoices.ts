/**
 * Invoices and payment schedules (bank transfer only). Runs in the tenant transaction like everything else.
 *
 * A schedule is the payment plan frozen in the accepted version's snapshot; each stage can be raised as one
 * invoice. An invoice freezes its amounts, dates and the company's bank details in `snapshot` when raised;
 * afterwards only its payment status changes (the database enforces that, migration 0008).
 */
import "server-only";
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { addDays, invoiceRef, splitVat, ukToday, type ReminderKind } from "@/core/payment-plan";
import type { QuoteSnapshot, SnapshotStage } from "@/core/quote-snapshot";
import type { VariationSnapshot } from "@/core/variation";
import type { PaymentSettingsInput } from "@/core/schemas";
import type { Tx } from "./index";
import { clients, invoiceReminders, invoices, organizations, quoteDecisions, quoteVersions, quotes, variations } from "./schema";
import { billableVariations } from "./variations";

export type InvoiceErrorReason = "not_found" | "not_accepted" | "unknown_stage" | "unknown_variation" | "credit_too_big" | "already_invoiced" | "no_bank_details" | "not_paid" | "not_open";

export class InvoiceError extends Error {
  constructor(readonly reason: InvoiceErrorReason) {
    super(reason);
  }
}

/** What the client sees on an invoice, frozen when it's raised. */
export type InvoiceSnapshot = {
  v: 1;
  ref: string;
  company: { name: string; tradingName: string | null; vatNumber: string | null; logoUrl: string | null; brandColour: string | null };
  client: { name: string; email: string | null; address: { line1: string; line2?: string; town: string; postcode: string } | null };
  quote: { ref: string; title: string } | null;
  description: string;
  vatRateBps: number;
  bank: { accountName: string; sortCode: string; accountNumber: string };
  /** What's billed, line by line (a stage and/or variations). Older invoices have one line: the description. */
  lines?: InvoiceLine[];
};

export type InvoiceLine = { description: string; net: number; vat: number; total: number };

// ── Settings ─────────────────────────────────────────────────────────────────

export async function paymentSettings(tx: Tx, orgId: string) {
  const [s] = await tx
    .select({
      bankAccountName: organizations.bankAccountName,
      bankSortCode: organizations.bankSortCode,
      bankAccountNumber: organizations.bankAccountNumber,
      paymentTermsDays: organizations.paymentTermsDays,
      remindersEnabled: organizations.remindersEnabled,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return s;
}

export async function savePaymentSettings(tx: Tx, orgId: string, input: PaymentSettingsInput) {
  await tx
    .update(organizations)
    .set({
      bankAccountName: input.bankAccountName ?? null,
      bankSortCode: input.bankSortCode ?? null,
      bankAccountNumber: input.bankAccountNumber ?? null,
      paymentTermsDays: input.paymentTermsDays,
      remindersEnabled: input.remindersEnabled,
    })
    .where(eq(organizations.id, orgId));
}

// ── Schedules ────────────────────────────────────────────────────────────────

/** The accepted version of a quote (the one with an "accepted" decision), with its snapshot. */
async function acceptedVersion(tx: Tx, orgId: string, quoteId: string) {
  const [v] = await tx
    .select({ id: quoteVersions.id, snapshot: quoteVersions.snapshot, acceptedAt: quoteDecisions.createdAt })
    .from(quoteDecisions)
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quoteDecisions.orgId), eq(quoteVersions.id, quoteDecisions.versionId)))
    .where(and(eq(quoteDecisions.orgId, orgId), eq(quoteDecisions.quoteId, quoteId), eq(quoteDecisions.decision, "accepted")));
  return v ? { ...v, snapshot: v.snapshot as QuoteSnapshot } : undefined;
}

export type ScheduleRow = SnapshotStage & { invoice: { id: string; number: number; status: string; dueDate: string; paidOn: string | null } | null };

/** An accepted quote's payment schedule: each planned payment and its live invoice, if raised. */
export async function quoteSchedule(tx: Tx, orgId: string, quoteId: string): Promise<ScheduleRow[] | null> {
  const accepted = await acceptedVersion(tx, orgId, quoteId);
  if (!accepted) return null;
  const raised = await tx
    .select({ id: invoices.id, number: invoices.number, status: invoices.status, dueDate: invoices.dueDate, paidOn: invoices.paidOn, stageId: invoices.stageId })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.quoteId, quoteId), ne(invoices.status, "void")));
  const byStage = new Map(raised.map((i) => [i.stageId, i]));
  return (accepted.snapshot.paymentPlan ?? []).map((st) => {
    const inv = byStage.get(st.id);
    return { ...st, invoice: inv ? { id: inv.id, number: inv.number, status: inv.status, dueDate: inv.dueDate, paidOn: inv.paidOn } : null };
  });
}

// ── Raising invoices ─────────────────────────────────────────────────────────

/**
 * Raise an invoice on an accepted quote: one stage of its payment plan, approved variations, or both (a
 * stage with variations added). A stage is due on its own date if that's still ahead, otherwise after the
 * company's payment terms. Needs bank details (it's paid by bank transfer). Omissions (credits) can reduce
 * an invoice but not take it below zero.
 */
export async function createInvoice(tx: Tx, orgId: string, input: { quoteId: string; stageId?: string; variationIds?: string[]; memberId: string }, today = ukToday()) {
  const variationIds = input.variationIds ?? [];
  if (!input.stageId && variationIds.length === 0) throw new InvoiceError("unknown_stage");
  const accepted = await acceptedVersion(tx, orgId, input.quoteId);
  if (!accepted) throw new InvoiceError("not_accepted");
  const stage = input.stageId ? accepted.snapshot.paymentPlan?.find((st) => st.id === input.stageId) : undefined;
  if (input.stageId && !stage) throw new InvoiceError("unknown_stage");
  const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org.bankAccountName || !org.bankSortCode || !org.bankAccountNumber) throw new InvoiceError("no_bank_details");
  const [quote] = await tx.select({ clientId: quotes.clientId }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, input.quoteId)));
  const [client] = await tx.select({ name: clients.name, email: clients.email, address: clients.address }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, quote.clientId)));

  // Serialize numbering per company, as for quotes. This also serializes billing variations.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`invoice-number:${orgId}`}, 0))`);
  const billable = variationIds.length ? await billableVariations(tx, orgId, input.quoteId) : [];
  const chosen = variationIds.map((id) => billable.find((v) => v.id === id));
  if (chosen.some((v) => !v)) throw new InvoiceError("unknown_variation");

  const s = accepted.snapshot;
  const lines: InvoiceLine[] = [];
  if (stage) {
    const { net, vat } = splitVat(stage.amount, s.quote.vatRateBps);
    lines.push({ description: stage.label, net, vat, total: stage.amount });
  }
  for (const v of chosen as NonNullable<(typeof chosen)[number]>[]) {
    const ref = (v.snapshot as VariationSnapshot).ref;
    lines.push({ description: `Variation ${ref.split("-").at(-1)}: ${v.title}`, net: v.netPence, vat: v.vatPence, total: v.totalPence });
  }
  const net = lines.reduce((a, l) => a + l.net, 0);
  const vat = lines.reduce((a, l) => a + l.vat, 0);
  const total = net + vat;
  if (net < 0 || vat < 0 || total <= 0) throw new InvoiceError("credit_too_big");

  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${invoices.number}), 0) + 1`.mapWith(Number) })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));
  const dueDate = stage && stage.dueKind === "date" && stage.dueDate && stage.dueDate > today ? stage.dueDate : addDays(today, org.paymentTermsDays);
  const headline = lines.length === 1 ? lines[0].description : stage ? `${stage.label} and ${lines.length - 1} variation${lines.length > 2 ? "s" : ""}` : `${lines.length} variations`;
  const snapshot: InvoiceSnapshot = {
    v: 1,
    ref: invoiceRef(next),
    company: { name: org.name, tradingName: org.tradingName, vatNumber: org.vatNumber, logoUrl: org.logoUrl, brandColour: org.brandColour },
    client: { name: client.name, email: client.email, address: client.address },
    quote: { ref: s.quote.ref, title: s.quote.title },
    description: `${headline}: ${s.quote.title} (${s.quote.ref})`,
    vatRateBps: s.quote.vatRateBps,
    bank: { accountName: org.bankAccountName, sortCode: org.bankSortCode, accountNumber: org.bankAccountNumber },
    lines,
  };
  const inserted = await tx
    .insert(invoices)
    .values({
      orgId,
      number: next,
      clientId: quote.clientId,
      quoteId: input.quoteId,
      stageId: stage?.id ?? null,
      issueDate: today,
      dueDate,
      netPence: net,
      vatPence: vat,
      totalPence: total,
      snapshot,
      createdByMemberId: input.memberId,
    })
    .onConflictDoNothing()
    .returning({ id: invoices.id, number: invoices.number });
  if (inserted.length === 0) throw new InvoiceError("already_invoiced");
  if (variationIds.length) {
    await tx
      .update(variations)
      .set({ invoiceId: inserted[0].id })
      .where(and(eq(variations.orgId, orgId), inArray(variations.id, variationIds)));
  }
  return { ...inserted[0], clientId: quote.clientId, clientEmail: client.email, snapshot, dueDate, totalPence: total };
}

/** Invoice one stage of an accepted quote's plan. */
export const createStageInvoice = (tx: Tx, orgId: string, input: { quoteId: string; stageId: string; memberId: string }, today = ukToday()) => createInvoice(tx, orgId, input, today);

// ── Reading ──────────────────────────────────────────────────────────────────

export type InvoiceFilter = "all" | "outstanding" | "overdue" | "paid";

export async function listInvoices(tx: Tx, orgId: string, filter: InvoiceFilter = "all", today = ukToday()) {
  return tx
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalPence: invoices.totalPence,
      paidOn: invoices.paidOn,
      clientName: clients.name,
      quoteId: invoices.quoteId,
      description: sql<string>`${invoices.snapshot}->>'description'`,
    })
    .from(invoices)
    .innerJoin(clients, and(eq(clients.orgId, invoices.orgId), eq(clients.id, invoices.clientId)))
    .where(
      and(
        eq(invoices.orgId, orgId),
        filter === "outstanding" ? eq(invoices.status, "issued") : undefined,
        filter === "overdue" ? and(eq(invoices.status, "issued"), sql`${invoices.dueDate} < ${today}`) : undefined,
        filter === "paid" ? eq(invoices.status, "paid") : undefined,
      ),
    )
    .orderBy(filter === "paid" ? desc(invoices.paidOn) : filter === "all" ? desc(invoices.number) : asc(invoices.dueDate), desc(invoices.number))
    .limit(500);
}

/** Totals for the payments page and dashboard. */
export async function invoiceTotals(tx: Tx, orgId: string, today = ukToday()) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [t] = await tx
    .select({
      outstanding: sql<number>`coalesce(sum(${invoices.totalPence}) filter (where ${invoices.status} = 'issued'), 0)`.mapWith(Number),
      overdue: sql<number>`coalesce(sum(${invoices.totalPence}) filter (where ${invoices.status} = 'issued' and ${invoices.dueDate} < ${today}), 0)`.mapWith(Number),
      overdueCount: sql<number>`count(*) filter (where ${invoices.status} = 'issued' and ${invoices.dueDate} < ${today})`.mapWith(Number),
      dueThisWeek: sql<number>`coalesce(sum(${invoices.totalPence}) filter (where ${invoices.status} = 'issued' and ${invoices.dueDate} between ${today} and ${addDays(today, 7)}), 0)`.mapWith(Number),
      paidThisMonth: sql<number>`coalesce(sum(${invoices.totalPence}) filter (where ${invoices.status} = 'paid' and ${invoices.paidOn} >= ${monthStart}), 0)`.mapWith(Number),
    })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));
  return t;
}

export async function getInvoice(tx: Tx, orgId: string, invoiceId: string) {
  const [inv] = await tx.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
  if (!inv) return undefined;
  const reminders = await tx
    .select({ kind: invoiceReminders.kind, sentAt: invoiceReminders.sentAt })
    .from(invoiceReminders)
    .where(and(eq(invoiceReminders.orgId, orgId), eq(invoiceReminders.invoiceId, invoiceId)))
    .orderBy(asc(invoiceReminders.sentAt));
  return { ...inv, snapshot: inv.snapshot as InvoiceSnapshot, reminders };
}

// ── Payment status ───────────────────────────────────────────────────────────

export async function markPaid(tx: Tx, orgId: string, invoiceId: string, paidOn: string, reference?: string) {
  const rows = await tx
    .update(invoices)
    .set({ status: "paid", paidOn, paidReference: reference ?? null })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.status, "issued")))
    .returning({ id: invoices.id });
  if (rows.length === 0) throw new InvoiceError((await getInvoice(tx, orgId, invoiceId)) ? "not_open" : "not_found");
}

/** Undo "paid" (e.g. marked by mistake). Reminders pick up again if it's still due. */
export async function markUnpaid(tx: Tx, orgId: string, invoiceId: string) {
  const rows = await tx
    .update(invoices)
    .set({ status: "issued", paidOn: null, paidReference: null })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.status, "paid")))
    .returning({ id: invoices.id });
  if (rows.length === 0) throw new InvoiceError((await getInvoice(tx, orgId, invoiceId)) ? "not_paid" : "not_found");
}

/** Cancel an unpaid invoice (it stays on record). Its stage can then be invoiced again. */
export async function voidInvoice(tx: Tx, orgId: string, invoiceId: string) {
  const rows = await tx
    .update(invoices)
    .set({ status: "void" })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.status, "issued")))
    .returning({ id: invoices.id });
  if (rows.length === 0) throw new InvoiceError((await getInvoice(tx, orgId, invoiceId)) ? "not_open" : "not_found");
}

export async function markSent(tx: Tx, orgId: string, invoiceId: string) {
  await tx.update(invoices).set({ sentAt: new Date() }).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
}

// ── Client portal ────────────────────────────────────────────────────────────

/** The client's invoices (not voided), newest first. */
export async function portalInvoices(tx: Tx, orgId: string, clientId: string) {
  return tx
    .select({ id: invoices.id, number: invoices.number, status: invoices.status, dueDate: invoices.dueDate, totalPence: invoices.totalPence, issueDate: invoices.issueDate, description: sql<string>`${invoices.snapshot}->>'description'` })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.clientId, clientId), ne(invoices.status, "void")))
    .orderBy(desc(invoices.number));
}

export async function portalInvoice(tx: Tx, orgId: string, clientId: string, number: number) {
  const [inv] = await tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.clientId, clientId), eq(invoices.number, number), ne(invoices.status, "void")));
  return inv ? { ...inv, snapshot: inv.snapshot as InvoiceSnapshot } : undefined;
}

// ── Reminders ────────────────────────────────────────────────────────────────

/** Unpaid invoices due by `until`, with the reminder kinds already sent, for one company's reminder run. */
export async function invoicesForReminders(tx: Tx, orgId: string, until: string) {
  const [org] = await tx.select({ remindersEnabled: organizations.remindersEnabled }).from(organizations).where(eq(organizations.id, orgId));
  if (!org?.remindersEnabled) return [];
  const rows = await tx
    .select({ id: invoices.id, number: invoices.number, dueDate: invoices.dueDate, totalPence: invoices.totalPence, clientId: invoices.clientId, createdByMemberId: invoices.createdByMemberId, snapshot: invoices.snapshot })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), lte(invoices.dueDate, until)));
  if (rows.length === 0) return [];
  const sent = await tx
    .select({ invoiceId: invoiceReminders.invoiceId, kind: invoiceReminders.kind })
    .from(invoiceReminders)
    .where(and(eq(invoiceReminders.orgId, orgId), inArray(invoiceReminders.invoiceId, rows.map((r) => r.id))));
  return rows.map((r) => ({ ...r, snapshot: r.snapshot as InvoiceSnapshot, sent: new Set(sent.filter((s) => s.invoiceId === r.id).map((s) => s.kind)) }));
}

/**
 * Claim a reminder before emailing it: the unique key means a second run (or a retry) can't send the same
 * reminder twice. Returns false if it was already claimed.
 */
export async function claimReminder(tx: Tx, orgId: string, invoiceId: string, kind: ReminderKind): Promise<boolean> {
  const rows = await tx.insert(invoiceReminders).values({ orgId, invoiceId, kind }).onConflictDoNothing().returning({ id: invoiceReminders.id });
  return rows.length > 0;
}
