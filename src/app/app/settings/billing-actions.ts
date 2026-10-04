"use server";

import { and, eq } from "drizzle-orm";
import { can } from "@/core/roles";
import { PLAN_LABEL, type Plan } from "@/core/plans";
import { getSession, withSession } from "@/auth/session";
import { billingFacts, setConnectAccount, setStripeCustomer } from "@/db/billing";
import { members, organizations } from "@/db/schema";
import { appOrigin } from "@/server/origin";
import { hasFeature, upgradeMessage } from "@/server/plan";
import { connectDashboardLink, connectOnboardingLink, planPrices, stripe, stripeConfigured } from "@/server/stripe";

export type BillingRedirect = { ok: true; url: string } | { ok: false; message: string };

const NOT_ADMIN = "Only Admins can change the plan.";
const NOT_SET_UP = "Billing isn't set up yet (Stripe keys are missing). Contact Builder OS support.";

/** Our Stripe customer for this company, made on first use. */
async function customerFor(orgId: string, memberId: string): Promise<string> {
  const s = await getSession();
  const { facts, org, email } = await withSession(s, async (tx) => ({
    facts: await billingFacts(tx, orgId),
    org: (await tx.select({ name: organizations.name, tradingName: organizations.tradingName, vat: organizations.vatNumber }).from(organizations).where(eq(organizations.id, orgId)))[0],
    email: (await tx.select({ email: members.email }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, memberId))))[0]?.email ?? null,
  }));
  if (facts.stripeCustomerId) return facts.stripeCustomerId;
  const customer = await stripe().customers.create(
    { name: org?.tradingName ?? org?.name, email: email ?? undefined, metadata: { orgId }, preferred_locales: ["en-GB"] },
    { idempotencyKey: `customer-${orgId}` },
  );
  const saved = await withSession(s, (tx) => setStripeCustomer(tx, orgId, customer.id));
  if (!saved) throw new Error("This company already has a different Stripe customer.");
  return customer.id;
}

/** Start paying for a plan: Stripe Checkout, then back to Settings → Billing. Changing plan goes through the portal. */
export async function startCheckoutAction(plan: Plan): Promise<BillingRedirect> {
  const s = await getSession();
  if (!can(s.role, "settings.manage")) return { ok: false, message: NOT_ADMIN };
  if (!stripeConfigured()) return { ok: false, message: NOT_SET_UP };
  if (plan !== "essentials" && plan !== "pro") return { ok: false, message: "Choose Essentials or Pro." };
  const facts = await withSession(s, (tx) => billingFacts(tx, s.orgId));
  if (facts.subscriptionStatus && ["active", "trialing", "past_due"].includes(facts.subscriptionStatus)) return openBillingPortalAction();
  const price = (await planPrices())[plan];
  if (!price) return { ok: false, message: NOT_SET_UP };
  const origin = await appOrigin();
  const customer = await customerFor(s.orgId, s.memberId);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { orgId: s.orgId }, description: `Builder OS ${PLAN_LABEL[plan]}` },
    metadata: { orgId: s.orgId },
    client_reference_id: s.orgId,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    ...(process.env.STRIPE_AUTOMATIC_TAX === "1" ? { automatic_tax: { enabled: true } } : {}),
    success_url: `${origin}/app/settings/billing?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/settings/billing`,
  });
  return session.url ? { ok: true, url: session.url } : { ok: false, message: "Stripe didn't start the checkout. Try again." };
}

/** Stripe's billing portal: change plan, card, invoices, cancel. */
export async function openBillingPortalAction(): Promise<BillingRedirect> {
  const s = await getSession();
  if (!can(s.role, "settings.manage")) return { ok: false, message: NOT_ADMIN };
  if (!stripeConfigured()) return { ok: false, message: NOT_SET_UP };
  const facts = await withSession(s, (tx) => billingFacts(tx, s.orgId));
  if (!facts.stripeCustomerId) return { ok: false, message: "There's no billing account yet. Choose a plan first." };
  const portal = await stripe().billingPortal.sessions.create({
    customer: facts.stripeCustomerId,
    return_url: `${await appOrigin()}/app/settings/billing`,
    ...(process.env.STRIPE_PORTAL_CONFIGURATION ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION } : {}),
  });
  return { ok: true, url: portal.url };
}

// ── Client payments (the company's own Stripe account) ───────────────────────

/** Set up (or finish setting up) card and bank payments on invoices. */
export async function connectOnboardingAction(): Promise<BillingRedirect> {
  const s = await getSession();
  if (!can(s.role, "settings.manage")) return { ok: false, message: "Only Admins can set up online payments." };
  if (!stripeConfigured()) return { ok: false, message: NOT_SET_UP };
  if (!(await hasFeature("invoicing"))) return { ok: false, message: upgradeMessage("invoicing") };
  const { facts, org, email } = await withSession(s, async (tx) => ({
    facts: await billingFacts(tx, s.orgId),
    org: (await tx.select({ name: organizations.name, tradingName: organizations.tradingName }).from(organizations).where(eq(organizations.id, s.orgId)))[0],
    email: (await tx.select({ email: members.email }).from(members).where(and(eq(members.orgId, s.orgId), eq(members.id, s.memberId))))[0]?.email ?? null,
  }));
  const { accountId, url } = await connectOnboardingLink(s.orgId, facts.connectAccountId, { name: org?.tradingName ?? org?.name ?? "", email }, await appOrigin());
  if (!facts.connectAccountId) {
    const saved = await withSession(s, (tx) => setConnectAccount(tx, s.orgId, accountId, false, false));
    if (!saved) return { ok: false, message: "This company already has a different Stripe account." };
  }
  return { ok: true, url };
}

/** The company's Stripe dashboard: payouts, payments, refunds. */
export async function connectDashboardAction(): Promise<BillingRedirect> {
  const s = await getSession();
  if (!can(s.role, "settings.manage")) return { ok: false, message: "Only Admins can open the Stripe dashboard." };
  if (!stripeConfigured()) return { ok: false, message: NOT_SET_UP };
  const facts = await withSession(s, (tx) => billingFacts(tx, s.orgId));
  if (!facts.connectAccountId || !facts.connectDetailsSubmitted) return { ok: false, message: "Finish setting up online payments first." };
  return { ok: true, url: await connectDashboardLink(facts.connectAccountId) };
}
