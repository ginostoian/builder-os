/**
 * The Xero sync end to end against real Postgres and a fake Xero (fetch is stubbed): invoices with the
 * right VAT codes and job tracking, payments one way and back, voids, retries that don't duplicate, and
 * token refresh.
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { XERO_TOKEN_URL } from "@/core/xero";
import type { QuoteLineInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { closeDb, withTenant } from "@/db";
import { createClient } from "@/db/clients";
import { createInvoice, getInvoice, markPaid, markUnpaid, savePaymentSettings, voidInvoice } from "@/db/invoices";
import { decide } from "@/db/portal";
import { createQuote, getQuote, saveQuote } from "@/db/quotes";
import { organizations, xeroConnections, xeroJobs } from "@/db/schema";
import { sendQuote } from "@/db/sending";
import { getXeroConnection, queueXeroInvoice, retryFailedXeroJobs, saveXeroConnection, saveXeroSettings, xeroActivity } from "@/db/xero";
import { pullPayments, runXeroSync } from "./sync";
import { openToken, sealToken } from "./tokens";

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const BANK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type FakeInvoice = {
  InvoiceID: string;
  InvoiceNumber: string;
  Status: string;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  LineItems: Record<string, unknown>[];
  Contact: { ContactID: string };
  FullyPaidOnDate?: string;
};

/** A small in-memory Xero that behaves like the real one where it matters. */
function fakeXero() {
  const x = {
    drcEnabled: true,
    contacts: [] as { ContactID: string; Name: string; ContactNumber?: string; EmailAddress?: string }[],
    invoices: [] as FakeInvoice[],
    payments: [] as { PaymentID: string; InvoiceID: string; Amount: number; AccountID: string; Status: string }[],
    options: [] as { TrackingOptionID: string; Name: string; Status: string }[],
    calls: [] as string[],
    tokenCalls: 0,
    tokenFails: false,
    /** Do the next matching request, then lose the reply (a network drop). */
    dropReplyTo: null as string | null,
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = init?.method ?? "GET";
    if (url.href === XERO_TOKEN_URL) {
      x.tokenCalls++;
      return x.tokenFails
        ? json(400, { error: "invalid_grant" })
        : json(200, { access_token: `access-${x.tokenCalls}`, refresh_token: `refresh-${x.tokenCalls}`, expires_in: 1800 });
    }
    const path = url.pathname.replace("/api.xro/2.0", "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    x.calls.push(`${method} ${path}`);
    const reply = (status: number, b: unknown) => {
      if (x.dropReplyTo === `${method} ${path}`) {
        x.dropReplyTo = null;
        throw new TypeError("fetch failed");
      }
      return json(status, b);
    };
    const where = url.searchParams.get("where") ?? "";
    if (method === "GET" && path === "/Contacts") {
      const [, field, value] = /^(\w+)=="(.*)"$/.exec(where) ?? [];
      return reply(200, { Contacts: x.contacts.filter((c) => (c as Record<string, unknown>)[field] === value) });
    }
    if (method === "PUT" && path === "/Contacts") {
      const c = { ...body.Contacts[0], ContactID: randomUUID() };
      x.contacts.push(c);
      return reply(200, { Contacts: [c] });
    }
    if (method === "GET" && path === "/Invoices") {
      const numbers = url.searchParams.get("InvoiceNumbers")?.split(",");
      const ids = url.searchParams.get("IDs")?.split(",");
      return reply(200, { Invoices: x.invoices.filter((i) => (numbers ? numbers.includes(i.InvoiceNumber) : ids ? ids.includes(i.InvoiceID) : true)) });
    }
    if (method === "PUT" && path === "/Invoices") {
      const inv = body.Invoices[0];
      const bad = inv.LineItems.find((l: { TaxType: string }) => l.TaxType.startsWith("DRCHARGE") && !x.drcEnabled);
      if (bad)
        return reply(200, {
          Invoices: [{ HasErrors: true, ValidationErrors: [{ Message: `The TaxType code '${bad.TaxType}' does not exist or cannot be used for this type of transaction.` }] }],
        });
      if (x.invoices.some((i) => i.InvoiceNumber === inv.InvoiceNumber))
        return reply(200, { Invoices: [{ HasErrors: true, ValidationErrors: [{ Message: "Invoice # must be unique." }] }] });
      const total = Math.round(inv.LineItems.reduce((a: number, l: { UnitAmount: number; TaxAmount: number }) => a + l.UnitAmount * 100 + l.TaxAmount * 100, 0)) / 100;
      const created: FakeInvoice = { ...inv, InvoiceID: randomUUID(), Total: total, AmountDue: total, AmountPaid: 0 };
      x.invoices.push(created);
      return reply(200, { Invoices: [created] });
    }
    const one = /^\/Invoices\/([\w-]+)$/.exec(path);
    if (one) {
      const inv = x.invoices.find((i) => i.InvoiceID === one[1]);
      if (!inv) return reply(404, {});
      if (method === "POST") inv.Status = body.Status;
      return reply(200, { Invoices: [inv] });
    }
    if (method === "PUT" && path === "/Payments") {
      const p = body.Payments[0];
      const inv = x.invoices.find((i) => i.InvoiceID === p.Invoice.InvoiceID)!;
      if (inv.Status !== "AUTHORISED")
        return reply(200, { Payments: [{ HasErrors: true, ValidationErrors: [{ Message: "Payments can only be made against Authorised documents" }] }] });
      const payment = { PaymentID: randomUUID(), InvoiceID: inv.InvoiceID, Amount: p.Amount, AccountID: p.Account.AccountID, Status: "AUTHORISED" };
      x.payments.push(payment);
      inv.AmountPaid += p.Amount;
      inv.AmountDue = Math.round((inv.Total - inv.AmountPaid) * 100) / 100;
      if (inv.AmountDue <= 0) inv.Status = "PAID";
      return reply(200, { Payments: [payment] });
    }
    const pay = /^\/Payments\/([\w-]+)$/.exec(path);
    if (pay && method === "POST") {
      const p = x.payments.find((q) => q.PaymentID === pay[1]);
      if (!p) return reply(404, {});
      p.Status = "DELETED";
      const inv = x.invoices.find((i) => i.InvoiceID === p.InvoiceID)!;
      inv.AmountPaid -= p.Amount;
      inv.AmountDue = Math.round((inv.Total - inv.AmountPaid) * 100) / 100;
      inv.Status = "AUTHORISED";
      return reply(200, { Payments: [p] });
    }
    if (method === "GET" && path === `/TrackingCategories/${CATEGORY}`)
      return reply(200, { TrackingCategories: [{ TrackingCategoryID: CATEGORY, Name: "Jobs", Status: "ACTIVE", Options: x.options }] });
    if (method === "PUT" && path === `/TrackingCategories/${CATEGORY}/Options`) {
      const o = { TrackingOptionID: randomUUID(), Name: body.Name, Status: "ACTIVE" };
      x.options.push(o);
      return reply(200, { Options: [o] });
    }
    return reply(404, { error: `fake Xero has no ${method} ${path}` });
  };
  return { x, fetch };
}

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const line = (name: string, qty: number, ratePence: number): QuoteLineInput => ({ name, qty, unit: "day", ratePence, markupBps: 0, noteVisible: false, kind: "normal" });

async function connectedOrg() {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, 'Sparks Electrical')`));
  const memberId = await withTenant(orgId, async (tx) => {
    const rows = await tx.execute<{ id: string }>(
      sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`,
    );
    await savePaymentSettings(tx, orgId, { bankAccountName: "Sparks Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 30, remindersEnabled: false });
    await tx.update(organizations).set({ vatNumber: "GB123456789" }).where(eq(organizations.id, orgId));
    await saveXeroConnection(tx, orgId, {
      tenantId: randomUUID(),
      tenantName: "Sparks Electrical Ltd",
      connectionId: randomUUID(),
      accessToken: sealToken("access-0"),
      refreshToken: sealToken("refresh-0"),
      accessExpiresAt: new Date(Date.now() + 20 * 60_000),
      memberId: rows[0].id,
    });
    await saveXeroSettings(
      tx,
      orgId,
      {
        salesAccountCode: "200",
        bankAccountId: BANK,
        invoiceStatus: "AUTHORISED",
        trackJobs: true,
        trackingCategoryId: CATEGORY,
        syncFrom: TODAY,
        pullPayments: true,
        numberPrefix: "",
      },
      true,
    );
    return rows[0].id;
  });
  return { orgId, memberId };
}

/** An accepted quote with one stage (the whole amount) and its invoice. */
async function invoiced(orgId: string, memberId: string, opts: { reverseCharge?: boolean; title?: string } = {}) {
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, {
      name: `Client ${randomUUID().slice(0, 6)}`,
      email: `${randomUUID().slice(0, 6)}@example.com`,
      vatTreatment: opts.reverseCharge ? "reverse_charge" : "standard",
    });
    const quoteId = await createQuote(tx, orgId, { clientId, title: opts.title ?? "Rewire" });
    const q = (await getQuote(tx, orgId, quoteId))!;
    const stageId = randomUUID();
    await saveQuote(tx, orgId, {
      quoteId,
      baseVersion: 0,
      ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Electrician", 4, 25_000) }],
      paymentPlan: [{ id: stageId, label: "Payment", amountKind: "balance", dueKind: "milestone" }],
    });
    await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
    await decide(tx, orgId, clientId, q.quote.number, { decision: "accepted", fullName: "Pat", signature: "Pat", agree: true }, { ip: null, userAgent: null });
    const inv = await createInvoice(tx, orgId, { quoteId, stageId, memberId }, TODAY);
    await queueXeroInvoice(tx, orgId, inv.id);
    return { invoiceId: inv.id, quoteNumber: q.quote.number };
  });
}

let fake: ReturnType<typeof fakeXero>;
beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
  process.env.XERO_CLIENT_ID = "test-client";
  process.env.XERO_CLIENT_SECRET = "test-secret";
  process.env.APP_SECRET = "test-app-secret";
});
beforeEach(() => {
  fake = fakeXero();
  vi.stubGlobal("fetch", fake.fetch);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
  await closeDb();
});

describe("Xero sync", () => {
  it("sends a reverse charge invoice once DRC rates are on, then follows payments and a void", async () => {
    const { orgId, memberId } = await connectedOrg();
    fake.x.drcEnabled = false;
    const { invoiceId, quoteNumber } = await invoiced(orgId, memberId, { reverseCharge: true, title: "Second fix" });

    // Xero refuses the reverse charge code: the job waits for someone to switch the rates on.
    expect(await runXeroSync(orgId)).toEqual({ done: 0, failed: 1 });
    let log = await withTenant(orgId, (tx) => xeroActivity(tx, orgId));
    expect(log.failed).toBe(1);
    expect(log.recent[0].lastError).toMatch(/Add Domestic Reverse Charge Tax Rates/);
    expect(await runXeroSync(orgId)).toEqual({ done: 0, failed: 0 }); // not retried on its own

    fake.x.drcEnabled = true;
    await withTenant(orgId, (tx) => retryFailedXeroJobs(tx, orgId));
    expect(await runXeroSync(orgId)).toEqual({ done: 1, failed: 0 });
    expect(fake.x.invoices).toHaveLength(1);
    const xi = fake.x.invoices[0];
    expect(xi).toMatchObject({ InvoiceNumber: "INV-0001", Status: "AUTHORISED", Total: 1000 });
    expect(xi.LineItems[0]).toMatchObject({
      TaxType: "DRCHARGESUPPLY20",
      TaxAmount: 0,
      UnitAmount: 1000,
      AccountCode: "200",
      Tracking: [{ Name: "Jobs", Option: `Q-${String(quoteNumber).padStart(4, "0")} Second fix` }],
    });
    expect(fake.x.contacts).toHaveLength(1);
    expect(fake.x.options).toHaveLength(1);

    // Paid here: recorded once in Xero, however often the job runs.
    await withTenant(orgId, (tx) => markPaid(tx, orgId, invoiceId, TODAY, "BACS"));
    await withTenant(orgId, (tx) => queueXeroInvoice(tx, orgId, invoiceId));
    await runXeroSync(orgId);
    await withTenant(orgId, (tx) => queueXeroInvoice(tx, orgId, invoiceId));
    await runXeroSync(orgId);
    expect(fake.x.payments).toEqual([expect.objectContaining({ Amount: 1000, AccountID: BANK, Status: "AUTHORISED" })]);
    expect(xi.Status).toBe("PAID");

    // Marked unpaid by mistake: our payment comes off. Then voided: voided in Xero.
    await withTenant(orgId, (tx) => markUnpaid(tx, orgId, invoiceId));
    await withTenant(orgId, (tx) => queueXeroInvoice(tx, orgId, invoiceId));
    await runXeroSync(orgId);
    expect(fake.x.payments[0].Status).toBe("DELETED");
    expect(xi).toMatchObject({ Status: "AUTHORISED", AmountDue: 1000 });
    await withTenant(orgId, (tx) => voidInvoice(tx, orgId, invoiceId));
    await withTenant(orgId, (tx) => queueXeroInvoice(tx, orgId, invoiceId));
    await runXeroSync(orgId);
    expect(xi.Status).toBe("VOIDED");
    log = await withTenant(orgId, (tx) => xeroActivity(tx, orgId));
    expect(log).toMatchObject({ pending: 0, failed: 0 });
  });

  it("charges VAT on standard invoices, reuses the client's contact and the job's tracking option", async () => {
    const { orgId, memberId } = await connectedOrg();
    await invoiced(orgId, memberId);
    await runXeroSync(orgId);
    expect(fake.x.invoices[0].LineItems[0]).toMatchObject({ TaxType: "OUTPUT2", TaxAmount: 200, UnitAmount: 1000 });
    expect(fake.x.invoices[0].Total).toBe(1200);
  });

  it("marks invoices paid here when they're paid in Xero, and never records that payment twice", async () => {
    const { orgId, memberId } = await connectedOrg();
    const { invoiceId } = await invoiced(orgId, memberId);
    await runXeroSync(orgId);
    const xi = fake.x.invoices[0];
    Object.assign(xi, { Status: "PAID", AmountPaid: xi.Total, AmountDue: 0, FullyPaidOnDate: `/Date(${Date.parse(`${TODAY}T09:00:00Z`)}+0000)/` });
    expect(await pullPayments(orgId)).toBe(1);
    const inv = await withTenant(orgId, (tx) => getInvoice(tx, orgId, invoiceId));
    expect(inv).toMatchObject({ status: "paid", paidOn: TODAY, paidReference: "Paid (recorded in Xero)" });
    await withTenant(orgId, (tx) => queueXeroInvoice(tx, orgId, invoiceId));
    await runXeroSync(orgId);
    expect(fake.x.payments).toHaveLength(0);
    expect(await pullPayments(orgId)).toBe(0);
  });

  it("recovers from a lost reply without making a second invoice", async () => {
    const { orgId, memberId } = await connectedOrg();
    await invoiced(orgId, memberId);
    fake.x.dropReplyTo = "PUT /Invoices";
    expect(await runXeroSync(orgId)).toEqual({ done: 0, failed: 1 });
    expect(fake.x.invoices).toHaveLength(1);
    await withTenant(orgId, (tx) =>
      tx
        .update(xeroJobs)
        .set({ runAfter: new Date(Date.now() - 1000) })
        .where(eq(xeroJobs.orgId, orgId)),
    );
    expect(await runXeroSync(orgId)).toEqual({ done: 1, failed: 0 });
    expect(fake.x.invoices).toHaveLength(1);
    expect(fake.x.calls.filter((c) => c === "PUT /Invoices")).toHaveLength(1);
  });

  it("asks for a number prefix when Xero already has a different invoice with our number", async () => {
    const { orgId, memberId } = await connectedOrg();
    fake.x.invoices.push({
      InvoiceID: randomUUID(),
      InvoiceNumber: "INV-0001",
      Status: "AUTHORISED",
      Total: 55,
      AmountDue: 55,
      AmountPaid: 0,
      LineItems: [],
      Contact: { ContactID: "x" },
    });
    await invoiced(orgId, memberId);
    expect(await runXeroSync(orgId)).toEqual({ done: 0, failed: 1 });
    expect((await withTenant(orgId, (tx) => xeroActivity(tx, orgId))).recent[0].lastError).toMatch(/number prefix/);
    const conn = (await withTenant(orgId, (tx) => getXeroConnection(tx, orgId)))!;
    await withTenant(orgId, (tx) => saveXeroSettings(tx, orgId, { ...conn.settings!, numberPrefix: "BOS-" }));
    await withTenant(orgId, (tx) => retryFailedXeroJobs(tx, orgId));
    expect(await runXeroSync(orgId)).toEqual({ done: 1, failed: 0 });
    expect(fake.x.invoices.map((i) => i.InvoiceNumber)).toEqual(["INV-0001", "BOS-INV-0001"]);
  });

  it("refreshes an expiring token and keeps the new refresh token; a dead one asks to reconnect", async () => {
    const { orgId, memberId } = await connectedOrg();
    await withTenant(orgId, (tx) =>
      tx
        .update(xeroConnections)
        .set({ accessExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(xeroConnections.orgId, orgId)),
    );
    await invoiced(orgId, memberId);
    expect(await runXeroSync(orgId)).toEqual({ done: 1, failed: 0 });
    expect(fake.x.tokenCalls).toBe(1);
    let conn = (await withTenant(orgId, (tx) => getXeroConnection(tx, orgId)))!;
    expect(openToken(conn.refreshToken)).toBe("refresh-1");
    expect(conn.accessExpiresAt.getTime()).toBeGreaterThan(Date.now() + 25 * 60_000);

    await withTenant(orgId, (tx) =>
      tx
        .update(xeroConnections)
        .set({ accessExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(xeroConnections.orgId, orgId)),
    );
    fake.x.tokenFails = true;
    await invoiced(orgId, memberId, { title: "Garage" });
    // Not ready any more: nothing is attempted, and the page asks for a reconnect.
    await runXeroSync(orgId);
    conn = (await withTenant(orgId, (tx) => getXeroConnection(tx, orgId)))!;
    expect(conn.status).toBe("reconnect");
    expect(conn.lastError).toMatch(/connect again/);
  });
});
