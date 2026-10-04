/**
 * Job costs: expenses (receipts, supplier bills), purchase orders, recharges to the client, and the costing
 * summary that sets all of it (plus labour from site check-ins) against what the job earns.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { LABOUR_DAY_MINUTES, MAX_RECEIPTS, costOf, poTotals, rechargeNet, type ExpenseCategory, type PoStatus } from "@/core/costs";
import { applyBps } from "@/core/money";
import { lineCost } from "@/core/quote";
import type { QuoteSnapshot } from "@/core/quote-snapshot";
import type { ExpenseInput, PurchaseOrderInput } from "@/core/schemas";
import { variationTotals } from "@/core/variation";
import type { Tx } from "./index";
import {
  clients,
  expenses,
  invoices,
  members,
  organizations,
  projects,
  purchaseOrders,
  quoteDecisions,
  quoteLines,
  quoteSections,
  quoteVersions,
  siteVisits,
  variations,
  workers,
  type Receipt,
} from "./schema";

export type CostErrorReason = "not_found" | "unknown_project" | "unknown_po" | "too_many_receipts" | "invoiced" | "not_editable";

export class CostError extends Error {
  constructor(readonly reason: CostErrorReason) {
    super(reason);
  }
}

/** Whether the company reclaims VAT (it has a VAT number): costs are then counted without VAT. */
export async function vatRegistered(tx: Tx, orgId: string): Promise<boolean> {
  const [o] = await tx.select({ vatNumber: organizations.vatNumber }).from(organizations).where(eq(organizations.id, orgId));
  return Boolean(o?.vatNumber);
}

/** The company's name, VAT number and logo, for documents like a printed purchase order. */
export async function companyHeader(tx: Tx, orgId: string) {
  const [o] = await tx
    .select({ name: organizations.name, tradingName: organizations.tradingName, vatNumber: organizations.vatNumber, logoUrl: organizations.logoUrl })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return o;
}

async function assertProject(tx: Tx, orgId: string, projectId: string) {
  const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.orgId, orgId), eq(projects.id, projectId)));
  if (!p) throw new CostError("unknown_project");
}

async function assertPo(tx: Tx, orgId: string, projectId: string, poId: string | undefined) {
  if (!poId) return;
  const [po] = await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, projectId)));
  if (!po) throw new CostError("unknown_po");
}

// ── Expenses ─────────────────────────────────────────────────────────────────

/** An expense is "billed" while it's on an invoice that hasn't been cancelled. */
const billedSql = sql<boolean>`(${expenses.invoiceId} is not null and ${invoices.status} <> 'void')`;

export type ExpenseFilter = "all" | "to_recharge" | "no_receipt";

export async function listExpenses(tx: Tx, orgId: string, opts: { projectId?: string; filter?: ExpenseFilter; limit?: number } = {}) {
  const filter = opts.filter ?? "all";
  return tx
    .select({
      id: expenses.id,
      projectId: expenses.projectId,
      projectName: projects.name,
      purchaseOrderId: expenses.purchaseOrderId,
      poNumber: purchaseOrders.number,
      category: expenses.category,
      supplier: expenses.supplier,
      description: expenses.description,
      spentOn: expenses.spentOn,
      netPence: expenses.netPence,
      vatPence: expenses.vatPence,
      totalPence: expenses.totalPence,
      receipts: expenses.receipts,
      rechargeable: expenses.rechargeable,
      rechargeMarkupBps: expenses.rechargeMarkupBps,
      invoiceId: expenses.invoiceId,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
      recoveredOn: expenses.recoveredOn,
      createdByName: members.name,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .innerJoin(projects, and(eq(projects.orgId, expenses.orgId), eq(projects.id, expenses.projectId)))
    .leftJoin(purchaseOrders, and(eq(purchaseOrders.orgId, expenses.orgId), eq(purchaseOrders.id, expenses.purchaseOrderId)))
    .leftJoin(invoices, and(eq(invoices.orgId, expenses.orgId), eq(invoices.id, expenses.invoiceId)))
    .leftJoin(members, and(eq(members.orgId, expenses.orgId), eq(members.id, expenses.createdByMemberId)))
    .where(
      and(
        eq(expenses.orgId, orgId),
        opts.projectId ? eq(expenses.projectId, opts.projectId) : undefined,
        filter === "to_recharge" ? and(eq(expenses.rechargeable, true), isNull(expenses.recoveredOn), sql`not ${billedSql}`) : undefined,
        filter === "no_receipt" ? sql`jsonb_array_length(${expenses.receipts}) = 0` : undefined,
      ),
    )
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
    .limit(opts.limit ?? 1_000);
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

/** Billed on a live invoice: the amounts are then fixed (cancel the invoice to change them). */
export const isBilled = (e: { invoiceId: string | null; invoiceStatus: string | null }) => Boolean(e.invoiceId && e.invoiceStatus !== "void");

async function loadForChange(tx: Tx, orgId: string, expenseId: string) {
  const [e] = await tx
    .select({ id: expenses.id, projectId: expenses.projectId, invoiceId: expenses.invoiceId, invoiceStatus: invoices.status, receipts: expenses.receipts, createdByMemberId: expenses.createdByMemberId })
    .from(expenses)
    .leftJoin(invoices, and(eq(invoices.orgId, expenses.orgId), eq(invoices.id, expenses.invoiceId)))
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId)));
  if (!e) throw new CostError("not_found");
  return e;
}

export async function createExpense(tx: Tx, orgId: string, input: ExpenseInput, memberId: string): Promise<string> {
  await assertProject(tx, orgId, input.projectId);
  await assertPo(tx, orgId, input.projectId, input.purchaseOrderId);
  const [row] = await tx
    .insert(expenses)
    .values({
      orgId,
      projectId: input.projectId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      category: input.category,
      supplier: input.supplier ?? null,
      description: input.description,
      spentOn: input.spentOn,
      netPence: input.totalPence - input.vatPence,
      vatPence: input.vatPence,
      totalPence: input.totalPence,
      rechargeable: input.rechargeable,
      rechargeMarkupBps: input.rechargeable ? input.rechargeMarkupBps : 0,
      createdByMemberId: memberId,
    })
    .returning({ id: expenses.id });
  return row.id;
}

export async function updateExpense(tx: Tx, orgId: string, expenseId: string, input: ExpenseInput) {
  const e = await loadForChange(tx, orgId, expenseId);
  if (isBilled(e)) throw new CostError("invoiced");
  await assertProject(tx, orgId, input.projectId);
  await assertPo(tx, orgId, input.projectId, input.purchaseOrderId);
  await tx
    .update(expenses)
    .set({
      projectId: input.projectId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      category: input.category,
      supplier: input.supplier ?? null,
      description: input.description,
      spentOn: input.spentOn,
      netPence: input.totalPence - input.vatPence,
      vatPence: input.vatPence,
      totalPence: input.totalPence,
      rechargeable: input.rechargeable,
      rechargeMarkupBps: input.rechargeable ? input.rechargeMarkupBps : 0,
      // A cancelled invoice no longer counts; not rechargeable any more means nothing to recover.
      invoiceId: null,
      ...(input.rechargeable ? {} : { recoveredOn: null }),
    })
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId)));
}

/** Delete an expense. Returns its receipt keys, to delete from storage. */
export async function deleteExpense(tx: Tx, orgId: string, expenseId: string): Promise<string[]> {
  const e = await loadForChange(tx, orgId, expenseId);
  if (isBilled(e)) throw new CostError("invoiced");
  await tx.delete(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId)));
  return e.receipts.map((r) => r.key);
}

/** Attach a receipt. With `addedBy`, only to an expense that person added (the site app). */
export async function addReceipt(tx: Tx, orgId: string, expenseId: string, receipt: Receipt, addedBy?: string) {
  const rows = await tx
    .update(expenses)
    .set({ receipts: sql`${expenses.receipts} || ${JSON.stringify([receipt])}::jsonb` })
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId), addedBy ? eq(expenses.createdByMemberId, addedBy) : undefined, sql`jsonb_array_length(${expenses.receipts}) < ${MAX_RECEIPTS}`))
    .returning({ id: expenses.id });
  if (rows.length === 0) {
    const e = await loadForChange(tx, orgId, expenseId);
    if (addedBy && e.createdByMemberId !== addedBy) throw new CostError("not_found");
    throw new CostError("too_many_receipts");
  }
}

/** Remove one receipt. True if it was there (so the caller deletes the file). */
export async function removeReceipt(tx: Tx, orgId: string, expenseId: string, key: string): Promise<boolean> {
  const e = await loadForChange(tx, orgId, expenseId);
  if (!e.receipts.some((r) => r.key === key)) return false;
  await tx
    .update(expenses)
    .set({ receipts: e.receipts.filter((r) => r.key !== key) })
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId)));
  return true;
}

/** Mark a recharge as paid back some other way (cash, a separate bill), or undo that. */
export async function setRecovered(tx: Tx, orgId: string, expenseId: string, recoveredOn: string | null) {
  const e = await loadForChange(tx, orgId, expenseId);
  if (isBilled(e)) throw new CostError("invoiced");
  const rows = await tx
    .update(expenses)
    .set({ recoveredOn })
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, expenseId), eq(expenses.rechargeable, true)))
    .returning({ id: expenses.id });
  if (rows.length === 0) throw new CostError("not_editable");
}

/**
 * Recharges that can go on an invoice for a quote: rechargeable expenses on that quote's projects, not
 * recovered another way and not on a live invoice. `amount` is the net billed (cost plus markup).
 */
export async function rechargesForQuote(tx: Tx, orgId: string, quoteId: string) {
  const registered = await vatRegistered(tx, orgId);
  const rows = await tx
    .select({
      id: expenses.id,
      description: expenses.description,
      supplier: expenses.supplier,
      spentOn: expenses.spentOn,
      netPence: expenses.netPence,
      totalPence: expenses.totalPence,
      rechargeMarkupBps: expenses.rechargeMarkupBps,
    })
    .from(expenses)
    .innerJoin(projects, and(eq(projects.orgId, expenses.orgId), eq(projects.id, expenses.projectId)))
    .leftJoin(invoices, and(eq(invoices.orgId, expenses.orgId), eq(invoices.id, expenses.invoiceId)))
    .where(and(eq(expenses.orgId, orgId), eq(projects.quoteId, quoteId), eq(expenses.rechargeable, true), isNull(expenses.recoveredOn), or(isNull(expenses.invoiceId), eq(invoices.status, "void"))))
    .orderBy(asc(expenses.spentOn));
  return rows.map((r) => ({ ...r, amount: rechargeNet(costOf(r, registered), r.rechargeMarkupBps) }));
}

// ── Purchase orders ──────────────────────────────────────────────────────────

export async function listPurchaseOrders(tx: Tx, orgId: string, opts: { projectId?: string; open?: boolean } = {}) {
  return tx
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      projectId: purchaseOrders.projectId,
      projectName: projects.name,
      supplierName: purchaseOrders.supplierName,
      status: purchaseOrders.status,
      orderedOn: purchaseOrders.orderedOn,
      neededBy: purchaseOrders.neededBy,
      netPence: purchaseOrders.netPence,
      vatRateBps: purchaseOrders.vatRateBps,
      lineCount: sql<number>`jsonb_array_length(${purchaseOrders.lines})`.mapWith(Number),
      billedPence: sql<number>`(select coalesce(sum(e.net_pence), 0) from expenses e where e.org_id = "purchase_orders"."org_id" and e.purchase_order_id = "purchase_orders"."id")`.mapWith(Number),
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(projects, and(eq(projects.orgId, purchaseOrders.orgId), eq(projects.id, purchaseOrders.projectId)))
    .where(and(eq(purchaseOrders.orgId, orgId), opts.projectId ? eq(purchaseOrders.projectId, opts.projectId) : undefined, opts.open ? inArray(purchaseOrders.status, ["draft", "ordered"]) : undefined))
    .orderBy(desc(purchaseOrders.number))
    .limit(1_000);
}

export async function getPurchaseOrder(tx: Tx, orgId: string, poId: string) {
  const [row] = await tx
    .select({ po: purchaseOrders, projectName: projects.name, siteAddress: projects.siteAddress, clientName: clients.name, createdByName: members.name })
    .from(purchaseOrders)
    .innerJoin(projects, and(eq(projects.orgId, purchaseOrders.orgId), eq(projects.id, purchaseOrders.projectId)))
    .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
    .leftJoin(members, and(eq(members.orgId, purchaseOrders.orgId), eq(members.id, purchaseOrders.createdByMemberId)))
    .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, poId)));
  if (!row) return undefined;
  const bills = await tx
    .select({ id: expenses.id, description: expenses.description, spentOn: expenses.spentOn, netPence: expenses.netPence, totalPence: expenses.totalPence, receipts: expenses.receipts })
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.purchaseOrderId, poId)))
    .orderBy(asc(expenses.spentOn));
  return { ...row, bills };
}

export async function createPurchaseOrder(tx: Tx, orgId: string, input: PurchaseOrderInput, memberId: string): Promise<string> {
  await assertProject(tx, orgId, input.projectId);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`po-number:${orgId}`}, 0))`);
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${purchaseOrders.number}), 0) + 1`.mapWith(Number) })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.orgId, orgId));
  const [row] = await tx
    .insert(purchaseOrders)
    .values({
      orgId,
      number: next,
      projectId: input.projectId,
      supplierName: input.supplierName,
      supplierEmail: input.supplierEmail ?? null,
      neededBy: input.neededBy ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      vatRateBps: input.vatRateBps,
      lines: input.lines,
      netPence: poTotals(input.lines, input.vatRateBps).net,
      createdByMemberId: memberId,
    })
    .returning({ id: purchaseOrders.id });
  return row.id;
}

/** Change an order. Cancelled orders are kept as they were. */
export async function updatePurchaseOrder(tx: Tx, orgId: string, poId: string, input: Omit<PurchaseOrderInput, "projectId">) {
  const rows = await tx
    .update(purchaseOrders)
    .set({
      supplierName: input.supplierName,
      supplierEmail: input.supplierEmail ?? null,
      neededBy: input.neededBy ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      vatRateBps: input.vatRateBps,
      lines: input.lines,
      netPence: poTotals(input.lines, input.vatRateBps).net,
    })
    .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, poId), ne(purchaseOrders.status, "cancelled")))
    .returning({ id: purchaseOrders.id });
  if (rows.length === 0) throw new CostError((await getPurchaseOrder(tx, orgId, poId)) ? "not_editable" : "not_found");
}

/** Move an order along: ordered (dated today unless already), delivered, cancelled, or back to draft. */
export async function setPurchaseOrderStatus(tx: Tx, orgId: string, poId: string, status: PoStatus, today: string) {
  const rows = await tx
    .update(purchaseOrders)
    .set({ status, orderedOn: status === "draft" ? null : sql`coalesce(${purchaseOrders.orderedOn}, ${status === "cancelled" ? null : today}::date)` })
    .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, poId)))
    .returning({ id: purchaseOrders.id });
  if (rows.length === 0) throw new CostError("not_found");
}

/** Delete a draft order (sent ones are cancelled instead, so the number isn't reused or lost). */
export async function deletePurchaseOrder(tx: Tx, orgId: string, poId: string) {
  const rows = await tx
    .delete(purchaseOrders)
    .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, poId), eq(purchaseOrders.status, "draft"), sql`not exists (select 1 from expenses e where e.org_id = ${orgId} and e.purchase_order_id = ${poId})`))
    .returning({ id: purchaseOrders.id });
  if (rows.length === 0) throw new CostError((await getPurchaseOrder(tx, orgId, poId)) ? "not_editable" : "not_found");
}

// ── Job costing ──────────────────────────────────────────────────────────────

/** `costed` is the sum of minutes × day rate; a day rate covers a working day (as `labourCost`). */
const labourFromCosted = (costed: number | null) => Math.round((costed ?? 0) / LABOUR_DAY_MINUTES);

/** Time on site per person on a job, with what it cost (day rate when they checked in, else today's). */
export async function labourOnJob(tx: Tx, orgId: string, projectId: string) {
  const rows = await tx
    .select({
      workerId: workers.id,
      name: workers.name,
      minutes: sql<number>`floor(sum(extract(epoch from (coalesce(${siteVisits.checkedOutAt}, now()) - ${siteVisits.checkedInAt})) / 60))`.mapWith(Number),
      costed: sql<number>`floor(sum(extract(epoch from (coalesce(${siteVisits.checkedOutAt}, now()) - ${siteVisits.checkedInAt})) / 60 * coalesce(${siteVisits.dayRatePence}, ${workers.dayRatePence})))`.mapWith(Number),
      unratedMinutes: sql<number>`floor(coalesce(sum(extract(epoch from (coalesce(${siteVisits.checkedOutAt}, now()) - ${siteVisits.checkedInAt})) / 60) filter (where coalesce(${siteVisits.dayRatePence}, ${workers.dayRatePence}) is null), 0))`.mapWith(Number),
    })
    .from(siteVisits)
    .innerJoin(workers, and(eq(workers.orgId, siteVisits.orgId), eq(workers.id, siteVisits.workerId)))
    .where(and(eq(siteVisits.orgId, orgId), eq(siteVisits.projectId, projectId)))
    .groupBy(workers.id, workers.name)
    .orderBy(asc(workers.name));
  return rows.map((r) => ({ workerId: r.workerId, name: r.name, minutes: r.minutes, cost: labourFromCosted(r.costed), unratedMinutes: r.unratedMinutes }));
}

/** What the accepted quote and approved variations sell for (ex VAT) and were estimated to cost. */
async function quoteFigures(tx: Tx, orgId: string, quoteId: string) {
  const [accepted] = await tx
    .select({ snapshot: quoteVersions.snapshot })
    .from(quoteDecisions)
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quoteDecisions.orgId), eq(quoteVersions.id, quoteDecisions.versionId)))
    .where(and(eq(quoteDecisions.orgId, orgId), eq(quoteDecisions.quoteId, quoteId), eq(quoteDecisions.decision, "accepted")));
  if (!accepted) return null;
  const lines = await tx
    .select({ qty: quoteLines.qty, ratePence: quoteLines.ratePence })
    .from(quoteLines)
    .innerJoin(quoteSections, and(eq(quoteSections.orgId, quoteLines.orgId), eq(quoteSections.id, quoteLines.sectionId)))
    .where(and(eq(quoteLines.orgId, orgId), eq(quoteSections.quoteId, quoteId)));
  const approved = await tx
    .select({ lines: variations.lines, vatRateBps: variations.vatRateBps, netPence: variations.netPence })
    .from(variations)
    .where(and(eq(variations.orgId, orgId), eq(variations.quoteId, quoteId), eq(variations.status, "approved")));
  const quoteNet = (accepted.snapshot as QuoteSnapshot).totals.net;
  const variationsNet = approved.reduce((s, v) => s + v.netPence, 0);
  const estimate = lines.reduce((s, l) => s + lineCost({ qty: Number(l.qty), rate: l.ratePence }), 0) + approved.reduce((s, v) => s + variationTotals(v.lines, v.vatRateBps).cost, 0);
  return { quoteNet, variationsNet, incomeNet: quoteNet + variationsNet, estimate };
}

/**
 * The job's numbers: income (ex VAT) from the accepted quote and approved variations, the estimated cost
 * from the quote's cost prices, actual costs so far (expenses by category, labour, orders not yet billed),
 * and recharges (bought for the client: billed back, so not the company's cost).
 */
export async function jobCosting(tx: Tx, orgId: string, projectId: string) {
  const [p] = await tx.select({ quoteId: projects.quoteId }).from(projects).where(and(eq(projects.orgId, orgId), eq(projects.id, projectId)));
  if (!p) return undefined;
  const registered = await vatRegistered(tx, orgId);
  const quote = p.quoteId ? await quoteFigures(tx, orgId, p.quoteId) : null;
  const rows = await listExpenses(tx, orgId, { projectId });
  const byCategory = new Map<ExpenseCategory, number>();
  const recharges = { total: 0, billed: 0, recovered: 0, outstanding: 0, count: 0 };
  for (const e of rows) {
    const cost = costOf(e, registered);
    if (e.rechargeable) {
      const amount = rechargeNet(cost, e.rechargeMarkupBps);
      recharges.total += amount;
      recharges.count++;
      if (e.recoveredOn) recharges.recovered += amount;
      else if (isBilled(e)) recharges.billed += amount;
      else recharges.outstanding += amount;
      continue;
    }
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + cost);
  }
  const labour = await labourOnJob(tx, orgId, projectId);
  const labourTotal = labour.reduce((s, l) => s + l.cost, 0);
  const expensesTotal = [...byCategory.values()].reduce((a, b) => a + b, 0);
  // Orders placed but not yet billed: money committed that isn't in the expenses yet.
  const pos = await listPurchaseOrders(tx, orgId, { projectId });
  const committed = pos.filter((o) => (o.status === "ordered" || o.status === "delivered") && o.billedPence === 0).reduce((s, o) => s + (registered ? o.netPence : o.netPence + applyBps(o.netPence, o.vatRateBps)), 0);
  return {
    vatRegistered: registered,
    quote,
    byCategory: Object.fromEntries(byCategory) as Partial<Record<ExpenseCategory, number>>,
    expensesTotal,
    labour,
    labourTotal,
    committed,
    costsToDate: expensesTotal + labourTotal,
    recharges,
    expenses: rows,
    purchaseOrders: pos,
  };
}

export type JobCosting = NonNullable<Awaited<ReturnType<typeof jobCosting>>>;

/** Every job's headline numbers for the Reports page: income, costs so far, estimate, recharges to bill. */
export async function costingReport(tx: Tx, orgId: string) {
  const registered = await vatRegistered(tx, orgId);
  const list = await tx
    .select({ id: projects.id, name: projects.name, status: projects.status, quoteId: projects.quoteId, clientName: clients.name, startDate: projects.startDate })
    .from(projects)
    .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
    .where(eq(projects.orgId, orgId))
    .orderBy(desc(projects.createdAt))
    .limit(200);
  const ids = list.map((p) => p.id);
  if (ids.length === 0) return { vatRegistered: registered, rows: [] };
  const spend = await tx
    .select({
      projectId: expenses.projectId,
      own: sql<number>`coalesce(sum(${registered ? expenses.netPence : expenses.totalPence}) filter (where not ${expenses.rechargeable}), 0)`.mapWith(Number),
      toRecharge: sql<number>`coalesce(sum(round(${registered ? expenses.netPence : expenses.totalPence} * (10000 + ${expenses.rechargeMarkupBps}) / 10000.0)) filter (where ${expenses.rechargeable} and ${expenses.recoveredOn} is null and (${expenses.invoiceId} is null or ${invoices.status} = 'void')), 0)`.mapWith(Number),
    })
    .from(expenses)
    .leftJoin(invoices, and(eq(invoices.orgId, expenses.orgId), eq(invoices.id, expenses.invoiceId)))
    .where(and(eq(expenses.orgId, orgId), inArray(expenses.projectId, ids)))
    .groupBy(expenses.projectId);
  const labour = await tx
    .select({
      projectId: siteVisits.projectId,
      costed: sql<number>`floor(coalesce(sum(extract(epoch from (coalesce(${siteVisits.checkedOutAt}, now()) - ${siteVisits.checkedInAt})) / 60 * coalesce(${siteVisits.dayRatePence}, ${workers.dayRatePence})), 0))`.mapWith(Number),
      minutes: sql<number>`floor(sum(extract(epoch from (coalesce(${siteVisits.checkedOutAt}, now()) - ${siteVisits.checkedInAt})) / 60))`.mapWith(Number),
    })
    .from(siteVisits)
    .innerJoin(workers, and(eq(workers.orgId, siteVisits.orgId), eq(workers.id, siteVisits.workerId)))
    .where(and(eq(siteVisits.orgId, orgId), inArray(siteVisits.projectId, ids)))
    .groupBy(siteVisits.projectId);
  const spendBy = new Map(spend.map((s) => [s.projectId, s]));
  const labourBy = new Map(labour.map((l) => [l.projectId, l]));
  const rows = [];
  for (const p of list) {
    const q = p.quoteId ? await quoteFigures(tx, orgId, p.quoteId) : null;
    const s = spendBy.get(p.id);
    const l = labourBy.get(p.id);
    const labourTotal = labourFromCosted(l?.costed ?? 0);
    rows.push({ ...p, incomeNet: q?.incomeNet ?? null, estimate: q?.estimate ?? null, expenses: s?.own ?? 0, labour: labourTotal, labourMinutes: l?.minutes ?? 0, costs: (s?.own ?? 0) + labourTotal, toRecharge: s?.toRecharge ?? 0 });
  }
  return { vatRegistered: registered, rows };
}

/** Projects to file an expense or order against: current ones first, then the rest. */
export async function costProjects(tx: Tx, orgId: string) {
  return tx
    .select({ id: projects.id, name: projects.name, status: projects.status, quoteId: projects.quoteId })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .orderBy(sql`case when ${projects.status} = 'complete' then 1 else 0 end`, asc(projects.name))
    .limit(500);
}

/** Whether there's anything on this project the cost views could show (for empty states). */
export async function hasCosts(tx: Tx, orgId: string, projectId: string): Promise<boolean> {
  const [e] = await tx.select({ id: expenses.id }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.projectId, projectId))).limit(1);
  const [o] = await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.projectId, projectId))).limit(1);
  return Boolean(e || o);
}

/** Receipts I added on a job from the site app (workers see only their own). */
export async function myReceipts(tx: Tx, orgId: string, memberId: string, projectId: string) {
  return tx
    .select({ id: expenses.id, description: expenses.description, supplier: expenses.supplier, spentOn: expenses.spentOn, totalPence: expenses.totalPence, receipts: expenses.receipts })
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.projectId, projectId), eq(expenses.createdByMemberId, memberId)))
    .orderBy(desc(expenses.createdAt))
    .limit(20);
}
