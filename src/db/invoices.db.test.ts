/** Payment schedules, invoices and reminders, against real Postgres as the app role. */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlanStage } from "@/core/payment-plan";
import type { QuoteLineInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, findOrgsWithDueInvoices, withTenant, type Tx } from "./index";
import {
  InvoiceError,
  claimReminder,
  createStageInvoice,
  getInvoice,
  invoiceTotals,
  invoicesForReminders,
  listInvoices,
  markPaid,
  markUnpaid,
  portalInvoice,
  portalInvoices,
  quoteSchedule,
  savePaymentSettings,
  voidInvoice,
} from "./invoices";
import { decide } from "./portal";
import { createQuote, getQuote, saveQuote } from "./quotes";
import { sendQuote } from "./sending";

const TODAY = "2026-10-03";
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const line = (name: string, qty: number, ratePence: number): QuoteLineInput => ({ name, qty, unit: "m²", ratePence, markupBps: 1500, noteVisible: false, kind: "normal" });
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof InvoiceError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );
const bank = { bankAccountName: "Hale & Sons Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 14, remindersEnabled: true };

async function newOrg(name: string, withBank = true) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`);
    if (withBank) await savePaymentSettings(tx, orgId, bank);
    return rows[0].id;
  });
  return { orgId, memberId };
}

const version = async (tx: Tx, orgId: string, quoteId: string) => (await getQuote(tx, orgId, quoteId))!.quote.version;

/** An accepted quote (total £124.10 inc. VAT) with a deposit, a dated payment and the balance. */
async function acceptedQuote(orgId: string, memberId: string, plan?: PlanStage[]) {
  const stages = plan ?? [
    { id: randomUUID(), label: "Deposit", amountKind: "percent", amountValue: 2500, dueKind: "on_acceptance" },
    { id: randomUUID(), label: "First fix", amountKind: "fixed", amountValue: 5_000, dueKind: "date", dueDate: "2026-11-02" },
    { id: randomUUID(), label: "Completion", amountKind: "balance", dueKind: "milestone" },
  ];
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com" });
    const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen" });
    const q = (await getQuote(tx, orgId, quoteId))!;
    await saveQuote(tx, orgId, {
      quoteId,
      baseVersion: 0,
      ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Skim", 6.2, 1_450) }],
      paymentPlan: stages,
    });
    await sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId });
    await decide(tx, orgId, clientId, q.quote.number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: null });
    return { clientId, quoteId, stages };
  });
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("payment schedules and invoices", () => {
  it("raises one invoice per stage with frozen amounts, bank details and sensible due dates", async () => {
    const { orgId, memberId } = await newOrg("Invoices");
    const { quoteId, stages } = await acceptedQuote(orgId, memberId);
    await withTenant(orgId, async (tx) => {
      const schedule = (await quoteSchedule(tx, orgId, quoteId))!;
      expect(schedule.map((s) => [s.label, s.amount, s.invoice])).toEqual([
        ["Deposit", 3_103, null],
        ["First fix", 5_000, null],
        ["Completion", 12_410 - 3_103 - 5_000, null],
      ]);

      const deposit = await createStageInvoice(tx, orgId, { quoteId, stageId: stages[0].id, memberId }, TODAY);
      expect(deposit).toMatchObject({ number: 1, dueDate: "2026-10-17", totalPence: 3_103, clientEmail: "sarah@example.com" });
      expect(deposit.snapshot).toMatchObject({ ref: "INV-0001", bank: { sortCode: "123456", accountNumber: "12345678" }, description: expect.stringContaining("Deposit") });
      // A dated stage still ahead is due on its date.
      const firstFix = await createStageInvoice(tx, orgId, { quoteId, stageId: stages[1].id, memberId }, TODAY);
      expect(firstFix).toMatchObject({ number: 2, dueDate: "2026-11-02" });

      const inv = (await getInvoice(tx, orgId, deposit.id))!;
      expect(inv.netPence + inv.vatPence).toBe(3_103);
      expect(inv.vatPence).toBe(3_103 - Math.round(3_103 / 1.2));
      expect((await quoteSchedule(tx, orgId, quoteId))!.map((s) => s.invoice?.number ?? null)).toEqual([1, 2, null]);
    });
  });

  it("refuses unaccepted quotes, unknown stages, missing bank details and a second invoice per stage", async () => {
    const { orgId, memberId } = await newOrg("Invoice rules");
    const { quoteId, stages } = await acceptedQuote(orgId, memberId);
    const create = (stageId: string) => withTenant(orgId, (tx) => createStageInvoice(tx, orgId, { quoteId, stageId, memberId }, TODAY));
    expect(await reason(create(randomUUID()))).toBe("unknown_stage");
    expect(await reason(create(stages[0].id))).toBe("ok");
    expect(await reason(create(stages[0].id))).toBe("already_invoiced");
    expect(await reason(withTenant(orgId, (tx) => createStageInvoice(tx, orgId, { quoteId: randomUUID(), stageId: stages[0].id, memberId }, TODAY)))).toBe("not_accepted");

    const noBank = await newOrg("No bank", false);
    const other = await acceptedQuote(noBank.orgId, noBank.memberId);
    expect(await reason(withTenant(noBank.orgId, (tx) => createStageInvoice(tx, noBank.orgId, { quoteId: other.quoteId, stageId: other.stages[0].id, memberId: noBank.memberId }, TODAY)))).toBe("no_bank_details");
  });

  it("moves between unpaid, paid and void, and a voided stage can be invoiced again", async () => {
    const { orgId, memberId } = await newOrg("Status");
    const { quoteId, stages } = await acceptedQuote(orgId, memberId);
    const first = await withTenant(orgId, (tx) => createStageInvoice(tx, orgId, { quoteId, stageId: stages[0].id, memberId }, TODAY));

    await withTenant(orgId, (tx) => markPaid(tx, orgId, first.id, "2026-10-05", "SMITH KITCHEN"));
    expect(await reason(withTenant(orgId, (tx) => markPaid(tx, orgId, first.id, "2026-10-05")))).toBe("not_open");
    expect(await reason(withTenant(orgId, (tx) => voidInvoice(tx, orgId, first.id)))).toBe("not_open");
    await withTenant(orgId, async (tx) => {
      expect(await getInvoice(tx, orgId, first.id)).toMatchObject({ status: "paid", paidOn: "2026-10-05", paidReference: "SMITH KITCHEN" });
      expect(await invoiceTotals(tx, orgId, "2026-10-20")).toMatchObject({ outstanding: 0, paidThisMonth: 3_103 });
    });

    await withTenant(orgId, (tx) => markUnpaid(tx, orgId, first.id));
    expect(await reason(withTenant(orgId, (tx) => markUnpaid(tx, orgId, first.id)))).toBe("not_paid");
    await withTenant(orgId, async (tx) => {
      expect(await getInvoice(tx, orgId, first.id)).toMatchObject({ status: "issued", paidOn: null, paidReference: null });
      expect(await invoiceTotals(tx, orgId, "2026-10-20")).toMatchObject({ outstanding: 3_103, overdue: 3_103, overdueCount: 1 });
      expect((await listInvoices(tx, orgId, "overdue", "2026-10-20")).map((i) => i.number)).toEqual([1]);
      expect(await listInvoices(tx, orgId, "overdue", "2026-10-10")).toEqual([]);
    });

    await withTenant(orgId, (tx) => voidInvoice(tx, orgId, first.id));
    const again = await withTenant(orgId, (tx) => createStageInvoice(tx, orgId, { quoteId, stageId: stages[0].id, memberId }, TODAY));
    expect(again.number).toBe(2);
    expect(await reason(withTenant(orgId, (tx) => markPaid(tx, orgId, randomUUID(), TODAY)))).toBe("not_found");
  });

  it("keeps invoices' amounts fixed and reminders append-only", async () => {
    const { orgId, memberId } = await newOrg("Records");
    const { quoteId, stages } = await acceptedQuote(orgId, memberId);
    const inv = await withTenant(orgId, (tx) => createStageInvoice(tx, orgId, { quoteId, stageId: stages[0].id, memberId }, TODAY));
    await withTenant(orgId, (tx) => claimReminder(tx, orgId, inv.id, "before"));
    const raw = postgres(appUrl(), { max: 1, onnotice: () => {} });
    try {
      for (const stmt of ["update invoices set total_pence = 1", "update invoices set due_date = '2030-01-01'", "update invoices set snapshot = '{}'", "delete from invoices", "delete from invoice_reminders", "update invoice_reminders set kind = 'due'"]) {
        await raw
          .begin(async (t) => {
            await t`select set_config('app.org_id', ${orgId}, true)`;
            await t.unsafe(stmt);
          })
          .then(
            () => expect.unreachable(stmt),
            (e: { code?: string }) => expect(e.code, stmt).toBe("42501"),
          );
      }
    } finally {
      await raw.end();
    }
  });
});

describe("reminders", () => {
  it("finds companies with invoices due, and claims each reminder once", async () => {
    const { orgId, memberId } = await newOrg("Reminders");
    const { quoteId, stages } = await acceptedQuote(orgId, memberId);
    const inv = await withTenant(orgId, (tx) => createStageInvoice(tx, orgId, { quoteId, stageId: stages[0].id, memberId }, TODAY));

    expect(await findOrgsWithDueInvoices("2026-10-16")).not.toContain(orgId);
    expect(await findOrgsWithDueInvoices("2026-10-17")).toContain(orgId);
    await withTenant(orgId, async (tx) => {
      const due = await invoicesForReminders(tx, orgId, "2026-10-17");
      expect(due.map((d) => [d.id, d.dueDate, [...d.sent]])).toEqual([[inv.id, "2026-10-17", []]]);
      expect(await claimReminder(tx, orgId, inv.id, "before")).toBe(true);
      expect(await claimReminder(tx, orgId, inv.id, "before")).toBe(false);
      expect([...(await invoicesForReminders(tx, orgId, "2026-10-17"))[0].sent]).toEqual(["before"]);
    });

    // Switched off, or paid: no more reminders.
    await withTenant(orgId, (tx) => savePaymentSettings(tx, orgId, { ...bank, remindersEnabled: false }));
    expect(await findOrgsWithDueInvoices("2026-10-17")).not.toContain(orgId);
    await withTenant(orgId, async (tx) => expect(await invoicesForReminders(tx, orgId, "2026-10-17")).toEqual([]));
    await withTenant(orgId, (tx) => savePaymentSettings(tx, orgId, bank));
    await withTenant(orgId, (tx) => markPaid(tx, orgId, inv.id, TODAY));
    expect(await findOrgsWithDueInvoices("2026-10-17")).not.toContain(orgId);
  });
});

describe("isolation", () => {
  it("never shows one client another client's invoices, or another company's", async () => {
    const a = await newOrg("Iso A");
    const b = await newOrg("Iso B");
    const qa = await acceptedQuote(a.orgId, a.memberId);
    const qa2 = await acceptedQuote(a.orgId, a.memberId);
    const qb = await acceptedQuote(b.orgId, b.memberId);
    const ia = await withTenant(a.orgId, (tx) => createStageInvoice(tx, a.orgId, { quoteId: qa.quoteId, stageId: qa.stages[0].id, memberId: a.memberId }, TODAY));
    await withTenant(b.orgId, (tx) => createStageInvoice(tx, b.orgId, { quoteId: qb.quoteId, stageId: qb.stages[0].id, memberId: b.memberId }, TODAY));

    await withTenant(a.orgId, async (tx) => {
      expect((await portalInvoices(tx, a.orgId, qa.clientId)).map((i) => i.id)).toEqual([ia.id]);
      expect(await portalInvoices(tx, a.orgId, qa2.clientId)).toEqual([]);
      expect(await portalInvoice(tx, a.orgId, qa2.clientId, ia.number)).toBeUndefined();
      expect((await listInvoices(tx, a.orgId)).map((i) => i.id)).toEqual([ia.id]);
    });
    // Company B can't see or change A's invoice, even by id.
    await withTenant(b.orgId, async (tx) => expect(await getInvoice(tx, b.orgId, ia.id)).toBeUndefined());
    expect(await reason(withTenant(b.orgId, (tx) => markPaid(tx, b.orgId, ia.id, TODAY)))).toBe("not_found");
    expect(await reason(withTenant(b.orgId, (tx) => quoteSchedule(tx, b.orgId, qa.quoteId)))).toBe("ok");
    await withTenant(b.orgId, async (tx) => expect(await quoteSchedule(tx, b.orgId, qa.quoteId)).toBeNull());
  });
});
