import type { Metadata } from "next";
import Link from "next/link";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { CisSettingsForm } from "@/components/app/settings/cis-settings-form";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { can } from "@/core/roles";
import { cisSettings } from "@/db/cis";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "CIS settings" };

/** The Construction Industry Scheme: optional, for companies that pay subcontractors. */
export default async function CisSettingsPage() {
  const session = await requirePermission("settings.view");
  const settings = await withSession(session, (tx) => cisSettings(tx, session.orgId));
  return (
    <LiveAppShell active="settings" crumbs={["Settings", "CIS"]}>
      <SettingsFrame active="cis" title="CIS" subtitle="The Construction Industry Scheme, if you pay subcontractors. Leave it off if you don't.">
        <CisSettingsForm initial={settings} canEdit={can(session.role, "settings.manage")} />
        {settings.enabled && (
          <p className="text-[12.5px] text-ink-2">
            Next: add each subcontractor&apos;s UTR and verified status on their page under{" "}
            <Link href="/app/team" className="underline underline-offset-2">
              Team
            </Link>
            , then record their invoices as Subcontractor expenses. The monthly figures are in{" "}
            <Link href="/app/reports/cis" className="underline underline-offset-2">
              Reports, CIS
            </Link>
            .
          </p>
        )}
      </SettingsFrame>
    </LiveAppShell>
  );
}
