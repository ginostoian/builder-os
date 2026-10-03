import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { PaymentSettingsForm } from "@/components/app/settings/payment-settings-form";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { can } from "@/core/roles";
import { paymentSettings } from "@/db/invoices";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "Payment settings" };

export default async function PaymentSettingsPage() {
  const session = await requirePermission("settings.view");
  const settings = await withSession(session, (tx) => paymentSettings(tx, session.orgId));
  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Payments"]}>
      <SettingsFrame active="payments" title="Payments" subtitle="Bank transfer details for invoices, payment terms and reminders.">
        <PaymentSettingsForm initial={settings} canEdit={can(session.role, "settings.manage")} emailEnabled={emailConfigured()} />
      </SettingsFrame>
    </LiveAppShell>
  );
}
