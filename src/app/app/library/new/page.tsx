import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { ScreenTitle } from "@/components/app/app-shell";
import { BundleForm, ServiceForm } from "@/components/app/library/service-form";
import { bundleCandidates, libraryCounts } from "@/db/services";
import { requirePermission, withSession } from "@/auth/session";
import { companyMarkup } from "../data";

export const metadata: Metadata = { title: "New service" };

type SearchParams = Promise<{ kind?: string | string[]; category?: string | string[] }>;

export default async function NewServicePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePermission("library.manage");
  const params = await searchParams;
  const bundle = params.kind === "bundle";
  const category = (Array.isArray(params.category) ? params.category[0] : params.category)?.slice(0, 50) ?? "";

  const { categories, candidates, markup } = await withSession(session, async (tx) => ({
    categories: (await libraryCounts(tx, session.orgId)).categories.map((c) => c.category),
    candidates: bundle ? await bundleCandidates(tx, session.orgId) : [],
    markup: await companyMarkup(tx, session.orgId),
  }));
  const initial = category ? { category, name: "", description: null, unit: bundle ? "job" : "", defaultMarkupBps: null } : undefined;

  return (
    <LiveAppShell active="templates" crumbs={["Service library", bundle ? "New bundle" : "New service"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <div className="flex flex-col gap-2">
          <Link href="/app/library" className="flex w-fit items-center gap-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Service library
          </Link>
          <ScreenTitle
            title={bundle ? "New bundle" : "New service"}
            subtitle={bundle ? "Group services you often quote together, like a standard bathroom refit." : "Something you price often, like a plaster skim per m²."}
          />
        </div>
        <div className="max-w-[760px]">
          {bundle ? (
            <BundleForm canEdit categories={categories} candidates={candidates} companyMarkupBps={markup} initial={initial && { ...initial, items: [] }} />
          ) : (
            <ServiceForm canEdit categories={categories} companyMarkupBps={markup} initial={initial && { ...initial, ratePence: 0 }} />
          )}
        </div>
      </div>
    </LiveAppShell>
  );
}
