import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { CompanySettingsForm } from "@/components/app/settings/company-settings-form";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
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
        {can(session.role, "settings.manage") && (
          <Panel className="mt-4 flex max-w-[760px] flex-wrap items-center gap-4 p-5">
            <div className="min-w-[240px] flex-1">
              <h2 className="font-semibold">Your data</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-2">
                Download everything your company keeps in Builder OS: clients, quotes, invoices, jobs, team and more, as JSON and spreadsheet files. To answer one client&apos;s
                request for their data, use Export data on their page. See our <a href="/privacy" className="underline underline-offset-2">privacy policy</a>.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <a href="/app/settings/export" download>
                <Download />
                Export all data
              </a>
            </Button>
          </Panel>
        )}
      </SettingsFrame>
    </LiveAppShell>
  );
}
