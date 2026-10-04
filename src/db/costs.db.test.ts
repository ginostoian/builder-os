/** Job costs: expenses and receipts, recharges billed to the client, purchase orders, and the costing summary. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExpenseInput, QuoteLineInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import {
  CostError,
  addReceipt,
  costingReport,
  createExpense,
  createPurchaseOrder,
  deleteExpense,
  deletePurchaseOrder,
  getPurchaseOrder,
  jobCosting,
  listExpenses,
  listPurchaseOrders,
  myReceipts,
  rechargesForQuote,
  removeReceipt,
  setPurchaseOrderStatus,
  setRecovered,
  updateExpense,
  updatePurchaseOrder,
} from "./costs";
import { closeDb, withTenant } from "./index";
import { InvoiceError, createInvoice, getInvoice, savePaymentSettings, voidInvoice } from "./invoices";
import { decide } from "./portal";
import { createProject, createProjectFromQuote } from "./projects";
import { createQuote, getQuote, saveQuote } from "./quotes";
import { sendQuote } from "./sending";
import { checkIn } from "./site";
import { createWorker } from "./team";

const TODAY = "2026-10-05";
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof CostError || e instanceof InvoiceError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );
const qline = (name: string, qty: number, ratePence: number): QuoteLineInput => ({ name, qty, unit: "m²", ratePence, markupBps: 2500, noteVisible: false, kind: "normal" });

async function newOrg(name: string, vatNumber: string | null = "GB123456789") {
  const orgId = randomUUID();
  await withTenant(orgId, async (tx) => {
    await tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`);
    await tx.execute(sql`update organizations set vat_number = ${vatNumber} where id = ${orgId}`);
  });
  const memberId = await withTenant(orgId, async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`);
    await savePaymentSettings(tx, orgId, { bankAccountName: "Hale Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 14, remindersEnabled: true });
    return rows[0].id;
  });
  return { orgId, memberId };
}

/** An accepted quote (cost £2,000, sells £2,500 + VAT) and its project. */
async function job(orgId: string, memberId: string) {
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com" });
    const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen" });
    const q = (await getQuote(tx, orgId, quoteId))!;
    await saveQuote(tx, orgId, { quoteId, baseVersion: 0, ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: qline("Skim", 100, 2_000) }] });
    await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
    await decide(tx, orgId, clientId, q.quote.number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: null });
    const projectId = await createProjectFromQuote(tx, orgId, { quoteId, tasksFromLines: false }, memberId);
    return { clientId, quoteId, projectId };
  });
}

const exp = (projectId: string, over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  projectId,
  category: "materials",
  supplier: "Travis Perkins",
  description: "Plasterboard and screws",
  spentOn: TODAY,
  totalPence: 12_000,
  vatPence: 2_000,
  rechargeable: false,
  rechargeMarkupBps: 0,
  ...over,
});

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("job costs", () => {
  it("records expenses with receipts, net of VAT, and keeps billed ones fixed", async () => {
    const { orgId, memberId } = await newOrg("Costs expenses");
    const { projectId } = await job(orgId, memberId);
    const id = await withTenant(orgId, (tx) => createExpense(tx, orgId, exp(projectId), memberId));
    await withTenant(orgId, async (tx) => {
      await addReceipt(tx, orgId, id, { key: "orgs/x/receipts/a.jpg", contentType: "image/jpeg" });
      await addReceipt(tx, orgId, id, { key: "orgs/x/receipts/b.pdf", contentType: "application/pdf" });
      const [row] = await listExpenses(tx, orgId, { projectId });
      expect(row).toMatchObject({ netPence: 10_000, vatPence: 2_000, totalPence: 12_000, createdByName: "Jo" });
      expect(row.receipts.map((r) => r.key)).toEqual(["orgs/x/receipts/a.jpg", "orgs/x/receipts/b.pdf"]);
      expect(await removeReceipt(tx, orgId, id, "orgs/x/receipts/a.jpg")).toBe(true);
      expect(await removeReceipt(tx, orgId, id, "orgs/x/receipts/a.jpg")).toBe(false);
      expect(await listExpenses(tx, orgId, { filter: "no_receipt" })).toEqual([]);
      for (let i = 0; i < 5; i++) await addReceipt(tx, orgId, id, { key: `k${i}`, contentType: "image/jpeg" });
    });
    expect(await reason(withTenant(orgId, (tx) => addReceipt(tx, orgId, id, { key: "k9", contentType: "image/jpeg" })))).toBe("too_many_receipts");
    // From the site app, only onto your own receipts.
    const other = await withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + randomUUID().slice(0, 8)}, 'employee', 'Dave') returning id`))[0].id);
    const daves = await withTenant(orgId, (tx) => createExpense(tx, orgId, exp(projectId), other));
    expect(await reason(withTenant(orgId, (tx) => addReceipt(tx, orgId, daves, { key: "d1", contentType: "image/jpeg" }, memberId)))).toBe("not_found");
    await withTenant(orgId, (tx) => addReceipt(tx, orgId, daves, { key: "d1", contentType: "image/jpeg" }, other));
    // VAT bigger than the total is refused by the database too.
    expect(await reason(withTenant(orgId, (tx) => createExpense(tx, orgId, exp(projectId, { totalPence: 100, vatPence: 200 }), memberId)))).toBe("23514");
    expect((await withTenant(orgId, (tx) => myReceipts(tx, orgId, other, projectId))).map((r) => r.id)).toEqual([daves]);
    const keys = await withTenant(orgId, (tx) => deleteExpense(tx, orgId, id));
    expect(keys).toHaveLength(6);
  });

  it("bills purchases made for the client back on an invoice, once", async () => {
    const { orgId, memberId } = await newOrg("Costs recharge");
    const { quoteId, projectId } = await job(orgId, memberId);
    const boiler = await withTenant(orgId, (tx) => createExpense(tx, orgId, exp(projectId, { description: "Worcester boiler", supplier: "Screwfix", totalPence: 120_000, vatPence: 20_000, rechargeable: true, rechargeMarkupBps: 1000 }), memberId));
    const tiles = await withTenant(orgId, (tx) => createExpense(tx, orgId, exp(projectId, { description: "Client's tiles", totalPence: 6_000, vatPence: 1_000, rechargeable: true }), memberId));
    const recharges = await withTenant(orgId, (tx) => rechargesForQuote(tx, orgId, quoteId));
    expect(recharges.map((r) => [r.description, r.amount])).toEqual([
      ["Worcester boiler", 110_000],
      ["Client's tiles", 5_000],
    ]);
    const inv = await withTenant(orgId, (tx) => createInvoice(tx, orgId, { quoteId, expenseIds: [boiler], memberId }, TODAY));
    expect(inv.totalPence).toBe(132_000);
    expect(inv.snapshot.lines).toEqual([{ description: "Purchased on your behalf: Worcester boiler (Screwfix)", net: 110_000, vat: 22_000, total: 132_000 }]);
    await withTenant(orgId, async (tx) => {
      expect((await rechargesForQuote(tx, orgId, quoteId)).map((r) => r.id)).toEqual([tiles]);
      expect(await reason(createInvoice(tx, orgId, { quoteId, expenseIds: [boiler], memberId }, TODAY))).toBe("unknown_recharge");
    });
    // Billed: fixed until the invoice is cancelled.
    expect(await reason(withTenant(orgId, (tx) => updateExpense(tx, orgId, boiler, exp(projectId, { rechargeable: false }))))).toBe("invoiced");
    expect(await reason(withTenant(orgId, (tx) => deleteExpense(tx, orgId, boiler)))).toBe("invoiced");
    await withTenant(orgId, (tx) => voidInvoice(tx, orgId, inv.id));
    expect((await withTenant(orgId, (tx) => rechargesForQuote(tx, orgId, quoteId))).map((r) => r.id).sort()).toEqual([boiler, tiles].sort());
    // Paid back in cash: off the list without an invoice.
    await withTenant(orgId, (tx) => setRecovered(tx, orgId, tiles, TODAY));
    expect((await withTenant(orgId, (tx) => rechargesForQuote(tx, orgId, quoteId))).map((r) => r.id)).toEqual([boiler]);
    expect((await withTenant(orgId, (tx) => listExpenses(tx, orgId, { filter: "to_recharge" }))).map((r) => r.id)).toEqual([boiler]);
    expect((await withTenant(orgId, (tx) => getInvoice(tx, orgId, inv.id)))!.status).toBe("void");
  });

  it("numbers purchase orders and moves them from draft to delivered", async () => {
    const { orgId, memberId } = await newOrg("Costs PO");
    const { projectId } = await job(orgId, memberId);
    const line = { id: randomUUID(), description: "12.5mm plasterboard", qty: 40, unit: "sheet", unitPricePence: 850 };
    const po = await withTenant(orgId, (tx) => createPurchaseOrder(tx, orgId, { projectId, supplierName: "Travis Perkins", vatRateBps: 2000, lines: [line] }, memberId));
    const po2 = await withTenant(orgId, (tx) => createPurchaseOrder(tx, orgId, { projectId, supplierName: "Jewson", vatRateBps: 2000, lines: [] }, memberId));
    await withTenant(orgId, async (tx) => {
      const [second, first] = await listPurchaseOrders(tx, orgId, { projectId });
      expect([first.number, second.number]).toEqual([1, 2]);
      expect(first).toMatchObject({ netPence: 34_000, status: "draft", lineCount: 1, billedPence: 0 });
      await updatePurchaseOrder(tx, orgId, po, { supplierName: "Travis Perkins", vatRateBps: 2000, lines: [{ ...line, qty: 50 }], neededBy: "2026-10-09" });
      await setPurchaseOrderStatus(tx, orgId, po, "ordered", TODAY);
      await setPurchaseOrderStatus(tx, orgId, po, "delivered", "2026-10-08");
      const got = (await getPurchaseOrder(tx, orgId, po))!;
      expect(got.po).toMatchObject({ status: "delivered", orderedOn: TODAY, netPence: 42_500, neededBy: "2026-10-09" });
      await createExpense(tx, orgId, exp(projectId, { purchaseOrderId: po, totalPence: 51_000, vatPence: 8_500 }), memberId);
      expect((await getPurchaseOrder(tx, orgId, po))!.bills).toHaveLength(1);
    });
    // Ordered ones can't be deleted (cancel instead); drafts can.
    expect(await reason(withTenant(orgId, (tx) => deletePurchaseOrder(tx, orgId, po)))).toBe("not_editable");
    await withTenant(orgId, (tx) => deletePurchaseOrder(tx, orgId, po2));
    await withTenant(orgId, (tx) => setPurchaseOrderStatus(tx, orgId, po, "cancelled", TODAY));
    expect(await reason(withTenant(orgId, (tx) => updatePurchaseOrder(tx, orgId, po, { supplierName: "X", vatRateBps: 0, lines: [] })))).toBe("not_editable");
    // An expense can only point at an order on the same job.
    const other = await withTenant(orgId, async (tx) => createProject(tx, orgId, { name: "Other", clientId: await createClient(tx, orgId, { name: "B" }), status: "booked", shareProgress: false }, memberId));
    expect(await reason(withTenant(orgId, (tx) => createExpense(tx, orgId, exp(other, { purchaseOrderId: po }), memberId)))).toBe("unknown_po");
  });

  it("sets income against costs: expenses, labour at the day rate, committed orders and recharges", async () => {
    const { orgId, memberId } = await newOrg("Costs summary");
    const { projectId } = await job(orgId, memberId);
    const w = await withTenant(orgId, (tx) => createWorker(tx, orgId, { name: "Dave", kind: "employee", dayRatePence: 24_000 }));
    await withTenant(orgId, async (tx) => {
      await tx.execute(sql`update workers set member_id = ${memberId} where id = ${w}`);
      await tx.execute(sql`update projects set manager_member_id = ${memberId} where id = ${projectId}`);
      await createExpense(tx, orgId, exp(projectId), memberId);
      await createExpense(tx, orgId, exp(projectId, { category: "plant", description: "Mini digger", totalPence: 30_000, vatPence: 5_000 }), memberId);
      await createExpense(tx, orgId, exp(projectId, { description: "Taps for the client", rechargeable: true }), memberId);
      // Four hours on site, checked in at £240 a day; the rate changing later doesn't change the past.
      await checkIn(tx, orgId, { workerId: w, memberId }, projectId, undefined);
      await tx.execute(sql`update site_visits set checked_in_at = now() - interval '4 hours', checked_out_at = now() where worker_id = ${w}`);
      await tx.execute(sql`update workers set day_rate_pence = 99000 where id = ${w}`);
      const po = await createPurchaseOrder(tx, orgId, { projectId, supplierName: "Jewson", vatRateBps: 2000, lines: [{ id: randomUUID(), description: "Sand", qty: 2, unit: "bag", unitPricePence: 5_000 }] }, memberId);
      await setPurchaseOrderStatus(tx, orgId, po, "ordered", TODAY);
    });
    const c = (await withTenant(orgId, (tx) => jobCosting(tx, orgId, projectId)))!;
    expect(c.vatRegistered).toBe(true);
    expect(c.quote).toEqual({ quoteNet: 250_000, variationsNet: 0, incomeNet: 250_000, estimate: 200_000 });
    expect(c.byCategory).toEqual({ materials: 10_000, plant: 25_000 });
    expect(c.labour).toEqual([{ workerId: w, name: "Dave", minutes: 240, cost: 12_000, unratedMinutes: 0 }]);
    expect(c).toMatchObject({ expensesTotal: 35_000, labourTotal: 12_000, costsToDate: 47_000, committed: 10_000 });
    expect(c.recharges).toEqual({ total: 10_000, billed: 0, recovered: 0, outstanding: 10_000, count: 1 });
    const report = await withTenant(orgId, (tx) => costingReport(tx, orgId));
    expect(report.rows.find((r) => r.id === projectId)).toMatchObject({ incomeNet: 250_000, estimate: 200_000, expenses: 35_000, labour: 12_000, costs: 47_000, toRecharge: 10_000, labourMinutes: 240 });
  });

  it("counts VAT as a cost for companies that aren't VAT registered", async () => {
    const { orgId, memberId } = await newOrg("Costs no VAT", null);
    const { projectId } = await job(orgId, memberId);
    await withTenant(orgId, (tx) => createExpense(tx, orgId, exp(projectId), memberId));
    const c = (await withTenant(orgId, (tx) => jobCosting(tx, orgId, projectId)))!;
    expect(c).toMatchObject({ vatRegistered: false, expensesTotal: 12_000 });
  });

  it("keeps each company's costs to itself", async () => {
    const a = await newOrg("Costs A");
    const b = await newOrg("Costs B");
    const { projectId } = await job(a.orgId, a.memberId);
    const id = await withTenant(a.orgId, (tx) => createExpense(tx, a.orgId, exp(projectId), a.memberId));
    await withTenant(b.orgId, async (tx) => {
      expect(await listExpenses(tx, b.orgId)).toEqual([]);
      expect(await listExpenses(tx, a.orgId)).toEqual([]);
      expect(await jobCosting(tx, b.orgId, projectId)).toBeUndefined();
      expect(await listPurchaseOrders(tx, a.orgId)).toEqual([]);
    });
    expect(await reason(withTenant(b.orgId, (tx) => createExpense(tx, b.orgId, exp(projectId), b.memberId)))).toBe("unknown_project");
    expect(await reason(withTenant(b.orgId, (tx) => deleteExpense(tx, b.orgId, id)))).toBe("not_found");
  });
});
