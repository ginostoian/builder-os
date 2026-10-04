import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { NewProject } from "@/components/app/projects/new-project";
import { id as uuid } from "@/core/schemas";
import { clientOptions } from "@/db/clients";
import { assignableMembers } from "@/db/projects";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "New project" };

/** A project without a quote (repairs, day-rate work, a job priced elsewhere). Quote-based ones start from the quote. */
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const session = await requirePermission("projects.edit");
  const clientParam = (await searchParams).client;
  const { clients, members } = await withSession(session, async (tx) => ({ clients: await clientOptions(tx, session.orgId), members: await assignableMembers(tx, session.orgId) }));
  const clientId = clientParam && uuid.safeParse(clientParam).success && clients.some((c) => c.id === clientParam) ? clientParam : "";
  return (
    <LiveAppShell active="board" crumbs={["Projects", "New project"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="New project" subtitle="For a job without a quote in Builder OS. Won a quote? Open it and click Start project instead: its stages and tasks come with it." />
        <Panel className="max-w-[720px] p-5">
          <NewProject clients={clients} members={members} clientId={clientId} />
        </Panel>
      </div>
    </LiveAppShell>
  );
}
