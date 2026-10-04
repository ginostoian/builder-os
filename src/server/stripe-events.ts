/**
 * What we do with Stripe events (the webhook verifies them first). Everything is fetched or checked again,
 * never trusted from the event body alone:
 *
 * - Subscriptions: re-fetched from Stripe, then applied (only for the company's own customer).
 * - Connected accounts: re-fetched, then their status saved (only for the company that owns them).
 * - Invoice payments (on a company's own account): marked paid only if the account the payment happened on
 *   is that company's, the session is paid, and the amount and invoice match.
 */
import "server-only";
import type Stripe from "stripe";
import { ukToday } from "@/core/payment-plan";
import { formatGBP } from "@/core/money";
import { invoiceRef } from "@/core/payment-plan";
import { withTenant } from "@/db";
import { billingFacts, markPaidOnline } from "@/db/billing";
import { membersWithRoles, notify } from "@/db/notifications";
import { orgIdFrom, syncConnectAccount, syncSubscription } from "./stripe";

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
