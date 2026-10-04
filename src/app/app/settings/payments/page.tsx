import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { PaymentSettingsForm } from "@/components/app/settings/payment-settings-form";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { can } from "@/core/roles";
import { paymentSettings } from "@/db/invoices";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { OnlinePayments } from "@/components/app/settings/online-payments";
import { billingFacts } from "@/db/billing";
import { hasFeature } from "@/server/plan";
import { stripeConfigured, syncConnectAccount } from "@/server/stripe";

export const metadata: Metadata = { title: "Payment settings" };

export default async function PaymentSettingsPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const session = await requirePermission("settings.view");
  const settings = await withSession(session, (tx) => paymentSettings(tx, session.orgId));
  let facts = await withSession(session, (tx) => billingFacts(tx, session.orgId));
  // Back from Stripe's onboarding: check the account now rather than waiting for the webhook.
  if ((await searchParams).connect === "done" && facts.connectAccountId && stripeConfigured()) {
    await syncConnectAccount(facts.connectAccountId).catch(() => false);
    facts = await withSession(session, (tx) => billingFacts(tx, session.orgId));
  }
  const online = !facts.connectAccountId ? "none" : facts.connectChargesEnabled ? "on" : facts.connectDetailsSubmitted ? "pending" : "started";
  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Payments"]}>
      <SettingsFrame active="payments" title="Payments" subtitle="Bank transfer details for invoices, payment terms and reminders.">
        <PaymentSettingsForm initial={settings} canEdit={can(session.role, "settings.manage")} emailEnabled={emailConfigured()} />
        <div className="mt-4">
          <OnlinePayments state={online} canEdit={can(session.role, "settings.manage")} planOk={await hasFeature("invoicing")} stripeReady={stripeConfigured()} />
        </div>
      </SettingsFrame>
    </LiveAppShell>
  );
}
