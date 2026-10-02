import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Search } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { QUOTE_STATUS } from "@/components/app/quotes/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { quoteRef } from "@/core/quote";
import { countQuotes, listQuotes } from "@/db/quotes";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "Quotes" };

type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";


const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePermission("quotes.edit");
  const params = await searchParams;
  const search = one(params.q).trim();
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);
  const [{ quotes, hasMore }, total] = await withSession(session, async (tx) => [
    await listQuotes(tx, session.orgId, { search, page }),
    await countQuotes(tx, session.orgId),
  ]);
  const href = (p: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/app/quotes?${s}` : "/app/quotes";
  };

  return (
    <LiveAppShell active="quote" crumbs={["Quotes", "All quotes"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="Quotes" subtitle={`${total} ${total === 1 ? "quote" : "quotes"}`}>
          <Button asChild>
            <Link href="/app/quotes/new">
              <Plus />
              New quote
            </Link>
          </Button>
        </ScreenTitle>

        <form action="/app/quotes" role="search" className="relative w-[360px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search title, client or number"
            aria-label="Search quotes"
            maxLength={100}
            className="h-8 w-full rounded-md bg-white pr-2.5 pl-8 shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]"
          />
        </form>

        {quotes.length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FileSpreadsheet className="size-6 text-subtle" strokeWidth={1.5} />
            {search ? (
              <>
                <p className="font-medium">No quotes match &ldquo;{search}&rdquo;</p>
                <Link href="/app/quotes" className="text-ink-2 underline underline-offset-2 hover:text-ink">
                  Clear search
                </Link>
              </>
            ) : (
              <>
                <p className="font-medium">No quotes yet</p>
                <p className="max-w-[380px] text-subtle">Pick a client, give it a title, then build it line by line from your service library.</p>
                <Button asChild className="mt-2">
                  <Link href="/app/quotes/new">
                    <Plus />
                    Start your first quote
                  </Link>
                </Button>
              </>
            )}
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead className="border-b border-hairline text-[12px] text-subtle">
                <tr>
                  <th className="w-[90px] px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="w-[24%] px-4 py-2.5 font-medium">Client</th>
                  <th className="w-[100px] px-4 py-2.5 font-medium">Status</th>
                  <th className="w-[130px] px-4 py-2.5 text-right font-medium">Total inc. VAT</th>
                  <th className="w-[100px] px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="relative border-b border-hairline last:border-0 hover:bg-surface">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-ink-2">{quoteRef(q.number)}</td>
                    <td className="truncate px-4 py-2.5 font-medium">
                      <Link href={`/app/quotes/${q.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                        {q.title}
                      </Link>
                    </td>
                    <td className="truncate px-4 py-2.5 text-ink-2">{q.clientName}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={QUOTE_STATUS[q.status]?.tone ?? "grey"}>{QUOTE_STATUS[q.status]?.label ?? q.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular">{formatGBP(q.total)}</td>
                    <td className="px-4 py-2.5 text-right text-subtle">{dateFormat.format(q.updatedAt)}</td>
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
                <Link href={href(page - 1)}>
                  <ChevronLeft />
                </Link>
              ) : (
                <ChevronLeft />
              )}
            </Button>
            <Button variant="secondary" size="icon" asChild={hasMore} disabled={!hasMore} aria-label="Next page">
              {hasMore ? (
                <Link href={href(page + 1)}>
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
