import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { PoEditor } from "@/components/app/costs/po-editor";
import { id as uuid } from "@/core/schemas";
import { costProjects } from "@/db/costs";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { storageConfigured } from "@/server/storage";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const session = await requirePermission("costs.edit");
  const asked = (await searchParams).project;
  const projects = await withSession(session, (tx) => costProjects(tx, session.orgId));
  const projectId = asked && uuid.safeParse(asked).success && projects.some((p) => p.id === asked) ? asked : (projects[0]?.id ?? "");
  return (
    <LiveAppShell active="purchases" crumbs={["Purchases", "New purchase order"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        {projects.length === 0 ? (
          <Panel className="px-6 py-12 text-center text-subtle">Orders belong to a job. Start a project first.</Panel>
        ) : (
          <PoEditor
            initial={{ id: null, number: null, status: "draft", projectId, supplierName: "", supplierEmail: null, neededBy: null, deliveryNotes: null, vatRateBps: 2000, lines: [], orderedOn: null }}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            canEdit
            emailEnabled={emailConfigured()}
            storageEnabled={storageConfigured()}
            bills={[]}
          />
        )}
      </div>
    </LiveAppShell>
  );
}
