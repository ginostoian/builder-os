/**
 * What we do with Stripe events (the webhook verifies them first). Everything is fetched or checked again,
 * never trusted from the event body alone:
 *
 * - Subscriptions: re-fetched from Stripe, then applied (only for the company's own customer).
 * - Connected accounts: re-fetched, then their status saved (only for the company that owns them).
 * - Invoice payments (on a company's own account): marked paid only if the account the payment happened on
 *   is that company's, the session is paid, and the amount and invoice match.
 * - Refunds of those payments: the charge is re-fetched from the company's account; a full refund opens
 *   the invoice again, a part refund leaves it paid. Either way, Admins and the office are told.
 */
import "server-only";
import type Stripe from "stripe";
import { ukToday } from "@/core/payment-plan";
import { formatGBP } from "@/core/money";
import { invoiceRef } from "@/core/payment-plan";
import { withTenant } from "@/db";
import { billingFacts, markPaidOnline, refundOnline } from "@/db/billing";
import { membersWithRoles, notify } from "@/db/notifications";
import { orgIdFrom, stripe, syncConnectAccount, syncSubscription } from "./stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleStripeEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return (await syncSubscription(event.data.object.id)) ? "subscription synced" : "subscription ignored";
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const cs = event.data.object;
      if (cs.mode === "subscription" && typeof cs.subscription === "string") return (await syncSubscription(cs.subscription)) ? "subscription synced" : "subscription ignored";
      if (cs.mode === "payment" && event.account) return invoicePaid(event.account, cs);
      return "ignored";
    }
    case "charge.refunded":
      return event.account ? chargeRefunded(event.account, event.data.object.id) : "ignored";
    case "account.updated":
      return (await syncConnectAccount(event.data.object.id)) ? "account synced" : "account ignored";
    default:
      return "ignored";
  }
}

/** A homeowner paid an invoice on the company's own Stripe account. */
export async function invoicePaid(accountId: string, cs: Stripe.Checkout.Session): Promise<string> {
  if (cs.payment_status !== "paid") return "not paid yet";
  const orgId = orgIdFrom(cs.metadata);
  const invoiceId = cs.metadata?.invoiceId;
  if (!orgId || typeof invoiceId !== "string" || !UUID.test(invoiceId)) return "ignored";
  const paymentId = typeof cs.payment_intent === "string" ? cs.payment_intent : (cs.payment_intent?.id ?? cs.id);
  return withTenant(orgId, async (tx) => {
    // The payment must have happened on this company's own account, for this invoice's amount.
    const facts = await billingFacts(tx, orgId);
    if (facts.connectAccountId !== accountId) return "wrong account";
    const result = await markPaidOnline(tx, orgId, invoiceId, paymentId, ukToday(), cs.amount_total ?? -1);
    if (!result.marked) return result.reason;
    await notify(tx, orgId, await membersWithRoles(tx, orgId, ["admin", "office"]), {
      kind: "invoice_paid",
      title: `${invoiceRef(result.number!)} paid online: ${formatGBP(result.totalPence!)}`,
      body: cs.customer_details?.name ? `By ${cs.customer_details.name}` : null,
      href: `/app/invoices/${invoiceId}`,
    });
    return "invoice paid";
  });
}

/** A payment on a company's own account was refunded (from their Stripe dashboard). */
export async function chargeRefunded(accountId: string, chargeId: string): Promise<string> {
  const charge = await stripe().charges.retrieve(chargeId, { expand: ["payment_intent"] }, { stripeAccount: accountId });
  const pi = typeof charge.payment_intent === "object" ? charge.payment_intent : null;
  if (!pi) return "ignored";
  const orgId = orgIdFrom(pi.metadata);
  const invoiceId = pi.metadata?.invoiceId;
  if (!orgId || typeof invoiceId !== "string" || !UUID.test(invoiceId)) return "ignored";
  return withTenant(orgId, async (tx) => {
    const facts = await billingFacts(tx, orgId);
    if (facts.connectAccountId !== accountId) return "wrong account";
    const full = charge.refunded === true || charge.amount_refunded >= charge.amount;
    const result = await refundOnline(tx, orgId, invoiceId, pi.id, full);
    if (!result.changed) return "not this payment";
    const ref = invoiceRef(result.number);
    await notify(tx, orgId, await membersWithRoles(tx, orgId, ["admin", "office"]), {
      kind: "invoice_refunded",
      title: result.reopened ? `${ref} refunded: ${formatGBP(charge.amount_refunded)}` : `${ref} part refunded: ${formatGBP(charge.amount_refunded)} of ${formatGBP(result.totalPence)}`,
      body: result.reopened ? "It's marked unpaid again, so reminders and Pay now are back on." : "It's still marked paid. Raise a credit or adjust it if you need to.",
      href: `/app/invoices/${invoiceId}`,
    });
    return result.reopened ? "invoice reopened" : "part refund noted";
  });
}
