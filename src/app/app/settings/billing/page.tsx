import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { BillingPlans } from "@/components/app/settings/billing-plans";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { entitlement } from "@/core/plans";
import { can } from "@/core/roles";
import { billingFacts } from "@/db/billing";
import { requirePermission, withSession } from "@/auth/session";
import { stripe, stripeConfigured, syncSubscription } from "@/server/stripe";

export const metadata: Metadata = { title: "Plan & billing" };

const longDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d);

/** The company's plan: what it has, what the others add, and paying (Stripe Checkout and billing portal). */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const session = await requirePermission("settings.view");
  const checkout = (await searchParams).checkout;
  // Back from Stripe Checkout: don't wait for the webhook to show the new plan.
  if (checkout && /^cs_[A-Za-z0-9_]+$/.test(checkout) && stripeConfigured()) {
    try {
      const cs = await stripe().checkout.sessions.retrieve(checkout);
      if (cs.metadata?.orgId === session.orgId && typeof cs.subscription === "string") await syncSubscription(cs.subscription);
    } catch (error) {
      console.error("Couldn't sync a checkout", error instanceof Error ? error.message : error);
    }
  }
  const facts = await withSession(session, (tx) => billingFacts(tx, session.orgId));
  const ent = entitlement(facts, new Date());
  const status =
    ent.why === "comped"
      ? "You're on complimentary Pro: everything, free. Thanks for helping us build Builder OS."
      : ent.why === "trial"
        ? `You're trying Pro free: ${ent.trialDaysLeft} day${ent.trialDaysLeft === 1 ? "" : "s"} left. Choose a plan to keep everything after that; otherwise you'll move to Free.`
        : ent.pastDue
          ? "Your last payment didn't go through. Update your card in Manage billing to keep your plan."
          : facts.cancelAtPeriodEnd && facts.currentPeriodEnd
            ? `Your plan ends on ${longDate(facts.currentPeriodEnd)}, then you'll move to Free. Changed your mind? Use Manage billing.`
            : ent.why === "subscription" && facts.currentPeriodEnd
              ? `Renews on ${longDate(facts.currentPeriodEnd)}.`
              : "You're on Free: 3 quotes a month. Upgrade to invoice, run jobs and grow.";

  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Plan & billing"]}>
      <SettingsFrame active="billing" title="Plan & billing" subtitle="One price for the whole company. Prices exclude VAT.">
        <BillingPlans
          current={ent.plan}
          why={ent.why}
          status={status}
          warn={ent.pastDue || (ent.why === "trial" && (ent.trialDaysLeft ?? 99) <= 3)}
          hasBillingAccount={Boolean(facts.stripeCustomerId)}
          paying={ent.why === "subscription"}
          canManage={can(session.role, "settings.manage")}
          stripeReady={stripeConfigured()}
        />
      </SettingsFrame>
    </LiveAppShell>
  );
}
