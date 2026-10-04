import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { WorkerForm } from "@/components/app/team/worker-form";
import { can } from "@/core/roles";
import { requirePermission } from "@/auth/session";

export const metadata: Metadata = { title: "Add person" };

export default async function NewWorkerPage() {
  const session = await requirePermission("team.edit");
  return (
    <LiveAppShell active="people" crumbs={["Team", "Add person"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="Add person" subtitle="Anyone who works for you, with or without a login. Only the name is needed; fill in the rest when you have it." />
        <Panel className="max-w-[720px] p-5">
          <WorkerForm canSeeCosts={can(session.role, "costs.view")} />
        </Panel>
      </div>
    </LiveAppShell>
  );
}
