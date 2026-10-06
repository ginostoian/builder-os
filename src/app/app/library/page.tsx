import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Layers, Library, Plus, Search, Upload } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { can } from "@/core/roles";
import { libraryCounts, listServices, type ServiceKindFilter } from "@/db/services";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Service library" };

type Params = { q?: string; category?: string; kind?: string; view?: string; page?: string };
type SearchParams = Promise<Record<keyof Params, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const KINDS: { id: ServiceKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "service", label: "Services" },
  { id: "bundle", label: "Bundles" },
];

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePermission("library.view");
  const raw = await searchParams;
  const current: Required<Params> = { q: one(raw.q).trim(), category: one(raw.category), kind: one(raw.kind), view: one(raw.view) === "archived" ? "archived" : "", page: one(raw.page) };
  const kind: ServiceKindFilter = current.kind === "service" || current.kind === "bundle" ? current.kind : "all";
  const archived = current.view === "archived";
  const page = Math.max(1, Number.parseInt(current.page, 10) || 1);

  const [{ services, hasMore }, counts] = await withSession(session, async (tx) => [
    await listServices(tx, session.orgId, { search: current.q, category: current.category || undefined, kind, archived, page }),
    await libraryCounts(tx, session.orgId),
  ]);
  const canManage = can(session.role, "library.manage");

  /** Same filters, with some changed. Changing any filter goes back to page 1. */
  const href = (change: Partial<Params>) => {
    const next: Partial<Params> = { ...current, page: undefined, ...change };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "kind" && v === "all")) qs.set(k, v);
    const s = qs.toString();
    return s ? `/app/library?${s}` : "/app/library";
  };
  const filtered = Boolean(current.q || current.category || kind !== "all");
  const bundles = services.filter((s) => s.kind === "bundle").length;

  return (
    <LiveAppShell active="templates" crumbs={["Quotes", "Service library"]}>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Categories" className="hidden w-[200px] flex-none flex-col gap-px overflow-auto border-r border-hairline px-2.5 py-[18px] lg:flex">
          <div className="px-2.5 pb-2 text-[11px] font-medium text-subtle">Categories</div>
          {[{ category: "", label: "All services", n: counts.active }, ...counts.categories.map((c) => ({ category: c.category, label: c.category, n: c.n }))].map((c) => {
            const active = current.category.toLowerCase() === c.category.toLowerCase();
            return (
              <Link
                key={c.label}
                href={href({ category: c.category, view: "" })}
                aria-current={active && !archived ? "page" : undefined}
                className={cn("flex justify-between gap-2 rounded-[7px] px-2.5 py-[7px]", active && !archived ? "bg-line font-medium" : "hover:bg-surface")}
              >
                <span className="truncate">{c.label}</span>
                <span className="text-subtle tabular">{c.n}</span>
              </Link>
            );
          })}
          {counts.archived > 0 && (
            <Link
              href={href({ view: "archived", category: "" })}
              aria-current={archived ? "page" : undefined}
              className={cn("mt-3 flex justify-between gap-2 rounded-[7px] px-2.5 py-[7px] text-ink-2", archived ? "bg-line font-medium text-ink" : "hover:bg-surface")}
            >
              <span>Archived</span>
              <span className="text-subtle tabular">{counts.archived}</span>
            </Link>
          )}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-5 lg:px-6">
          <ScreenTitle
            title={archived ? "Archived" : current.category || "Service library"}
            subtitle={archived ? "Hidden from new quotes. Restore anything you still need." : "Priced services and bundles. Add them to a quote and adjust."}
          >
            {canManage && (
              <>
                <Button variant="secondary" asChild>
                  <Link href="/app/library/import">
                    <Upload className="text-ink-2" />
                    Import CSV
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/app/library/new?kind=bundle">
                    <Layers className="text-ink-2" />
                    New bundle
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={current.category ? `/app/library/new?category=${encodeURIComponent(current.category)}` : "/app/library/new"}>
                    <Plus />
                    New service
                  </Link>
                </Button>
              </>
            )}
          </ScreenTitle>

          <nav aria-label="Categories" className="chip-row lg:hidden">
            {[{ category: "", label: "All", n: counts.active }, ...counts.categories.map((c) => ({ category: c.category, label: c.category, n: c.n }))].map((c) => {
              const active = !archived && current.category.toLowerCase() === c.category.toLowerCase();
              return (
                <Link key={c.label} href={href({ category: c.category, view: "" })} aria-current={active ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", active ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring")}>
                  {c.label} <span className={active ? "text-white/70" : "text-subtle"}>{c.n}</span>
                </Link>
              );
            })}
            {counts.archived > 0 && (
              <Link href={href({ view: "archived", category: "" })} aria-current={archived ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", archived ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring")}>
                Archived <span className={archived ? "text-white/70" : "text-subtle"}>{counts.archived}</span>
              </Link>
            )}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {/* GET form: works without JavaScript, and the URL keeps the filters. */}
            <form action="/app/library" role="search" className="relative basis-full sm:max-w-[360px] sm:flex-1 sm:basis-0">
              {Object.entries({ category: current.category, kind: kind === "all" ? "" : kind, view: current.view }).map(
                ([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />,
              )}
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                name="q"
                type="search"
                defaultValue={current.q}
                placeholder='Search, e.g. "skim"'
                aria-label="Search the library"
                maxLength={100}
                className="h-[34px] w-full rounded-md bg-white pr-2.5 pl-8 shadow-ring outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]"
              />
            </form>
            <div className="flex gap-1.5" role="group" aria-label="Show">
              {KINDS.map((k) => (
                <Link
                  key={k.id}
                  href={href({ kind: k.id })}
                  aria-current={k.id === kind ? "page" : undefined}
                  className={cn("flex h-[34px] items-center rounded-md px-3", k.id === kind ? "bg-ink text-white" : "bg-white shadow-ring hover:bg-surface")}
                >
                  {k.label}
                </Link>
              ))}
            </div>
            <div className="flex-1" />
            {services.length > 0 && <span className="hidden text-xs text-subtle sm:inline">Most used first</span>}
          </div>

          {services.length === 0 ? (
            <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <Library className="size-6 text-subtle" strokeWidth={1.5} />
              {filtered ? (
                <>
                  <p className="font-medium">Nothing matches that yet.</p>
                  <Link href={archived ? "/app/library?view=archived" : "/app/library"} className="text-ink-2 underline underline-offset-2 hover:text-ink">
                    Clear filters
                  </Link>
                </>
              ) : archived ? (
                <p className="font-medium">Nothing archived</p>
              ) : (
                <>
                  <p className="font-medium">Your library is empty</p>
                  <p className="max-w-[400px] text-subtle">
                    Add the work you price often, like a plaster skim per m² or a boiler swap per job. Then group services into bundles, like a standard bathroom refit.
                  </p>
                  {canManage && (
                    <div className="mt-2 flex gap-2">
                      <Button asChild>
                        <Link href="/app/library/new">
                          <Plus />
                          Add your first service
                        </Link>
                      </Button>
                      <Button variant="secondary" asChild>
                        <Link href="/app/library/import">
                          <Upload className="text-ink-2" />
                          Import from a spreadsheet
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={`${services.length - bundles} services, ${bundles} bundles`}>
              {services.map((s) => (
                <Link
                  key={s.id}
                  href={`/app/library/${s.id}`}
                  className="flex flex-col gap-2.5 rounded-xl bg-white px-4 py-3.5 shadow-card-soft transition-shadow duration-[120ms] hover:shadow-pop focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)] focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-ink-2">{s.category}</span>
                    <span className="flex-none text-[11.5px] text-subtle">{s.kind === "bundle" ? `Bundle · ${s.itemCount} ${s.itemCount === 1 ? "item" : "items"}` : "Service"}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold tracking-[-0.01em]">{s.name}</div>
                    {s.description && <div className="mt-[3px] line-clamp-2 text-xs leading-[1.45] text-subtle">{s.description}</div>}
                  </div>
                  <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-line pt-2.5">
                    <span>
                      <span className="text-[17px] font-semibold tabular">{formatGBP(s.ratePence)}</span>
                      <span className="text-xs text-subtle"> / {s.unit}</span>
                    </span>
                    {s.usageCount > 0 && (
                      <span className="text-xs text-subtle">
                        Used in {s.usageCount} {s.usageCount === 1 ? "quote" : "quotes"}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-subtle">Page {page}</span>
              <Button variant="secondary" size="icon" asChild={page > 1} disabled={page <= 1} aria-label="Previous page">
                {page > 1 ? (
                  <Link href={href({ page: String(page - 1) })}>
                    <ChevronLeft />
                  </Link>
                ) : (
                  <ChevronLeft />
                )}
              </Button>
              <Button variant="secondary" size="icon" asChild={hasMore} disabled={!hasMore} aria-label="Next page">
                {hasMore ? (
                  <Link href={href({ page: String(page + 1) })}>
                    <ChevronRight />
                  </Link>
                ) : (
                  <ChevronRight />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </LiveAppShell>
  );
}
