/**
 * Stripe, for two separate things:
 *
 * 1. **Our subscriptions** (Stripe Billing): companies pay us for Essentials or Pro. Prices are found by
 *    lookup key (`pnpm stripe:setup` creates them). Subscription state reaches the database only through
 *    `applySubscription`, from a subscription fetched fresh from Stripe (never trusted from a webhook body).
 * 2. **Client payments** (Stripe Connect, Express accounts): homeowners pay a company's invoice by card or
 *    bank. The money goes straight to the company's own Stripe account; we take no fee and never hold it.
 *
 * Optional: without STRIPE_SECRET_KEY, billing screens explain how to set it up and nothing is charged.
 */
import "server-only";
import Stripe from "stripe";
import { PLAN_LOOKUP_KEY, planForLookupKey, type Plan } from "@/core/plans";
import { withTenant } from "@/db";
import { applySubscription, setConnectAccount } from "@/db/billing";

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim());

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeConfigured()) throw new Error("Stripe isn't set up (STRIPE_SECRET_KEY).");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Builder OS" } });
  return client;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const orgIdFrom = (metadata: Stripe.Metadata | null | undefined) => {
  const id = metadata?.orgId;
  return typeof id === "string" && UUID.test(id) ? id : null;
};

// ── Plans ────────────────────────────────────────────────────────────────────

let priceCache: { at: number; prices: Partial<Record<Exclude<Plan, "free">, string>> } | null = null;

/** Our monthly prices, by plan. Cached for ten minutes. */
export async function planPrices(): Promise<Partial<Record<Exclude<Plan, "free">, string>>> {
  if (priceCache && Date.now() - priceCache.at < 600_000) return priceCache.prices;
  const list = await stripe().prices.list({ lookup_keys: Object.values(PLAN_LOOKUP_KEY), active: true, limit: 10 });
  const prices: Partial<Record<Exclude<Plan, "free">, string>> = {};
  for (const p of list.data) {
    const plan = planForLookupKey(p.lookup_key);
    if (plan && plan !== "free") prices[plan] = p.id;
  }
  priceCache = { at: Date.now(), prices };
  return prices;
}

/**
 * Put a subscription's current state into the company's record. Fetched fresh from Stripe, so events
 * arriving out of order can't leave a stale state behind. The company is the one named in its metadata;
 * the database refuses it if the customer isn't that company's.
 */
export async function syncSubscription(subscriptionId: string): Promise<boolean> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const orgId = orgIdFrom(sub.metadata);
  if (!orgId) return false;
  const item = sub.items.data[0];
  const plan = planForLookupKey(item?.price.lookup_key);
  if (!plan || plan === "free") return false;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  return withTenant(orgId, (tx) =>
    applySubscription(tx, orgId, {
      customerId,
      subscriptionId: sub.id,
      plan,
      status: sub.status,
      periodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      monthlyPence: monthlyPence(sub),
    }),
  );
}

/** What a subscription pays a month (pence, before tax): yearly prices count as a twelfth, discounts aren't taken off. */
export function monthlyPence(sub: Pick<Stripe.Subscription, "items">): number {
  const perMonth: Record<string, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };
  let total = 0;
  for (const item of sub.items.data) {
    const r = item.price.recurring;
    if (!r) continue;
    total += ((item.price.unit_amount ?? 0) * (item.quantity ?? 1) * (perMonth[r.interval] ?? 1)) / (r.interval_count || 1);
  }
  return Math.round(total);
}

// ── Client payments (Connect) ────────────────────────────────────────────────

/** Refresh what we know about a company's own Stripe account (can it take payments yet?). */
export async function syncConnectAccount(accountId: string): Promise<boolean> {
  const account = await stripe().accounts.retrieve(accountId);
  const orgId = orgIdFrom(account.metadata);
  if (!orgId) return false;
  return withTenant(orgId, (tx) => setConnectAccount(tx, orgId, account.id, account.charges_enabled === true, account.details_submitted === true));
}

/** Start (or carry on) setting up the company's own Stripe account; returns Stripe's onboarding page. */
export async function connectOnboardingLink(orgId: string, existing: string | null, profile: { name: string; email: string | null }, origin: string): Promise<{ accountId: string; url: string }> {
  const accountId =
    existing ??
    (
      await stripe().accounts.create(
        {
          type: "express",
          country: "GB",
          email: profile.email ?? undefined,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: { name: profile.name, mcc: "1520", product_description: "Building and renovation work" },
          metadata: { orgId },
        },
        { idempotencyKey: `connect-${orgId}` },
      )
    ).id;
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/app/settings/payments?connect=retry`,
    return_url: `${origin}/app/settings/payments?connect=done`,
  });
  return { accountId, url: link.url };
}

/** The company's Stripe Express dashboard (payouts, payments, refunds). */
export async function connectDashboardLink(accountId: string): Promise<string> {
  return (await stripe().accounts.createLoginLink(accountId)).url;
}

/**
 * A Stripe Checkout page for paying one invoice, on the company's own account (a direct charge: the money
 * is theirs, we take no fee). Card, Apple Pay/Google Pay and Pay by Bank, as enabled for connected accounts.
 */
export async function invoiceCheckout(i: { orgId: string; accountId: string; invoiceId: string; ref: string; company: string; totalPence: number; email: string | null; returnUrl: string }): Promise<string | null> {
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: i.totalPence, product_data: { name: `Invoice ${i.ref}`, description: i.company } } }],
      customer_email: i.email ?? undefined,
      metadata: { orgId: i.orgId, invoiceId: i.invoiceId },
      payment_intent_data: { description: `${i.company}: invoice ${i.ref}`, metadata: { orgId: i.orgId, invoiceId: i.invoiceId } },
      success_url: `${i.returnUrl}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: i.returnUrl,
    },
    { stripeAccount: i.accountId },
  );
  return session.url;
}
