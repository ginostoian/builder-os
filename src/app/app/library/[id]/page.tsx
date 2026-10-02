import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { ArchivePanel } from "@/components/app/archive-panel";
import { SectionHeading } from "@/components/app/form-fields";
import { BundleForm, ServiceForm } from "@/components/app/library/service-form";
import { Badge } from "@/components/ui/badge";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { bundleCandidates, deleteBlocker, getService, libraryCounts } from "@/db/services";
import { requirePermission, withSession } from "@/auth/session";
import { archiveService, removeService } from "../actions";
import { companyMarkup } from "../data";

export const metadata: Metadata = { title: "Service" };

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("library.view");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const data = await withSession(session, async (tx) => {
    const found = await getService(tx, session.orgId, id);
    if (!found) return undefined;
    const bundle = found.service.kind === "bundle";
    return {
      ...found,
      blocker: await deleteBlocker(tx, session.orgId, id),
      categories: (await libraryCounts(tx, session.orgId)).categories.map((c) => c.category),
      candidates: bundle ? await bundleCandidates(tx, session.orgId, found.items.map((i) => i.serviceId)) : [],
      markup: await companyMarkup(tx, session.orgId),
    };
  });
  if (!data) notFound();
  const { service, items, inBundles, blocker, categories, candidates, markup } = data;
  const canManage = can(session.role, "library.manage");
  const isBundle = service.kind === "bundle";
  const noun = isBundle ? "bundle" : "service";
  const common = { category: service.category, name: service.name, description: service.description, unit: service.unit, defaultMarkupBps: service.defaultMarkupBps };
  const archivedItems = items.filter((i) => i.archived);

  return (
    <LiveAppShell active="templates" crumbs={["Service library", service.name]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <div className="flex flex-col gap-2">
          <Link href={service.archivedAt ? "/app/library?view=archived" : "/app/library"} className="flex w-fit items-center gap-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Service library
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{service.name}</h1>
            <Badge tone="muted">{isBundle ? "Bundle" : "Service"}</Badge>
            {service.archivedAt && <Badge tone="grey">Archived</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,760px)_300px] items-start gap-4">
          {isBundle ? (
            <BundleForm bundleId={service.id} initial={{ ...common, items }} canEdit={canManage} categories={categories} candidates={candidates} companyMarkupBps={markup} />
          ) : (
            <ServiceForm serviceId={service.id} initial={{ ...common, ratePence: service.ratePence }} canEdit={canManage} categories={categories} companyMarkupBps={markup} />
          )}
          <div className="flex flex-col gap-4">
            <Panel className="flex flex-col gap-2 p-5">
              <SectionHeading title="Usage" />
              <p className="text-ink-2">
                {service.usageCount === 0 ? "Not on any quotes yet." : `Used in ${service.usageCount} ${service.usageCount === 1 ? "quote" : "quotes"}.`}
              </p>
              {inBundles.length > 0 && (
                <div className="text-ink-2">
                  Part of {inBundles.length === 1 ? "a bundle" : `${inBundles.length} bundles`}. Changing the rate reprices{" "}
                  {inBundles.map((b, i) => (
                    <span key={b.id}>
                      {i > 0 && ", "}
                      <Link href={`/app/library/${b.id}`} className="underline underline-offset-2 hover:text-ink">
                        {b.name}
                      </Link>
                    </span>
                  ))}
                  .
                </div>
              )}
              {archivedItems.length > 0 && (
                <p className="text-warning">
                  {archivedItems.map((i) => i.name).join(", ")} {archivedItems.length === 1 ? "is" : "are"} archived but still in this bundle.
                </p>
              )}
            </Panel>
            {canManage && (
              <ArchivePanel
                noun={noun}
                name={service.name}
                archived={service.archivedAt !== null}
                hint={
                  blocker === "on_quotes"
                    ? `Archiving hides this ${noun} from the library and new quotes. It's on quotes, so it can't be deleted.`
                    : blocker === "in_bundles"
                      ? `Archiving hides this ${noun} from the library and new quotes. It's part of a bundle, so it can't be deleted.`
                      : `Archiving hides this ${noun} from the library and new quotes. Nothing uses it yet, so you can also delete it.`
                }
                archivedHint="Hidden from the library and new quotes. Quotes that already use it are unchanged."
                archive={archiveService.bind(null, service.id)}
                remove={blocker ? undefined : removeService.bind(null, service.id)}
              />
            )}
          </div>
        </div>
      </div>
    </LiveAppShell>
  );
}
