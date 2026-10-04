/** Whether a company can take card and bank payments on its invoices right now. */
import "server-only";
import { planHas } from "@/core/plans";
import type { Tx } from "@/db";
import { billingFacts } from "@/db/billing";
import { entitlementFor } from "./plan";
import { stripeConfigured } from "./stripe";

/** The company's Stripe account id if online payments are on (plan, setup finished, Stripe set up), else null. */
export async function onlinePaymentsReady(tx: Tx, orgId: string): Promise<string | null> {
  if (!stripeConfigured()) return null;
  const facts = await billingFacts(tx, orgId);
  if (!facts.connectAccountId || !facts.connectChargesEnabled) return null;
  return planHas((await entitlementFor(tx, orgId)).plan, "invoicing") ? facts.connectAccountId : null;
}
