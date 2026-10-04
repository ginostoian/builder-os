import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { AutomationEditor } from "@/components/app/pipeline/automation-editor";
import { id as uuid } from "@/core/schemas";
import { enquiryAlertContext, getAutomation } from "@/db/pipeline";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "Automation" };

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("automations.manage");
  const id = (await params).id;
  if (!uuid.safeParse(id).success) notFound();
  const data = await withSession(session, async (tx) => ({ a: await getAutomation(tx, session.orgId, id), company: (await enquiryAlertContext(tx, session.orgId)).company }));
  if (!data.a) notFound();
  return (
    <LiveAppShell active="pipeline" crumbs={["Automations", data.a.name]}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-surface-2 px-6 pt-[18px]">
        <Link href="/app/pipeline/automations" className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" />
          Automations
        </Link>
        <div className="mx-auto w-full max-w-[820px]">
          <AutomationEditor key={data.a.updatedAt.toISOString()} automation={{ id: data.a.id, name: data.a.name, enabled: data.a.enabled, trigger: data.a.trigger, stage: data.a.stage, steps: data.a.steps }} company={data.company} emailEnabled={emailConfigured()} />
        </div>
      </div>
    </LiveAppShell>
  );
}
