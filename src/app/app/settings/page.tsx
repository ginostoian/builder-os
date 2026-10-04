import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { CompanySettingsForm } from "@/components/app/settings/company-settings-form";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { can } from "@/core/roles";
import { organizations } from "@/db/schema";
import { requirePermission, withSession } from "@/auth/session";
import { storageConfigured } from "@/server/storage";
import { PortalSecuritySetting } from "@/components/app/settings/portal-security";
import { emailConfigured } from "@/server/email";
import { appOrigin } from "@/server/origin";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const session = await requirePermission("settings.view");
  const [org] = await withSession(session, (tx) =>
    tx
      .select({
        name: organizations.name,
        tradingName: organizations.tradingName,
        vatNumber: organizations.vatNumber,
        logoUrl: organizations.logoUrl,
        brandColour: organizations.brandColour,
        defaultMarkupBps: organizations.defaultMarkupBps,
        defaultVatRateBps: organizations.defaultVatRateBps,
        quoteTerms: organizations.quoteTerms,
        portalSignIn: organizations.portalSignIn,
      })
      .from(organizations)
      .where(eq(organizations.id, session.orgId)),
  );

  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Company"]}>
      <SettingsFrame active="company" title="Company" subtitle="How your company appears on quotes, invoices and the client portal.">
        <CompanySettingsForm initial={org} canEdit={can(session.role, "settings.manage")} storageEnabled={storageConfigured()} />
        <div className="mt-4">
          <PortalSecuritySetting on={org.portalSignIn} canEdit={can(session.role, "settings.manage")} emailEnabled={emailConfigured()} portalHome={`${(await appOrigin()).replace(/^https?:\/\//, "")}/portal`} />
        </div>
      </SettingsFrame>
    </LiveAppShell>
  );
}
