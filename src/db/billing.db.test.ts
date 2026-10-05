/** Billing state: only the billing functions change it, and only consistently; Free allowances; paying online. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlement } from "@/core/plans";
import type { QuoteLineInput } from "@/core/schemas";
import postgres from "postgres";
import { adminUrl, appUrl } from "@/test/db-urls";
import { activeServiceCount, applySubscription, billingFacts, hasSeat, seatHolderName, firstSendsSince, markPaidOnline, refundOnline, platformCompanies, setComped, setConnectAccount, setStripeCustomer } from "./billing";
import { invoicePaid } from "@/server/stripe-events";
import { createClient } from "./clients";
import { listNotifications } from "./notifications";
import { closeDb, withTenant } from "./index";
import { createInvoice, savePaymentSettings } from "./invoices";
import { decide } from "./portal";
import { createQuote, getQuote, saveQuote } from "./quotes";
import { sendQuote } from "./sending";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => String((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code ?? e),
  );
const line = (name: string): QuoteLineInput => ({ name, qty: 1, unit: "item", ratePence: 10_000, markupBps: 0, noteVisible: false, kind: "normal" });

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`))[0].id);
  return { orgId, memberId };
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("billing", () => {
  it("gives new companies a 14-day Pro trial, and the app can't change billing columns itself", async () => {
    const { orgId } = await newOrg("Billing trial");
    const facts = await withTenant(orgId, (tx) => billingFacts(tx, orgId));
    expect(facts).toMatchObject({ plan: "free", comped: false, subscriptionStatus: null });
    const days = (facts.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
    expect(entitlement(facts, new Date())).toMatchObject({ plan: "pro", why: "trial" });
    for (const col of ["plan = 'pro'", "comped = true", "trial_ends_at = now() + interval '1 year'", "stripe_customer_id = 'cus_x'", "connect_account_id = 'acct_x'"]) {
      expect(await code(withTenant(orgId, (tx) => tx.execute(sql.raw(`update organizations set ${col} where id = '${orgId}'`))))).toBe("42501");
    }
    expect(await code(withTenant(orgId, (tx) => tx.execute(sql`update invoices set stripe_payment_id = 'pi_x' where false`)))).toBe("ok");
  });

  it("applies subscriptions for the company's own customer only, and never lets an old one win", async () => {
    const a = await newOrg("Billing subs A");
    const b = await newOrg("Billing subs B");
    const cusA = `cus_${randomUUID().replaceAll("-", "")}`;
    const cusB = `cus_${randomUUID().replaceAll("-", "")}`;
    await withTenant(a.orgId, async (tx) => {
      expect(await setStripeCustomer(tx, a.orgId, cusA)).toBe(true);
      // Never re-pointed.
      expect(await setStripeCustomer(tx, a.orgId, cusB)).toBe(false);
    });
    const sub = (id: string, status: string, customerId = cusA) => ({ customerId, subscriptionId: id, plan: "essentials" as const, status, periodEnd: new Date("2026-11-05T00:00:00Z"), cancelAtPeriodEnd: false, monthlyPence: 4900 });
    await withTenant(a.orgId, async (tx) => {
      expect(await applySubscription(tx, a.orgId, sub("sub_one", "active"))).toBe(true);
      // Someone else's customer: refused.
      expect(await applySubscription(tx, a.orgId, sub("sub_evil", "active", cusB))).toBe(false);
    });
    expect(await withTenant(a.orgId, (tx) => billingFacts(tx, a.orgId))).toMatchObject({ plan: "essentials", subscriptionStatus: "active" });
    await withTenant(a.orgId, async (tx) => {
      // Upgrade to a new subscription, then a late "canceled" for the old one changes nothing.
      expect(await applySubscription(tx, a.orgId, { ...sub("sub_two", "active"), plan: "pro" })).toBe(true);
      expect(await applySubscription(tx, a.orgId, sub("sub_one", "canceled"))).toBe(false);
    });
    expect((await withTenant(a.orgId, (tx) => billingFacts(tx, a.orgId))).plan).toBe("pro");
    // Its own subscription ending drops it to Free.
    await withTenant(a.orgId, (tx) => applySubscription(tx, a.orgId, { ...sub("sub_two", "canceled"), plan: "pro" }));
    const ended = await withTenant(a.orgId, (tx) => billingFacts(tx, a.orgId));
    expect(ended).toMatchObject({ plan: "free", subscriptionStatus: "canceled" });
    // A customer can belong to one company only.
    expect(await code(withTenant(b.orgId, (tx) => setStripeCustomer(tx, b.orgId, cusA)))).toBe("23505");
  });

  it("records the company's own Stripe account, and comps companies", async () => {
    const { orgId } = await newOrg("Billing connect");
    const acct = `acct_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    await withTenant(orgId, async (tx) => {
      expect(await setConnectAccount(tx, orgId, acct, false, true)).toBe(true);
      expect(await setConnectAccount(tx, orgId, acct, true, true)).toBe(true);
      expect(await setConnectAccount(tx, orgId, "acct_other", true, true)).toBe(false);
      expect(await setComped(tx, orgId, true)).toBe(true);
    });
    const f = await withTenant(orgId, (tx) => billingFacts(tx, orgId));
    expect(f).toMatchObject({ connectAccountId: acct, connectChargesEnabled: true, comped: true });
    const all = await withTenant(orgId, (tx) => platformCompanies(tx));
    expect(all.find((c) => c.id === orgId)).toMatchObject({ name: "Billing connect", comped: true });
  });

  it("counts first sends for the Free allowance, and marks invoices paid online once", async () => {
    const { orgId, memberId } = await newOrg("Billing usage");
    const since = new Date(Date.now() - 60_000);
    const stageId = randomUUID();
    const { clientId, quoteId, number } = await withTenant(orgId, async (tx) => {
      await savePaymentSettings(tx, orgId, { bankAccountName: "Hale Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 14, remindersEnabled: true });
      const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com" });
      const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen" });
      const q = (await getQuote(tx, orgId, quoteId))!;
      await saveQuote(tx, orgId, {
        quoteId,
        baseVersion: 0,
        ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Skim") }],
        paymentPlan: [{ id: stageId, label: "Full amount", amountKind: "balance", dueKind: "on_acceptance" }],
      });
      await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
      return { clientId, quoteId, number: q.quote.number };
    });
    expect(await withTenant(orgId, (tx) => firstSendsSince(tx, orgId, since))).toBe(1);
    expect(await withTenant(orgId, (tx) => activeServiceCount(tx, orgId))).toBe(0);

    const invoiceId = await withTenant(orgId, async (tx) => {
      await decide(tx, orgId, clientId, number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: null });
      return (await createInvoice(tx, orgId, { quoteId, stageId, memberId })).id;
    });
    // The amount must match the invoice exactly.
    expect(await withTenant(orgId, (tx) => markPaidOnline(tx, orgId, invoiceId, "pi_123", "2026-10-05", 1))).toEqual({ marked: false, reason: "wrong amount" });
    const total = (await withTenant(orgId, (tx) => tx.execute<{ total_pence: number }>(sql`select total_pence from invoices where id = ${invoiceId}`)))[0].total_pence;
    const first = await withTenant(orgId, (tx) => markPaidOnline(tx, orgId, invoiceId, "pi_123", "2026-10-05", total));
    expect(first.marked).toBe(true);
    // The same payment again (Stripe retries): nothing changes.
    expect(await withTenant(orgId, (tx) => markPaidOnline(tx, orgId, invoiceId, "pi_123", "2026-10-05", total))).toEqual({ marked: false, reason: "already paid" });
    const [row] = await withTenant(orgId, (tx) => tx.execute<{ status: string; stripe_payment_id: string }>(sql`select status, stripe_payment_id from invoices where id = ${invoiceId}`));
    expect(row).toEqual({ status: "paid", stripe_payment_id: "pi_123" });

    // Refunds: another payment's refund, or a partial one, leaves it paid; a full refund reopens it, once.
    expect(await withTenant(orgId, (tx) => refundOnline(tx, orgId, invoiceId, "pi_other", true))).toEqual({ changed: false });
    expect(await withTenant(orgId, (tx) => refundOnline(tx, orgId, invoiceId, "pi_123", false))).toMatchObject({ changed: true, reopened: false });
    expect((await withTenant(orgId, (tx) => tx.execute<{ status: string }>(sql`select status from invoices where id = ${invoiceId}`)))[0].status).toBe("paid");
    expect(await withTenant(orgId, (tx) => refundOnline(tx, orgId, invoiceId, "pi_123", true))).toMatchObject({ changed: true, reopened: true, totalPence: total });
    expect(await withTenant(orgId, (tx) => refundOnline(tx, orgId, invoiceId, "pi_123", true))).toEqual({ changed: false });
    const [reopened] = await withTenant(orgId, (tx) => tx.execute(sql`select status, paid_on, paid_reference, stripe_payment_id from invoices where id = ${invoiceId}`));
    expect(reopened).toEqual({ status: "issued", paid_on: null, paid_reference: null, stripe_payment_id: null });
  });

  it("marks an invoice paid from a Stripe payment only on the company's own account", async () => {
    const { orgId, memberId } = await newOrg("Billing webhook");
    const acct = `acct_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const stageId = randomUUID();
    const { invoiceId, total } = await withTenant(orgId, async (tx) => {
      await setConnectAccount(tx, orgId, acct, true, true);
      await savePaymentSettings(tx, orgId, { bankAccountName: "Hale Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 14, remindersEnabled: true });
      const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com" });
      const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen" });
      const q = (await getQuote(tx, orgId, quoteId))!;
      await saveQuote(tx, orgId, {
        quoteId,
        baseVersion: 0,
        ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Skim") }],
        paymentPlan: [{ id: stageId, label: "Full amount", amountKind: "balance", dueKind: "on_acceptance" }],
      });
      await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
      await decide(tx, orgId, clientId, q.quote.number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: null });
      const inv = await createInvoice(tx, orgId, { quoteId, stageId, memberId });
      const [t] = await tx.execute<{ total_pence: number }>(sql`select total_pence from invoices where id = ${inv.id}`);
      return { invoiceId: inv.id, total: t.total_pence };
    });
    const session = (over: Record<string, unknown> = {}) =>
      ({ id: "cs_test_1", mode: "payment", payment_status: "paid", payment_intent: "pi_hook", amount_total: total, metadata: { orgId, invoiceId }, customer_details: { name: "Sarah Hale" }, ...over }) as never;
    expect(await invoicePaid("acct_somebodyelse", session())).toBe("wrong account");
    expect(await invoicePaid(acct, session({ payment_status: "unpaid" }))).toBe("not paid yet");
    expect(await invoicePaid(acct, session({ amount_total: total - 1 }))).toBe("wrong amount");
    expect(await invoicePaid(acct, session())).toBe("invoice paid");
    expect(await invoicePaid(acct, session())).toBe("already paid");
    const told = await withTenant(orgId, (tx) => listNotifications(tx, orgId, memberId));
    expect(told.items.filter((n) => n.kind === "invoice_paid")).toHaveLength(1);
  });

  it("gives Free one login: the first Admin; trials and paid plans have no limit", async () => {
    const { orgId, memberId: jo } = await newOrg("Billing seats");
    const add = async (role: string) =>
      (await withTenant(orgId, (tx) => tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + randomUUID().slice(0, 8)}, ${role}, 'Someone') returning id`)))[0].id;
    const office = await add("office");
    // In the trial: everyone.
    expect(await withTenant(orgId, (tx) => hasSeat(tx, orgId, office))).toBe(true);
    // Trial over, nothing paid: only the first Admin.
    const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
    try {
      await admin`update organizations set trial_ends_at = now() - interval '1 day' where id = ${orgId}`;
    } finally {
      await admin.end();
    }
    expect(await withTenant(orgId, (tx) => hasSeat(tx, orgId, jo))).toBe(true);
    expect(await withTenant(orgId, (tx) => hasSeat(tx, orgId, office))).toBe(false);
    expect(await withTenant(orgId, (tx) => seatHolderName(tx, orgId))).toBe("Jo");
    // Complimentary (or paying): back in.
    await withTenant(orgId, (tx) => setComped(tx, orgId, true));
    expect(await withTenant(orgId, (tx) => hasSeat(tx, orgId, office))).toBe(true);
  });
});
