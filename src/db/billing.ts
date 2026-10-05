/**
 * Billing: a company's plan state (read in its tenant), and the narrow writes that change it. The app role
 * can't update plan, Stripe ids, trial or complimentary flag itself; it calls SECURITY DEFINER functions
 * owned by `builderos_billing` (migration 0018), which only accept consistent changes (e.g. a subscription
 * for the company's own Stripe customer).
 */
import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { FREE_USERS, entitlement, planHas, type BillingFacts, type Feature, type Plan } from "@/core/plans";
import type { Tx } from "./index";
import { invoices, members, organizations, quoteVersions, services } from "./schema";

export async function billingFacts(tx: Tx, orgId: string): Promise<BillingFacts & { stripeCustomerId: string | null; connectAccountId: string | null; connectChargesEnabled: boolean; connectDetailsSubmitted: boolean }> {
  const [o] = await tx
    .select({
      plan: organizations.plan,
      comped: organizations.comped,
      trialEndsAt: organizations.trialEndsAt,
      subscriptionStatus: organizations.subscriptionStatus,
      currentPeriodEnd: organizations.currentPeriodEnd,
      cancelAtPeriodEnd: organizations.cancelAtPeriodEnd,
      stripeCustomerId: organizations.stripeCustomerId,
      connectAccountId: organizations.connectAccountId,
      connectChargesEnabled: organizations.connectChargesEnabled,
      connectDetailsSubmitted: organizations.connectDetailsSubmitted,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  if (!o) throw new Error("Company not found");
  return o;
}

/** Whether the company's plan has a feature right now (for cron jobs and public pages, inside its tenant). */
export async function planAllows(tx: Tx, orgId: string, feature: Feature): Promise<boolean> {
  return planHas(entitlement(await billingFacts(tx, orgId), new Date()).plan, feature);
}

const ok = (rows: { ok: boolean }[]) => rows[0]?.ok === true;

/** Record our Stripe customer for the company. False if it already has a different one. */
export async function setStripeCustomer(tx: Tx, orgId: string, customerId: string): Promise<boolean> {
  return ok(await tx.execute<{ ok: boolean }>(sql`select app_billing_set_customer(${orgId}::uuid, ${customerId}) as ok`));
}

/**
 * A subscription's state as just fetched from Stripe. False if it isn't for this company's customer.
 * `monthlyPence` is what it pays us a month before VAT; the database counts it as MRR only while the
 * subscription is active or past due, and records each change for the platform dashboard.
 */
export async function applySubscription(
  tx: Tx,
  orgId: string,
  s: { customerId: string; subscriptionId: string; plan: Exclude<Plan, "free">; status: string; periodEnd: Date | null; cancelAtPeriodEnd: boolean; monthlyPence: number },
): Promise<boolean> {
  return ok(
    await tx.execute<{ ok: boolean }>(
      sql`select app_billing_apply_subscription(${orgId}::uuid, ${s.customerId}, ${s.subscriptionId}, ${s.plan}::plan, ${s.status}, ${s.periodEnd?.toISOString() ?? null}::timestamptz, ${s.cancelAtPeriodEnd}, ${Math.max(0, Math.round(s.monthlyPence))}::int) as ok`,
    ),
  );
}

/** The company's own Stripe account for client payments, and whether it can take them yet. */
export async function setConnectAccount(tx: Tx, orgId: string, accountId: string, chargesEnabled: boolean, detailsSubmitted: boolean): Promise<boolean> {
  return ok(await tx.execute<{ ok: boolean }>(sql`select app_billing_set_connect(${orgId}::uuid, ${accountId}, ${chargesEnabled}, ${detailsSubmitted}) as ok`));
}

/** Complimentary Pro (platform team only). */
export async function setComped(tx: Tx, orgId: string, comped: boolean): Promise<boolean> {
  return ok(await tx.execute<{ ok: boolean }>(sql`select app_billing_set_comped(${orgId}::uuid, ${comped}) as ok`));
}

export type PlatformCompany = { id: string; name: string; createdAt: Date; plan: Plan; comped: boolean; trialEndsAt: Date | null; subscriptionStatus: string | null; deletedAt: Date | null };

/** Every company's billing state, for the platform team's admin page. */
export async function platformCompanies(tx: Tx): Promise<PlatformCompany[]> {
  const rows = await tx.execute<{ id: string; name: string; created_at: string; plan: Plan; comped: boolean; trial_ends_at: string | null; subscription_status: string | null; deleted_at: string | null }>(
    sql`select id, name, created_at, plan, comped, trial_ends_at, subscription_status, deleted_at from app_platform_companies()`,
  );
  const date = (v: string | null) => (v ? new Date(v) : null);
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: new Date(r.created_at), plan: r.plan, comped: r.comped, trialEndsAt: date(r.trial_ends_at), subscriptionStatus: r.subscription_status, deletedAt: date(r.deleted_at) }));
}

// ── Free plan allowances ─────────────────────────────────────────────────────

/** Quotes sent for the first time since `since` (Free allows 3 a calendar month; resending doesn't count). */
export async function firstSendsSince(tx: Tx, orgId: string, since: Date): Promise<number> {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(quoteVersions)
    .where(and(eq(quoteVersions.orgId, orgId), eq(quoteVersions.versionNo, 1), gte(quoteVersions.sentAt, since)));
  return n;
}

/** Whether sending this quote would be its first send (no version sent yet). */
export async function isFirstSend(tx: Tx, orgId: string, quoteId: string): Promise<boolean> {
  const [{ n }] = await tx.select({ n: count() }).from(quoteVersions).where(and(eq(quoteVersions.orgId, orgId), eq(quoteVersions.quoteId, quoteId)));
  return n === 0;
}

export async function activeServiceCount(tx: Tx, orgId: string): Promise<number> {
  const [{ n }] = await tx.select({ n: count() }).from(services).where(and(eq(services.orgId, orgId), sql`${services.archivedAt} is null`));
  return n;
}

// ── Invoices paid online ─────────────────────────────────────────────────────

/**
 * Mark an invoice paid by a Stripe payment on the company's own account. Idempotent: the same payment
 * twice changes nothing. Returns whether this call marked it paid (so alerts go once).
 */
export async function markPaidOnline(
  tx: Tx,
  orgId: string,
  invoiceId: string,
  paymentId: string,
  paidOn: string,
  amountPence: number,
): Promise<{ marked: true; number: number; totalPence: number } | { marked: false; reason: "already paid" | "not found" | "wrong amount" | "not open" }> {
  const [inv] = await tx.select({ status: invoices.status, totalPence: invoices.totalPence, paymentId: invoices.stripePaymentId }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
  if (!inv) return { marked: false, reason: "not found" };
  if (inv.paymentId === paymentId || inv.status === "paid") return { marked: false, reason: "already paid" };
  if (inv.totalPence !== amountPence) return { marked: false, reason: "wrong amount" };
  const rows = await tx
    .update(invoices)
    .set({ status: "paid", paidOn, paidReference: "Paid online (card or bank)", stripePaymentId: paymentId })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.status, "issued")))
    .returning({ number: invoices.number, totalPence: invoices.totalPence });
  return rows[0] ? { marked: true, ...rows[0] } : { marked: false, reason: "not open" };
}

/**
 * A refund of an online payment. Fully refunded: the invoice is open again (unpaid), so reminders and
 * "Pay now" come back. Part refunded: it stays paid, and the team is told. Only for the payment that
 * paid it, so a repeated event (or an old payment) changes nothing.
 */
export async function refundOnline(
  tx: Tx,
  orgId: string,
  invoiceId: string,
  paymentId: string,
  full: boolean,
): Promise<{ changed: true; reopened: boolean; number: number; totalPence: number } | { changed: false }> {
  const [inv] = await tx
    .select({ status: invoices.status, paymentId: invoices.stripePaymentId, number: invoices.number, totalPence: invoices.totalPence })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
  if (!inv || inv.paymentId !== paymentId || inv.status !== "paid") return { changed: false };
  if (!full) return { changed: true, reopened: false, number: inv.number, totalPence: inv.totalPence };
  const rows = await tx
    .update(invoices)
    .set({ status: "issued", paidOn: null, paidReference: null, stripePaymentId: null })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.stripePaymentId, paymentId)))
    .returning({ id: invoices.id });
  return rows.length ? { changed: true, reopened: true, number: inv.number, totalPence: inv.totalPence } : { changed: false };
}

// ── Logins ───────────────────────────────────────────────────────────────────

/**
 * Whether this member can use Builder OS on the company's plan. Free has one login: the first active
 * Admin, or the earliest active member if there's no Admin. Paid plans, trials and complimentary
 * companies have no limit.
 */
export async function hasSeat(tx: Tx, orgId: string, memberId: string, now = new Date()): Promise<boolean> {
  if (entitlement(await billingFacts(tx, orgId), now).plan !== "free") return true;
  const holders = await tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true)))
    .orderBy(sql`(${members.role} = 'admin') desc`, members.createdAt, members.id)
    .limit(FREE_USERS);
  return holders.some((h) => h.id === memberId);
}

/** The person holding the Free plan's login, to name on the "ask them to upgrade" page. */
export async function seatHolderName(tx: Tx, orgId: string): Promise<string | null> {
  const [h] = await tx
    .select({ name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true)))
    .orderBy(sql`(${members.role} = 'admin') desc`, members.createdAt, members.id)
    .limit(1);
  return h?.name ?? null;
}
