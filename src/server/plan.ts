/**
 * What the signed-in company's plan lets it do, worked out once per request. Pages show an upgrade screen
 * for features the plan doesn't have; actions refuse them with `planBlock`. Cron jobs and public pages
 * use `entitlementFor` inside the company's tenant.
 */
import "server-only";
import { cache } from "react";
import { FEATURE_LABEL, PLAN_LABEL, entitlement, planFor, planHas, type Entitlement, type Feature } from "@/core/plans";
import type { Tx } from "@/db";
import { billingFacts } from "@/db/billing";
import { getSession, withSession } from "@/auth/session";

export const getEntitlement = cache(async (): Promise<Entitlement> => {
  const session = await getSession();
  const facts = await withSession(session, (tx) => billingFacts(tx, session.orgId));
  return entitlement(facts, new Date());
});

export async function hasFeature(feature: Feature): Promise<boolean> {
  return planHas((await getEntitlement()).plan, feature);
}

/** The company's entitlement inside a tenant transaction (cron jobs, public pages). */
export async function entitlementFor(tx: Tx, orgId: string): Promise<Entitlement> {
  return entitlement(await billingFacts(tx, orgId), new Date());
}

export const upgradeMessage = (feature: Feature) => `${FEATURE_LABEL[feature]} ${feature === "unlimited_quotes" ? "need" : "needs"} the ${PLAN_LABEL[planFor(feature)]} plan. Upgrade in Settings → Billing.`;

/** For actions: a refusal message if the plan doesn't have the feature, else null. */
export async function planBlock(feature: Feature): Promise<string | null> {
  return (await hasFeature(feature)) ? null : upgradeMessage(feature);
}
