import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/core/clients";
import { can } from "@/core/roles";
import { countClients, listClients } from "@/db/clients";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<{ q?: string | string[]; view?: string | string[]; page?: string | string[] }>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePermission("clients.view");
  const params = await searchParams;
  const search = one(params.q).trim();
  const archived = one(params.view) === "archived";
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);

  const [{ clients, hasMore }, counts] = await withSession(session, async (tx) => [
    await listClients(tx, session.orgId, { search, archived, page }),
    await countClients(tx, session.orgId),
  ]);
  const canManage = can(session.role, "clients.manage");

  const href = (next: { view?: "archived"; q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (next.view) qs.set("view", next.view);
    if (next.q) qs.set("q", next.q);
    if (next.page && next.page > 1) qs.set("page", String(next.page));
    const s = qs.toString();
    return s ? `/app/clients?${s}` : "/app/clients";
  };
  const view = archived ? ("archived" as const) : undefined;

  return (
    <LiveAppShell active="crm" crumbs={["Clients", archived ? "Archived" : "All clients"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle
          title="Clients"
          subtitle={`${counts.active} ${counts.active === 1 ? "client" : "clients"}${counts.archived ? ` · ${counts.archived} archived` : ""}`}
        >
          {canManage && (
            <Button asChild>
              <Link href="/app/clients/new">
                <Plus />
                Add client
              </Link>
            </Button>
          )}
        </ScreenTitle>

        <div className="flex items-center justify-between gap-3">
          <nav className="flex gap-1" aria-label="Client views">
            {[
              { label: "Active", count: counts.active, target: undefined },
              { label: "Archived", count: counts.archived, target: "archived" as const },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={href({ view: tab.target, q: search })}
                aria-current={view === tab.target ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-2.5",
                  view === tab.target ? "bg-white font-medium text-ink shadow-ring" : "text-ink-2 hover:bg-accent hover:text-ink",
                )}
              >
                {tab.label}
                <span className="text-[11.5px] text-subtle tabular">{tab.count}</span>
              </Link>
            ))}
          </nav>
          {/* A plain GET form: search works without JavaScript and the URL can be shared or bookmarked. */}
          <form action="/app/clients" className="relative w-[320px]" role="search">
            {archived && <input type="hidden" name="view" value="archived" />}
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
            <input
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Search name, email, phone, address or postcode"
              aria-label="Search clients"
              maxLength={100}
              className="h-8 w-full rounded-md bg-white pr-2.5 pl-8 text-[13px] shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]"
            />
          </form>
        </div>

        {clients.length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Users className="size-6 text-subtle" strokeWidth={1.5} />
            {search ? (
              <>
                <p className="font-medium">No clients match &ldquo;{search}&rdquo;</p>
                <Link href={href({ view })} className="text-ink-2 underline underline-offset-2 hover:text-ink">
                  Clear search
                </Link>
              </>
            ) : archived ? (
              <p className="font-medium">No archived clients</p>
            ) : (
              <>
                <p className="font-medium">No clients yet</p>
                <p className="max-w-[360px] text-subtle">Add the people you quote for. You&apos;ll pick them when you start a quote.</p>
                {canManage && (
                  <Button asChild className="mt-2">
                    <Link href="/app/clients/new">
                      <Plus />
                      Add your first client
                    </Link>
                  </Button>
                )}
              </>
            )}
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead className="border-b border-hairline text-[12px] text-subtle">
                <tr>
                  <th className="w-[26%] px-4 py-2.5 font-medium">Name</th>
                  <th className="w-[24%] px-4 py-2.5 font-medium">Email</th>
                  <th className="w-[15%] px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium">Address</th>
                  <th className="w-[13%] px-4 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="group relative border-b border-hairline last:border-0 hover:bg-surface">
                    <td className="truncate px-4 py-2.5 font-medium">
                      {/* The link covers the whole row, so any cell opens the client. */}
                      <Link href={`/app/clients/${c.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                        {c.name}
                      </Link>
                    </td>
                    <td className="truncate px-4 py-2.5 text-ink-2">{c.email}</td>
                    <td className="truncate px-4 py-2.5 text-ink-2 tabular">{c.phone}</td>
                    <td className="truncate px-4 py-2.5 text-ink-2">{formatAddress(c.address)}</td>
                    <td className="truncate px-4 py-2.5 text-ink-2">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-subtle">Page {page}</span>
            <Button variant="secondary" size="icon" asChild={page > 1} disabled={page <= 1} aria-label="Previous page">
              {page > 1 ? (
                <Link href={href({ view, q: search, page: page - 1 })}>
                  <ChevronLeft />
                </Link>
              ) : (
                <ChevronLeft />
              )}
            </Button>
            <Button variant="secondary" size="icon" asChild={hasMore} disabled={!hasMore} aria-label="Next page">
              {hasMore ? (
                <Link href={href({ view, q: search, page: page + 1 })}>
                  <ChevronRight />
                </Link>
              ) : (
                <ChevronRight />
              )}
            </Button>
          </div>
        )}
      </div>
    </LiveAppShell>
  );
}
