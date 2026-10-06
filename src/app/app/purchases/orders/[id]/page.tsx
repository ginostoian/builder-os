import type { Metadata } from "next";
import { cisOptions } from "@/db/cis";
import { CisProvider } from "@/components/app/costs/cis-context";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { PoEditor } from "@/components/app/costs/po-editor";
import { poRef } from "@/core/costs";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { costProjects, getPurchaseOrder } from "@/db/costs";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { storageConfigured } from "@/server/storage";

export const metadata: Metadata = { title: "Purchase order" };

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("costs.view");
  const poId = (await params).id;
  if (!uuid.safeParse(poId).success) notFound();
  const data = await withSession(session, async (tx) => ({ found: await getPurchaseOrder(tx, session.orgId, poId), projects: await costProjects(tx, session.orgId), cis: await cisOptions(tx, session.orgId) }));
  if (!data.found) notFound();
  const { po, projectName } = data.found;
  return (
    <LiveAppShell active="purchases" crumbs={["Purchases", poRef(po.number)]}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <Link href={`/app/projects/${po.projectId}?view=costs`} className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" />
          {projectName}
        </Link>
        <CisProvider subcontractors={data.cis}>
        <PoEditor
          key={po.updatedAt.toISOString()}
          initial={{ id: po.id, number: po.number, status: po.status, projectId: po.projectId, supplierName: po.supplierName, supplierEmail: po.supplierEmail, neededBy: po.neededBy, deliveryNotes: po.deliveryNotes, vatRateBps: po.vatRateBps, lines: po.lines, orderedOn: po.orderedOn }}
          projects={data.projects.map((p) => ({ id: p.id, name: p.name }))}
          canEdit={can(session.role, "costs.edit")}
          emailEnabled={emailConfigured()}
          storageEnabled={storageConfigured()}
          bills={data.found.bills.map((b) => ({ id: b.id, description: b.description, spentOn: b.spentOn, totalPence: b.totalPence }))}
        />
        </CisProvider>
      </div>
    </LiveAppShell>
  );
}
