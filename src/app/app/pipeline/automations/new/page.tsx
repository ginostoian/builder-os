import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { AutomationEditor } from "@/components/app/pipeline/automation-editor";
import { enquiryAlertContext } from "@/db/pipeline";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "New automation" };

export default async function NewAutomationPage() {
  const session = await requirePermission("automations.manage");
  const company = await withSession(session, async (tx) => (await enquiryAlertContext(tx, session.orgId)).company);
  return (
    <LiveAppShell active="pipeline" crumbs={["Automations", "New automation"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-surface-2 px-6 pt-[18px]">
        <Link href="/app/pipeline/automations" className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" />
          Automations
        </Link>
        <div className="mx-auto w-full max-w-[820px]">
          <AutomationEditor automation={null} company={company} emailEnabled={emailConfigured()} />
        </div>
      </div>
    </LiveAppShell>
  );
}
