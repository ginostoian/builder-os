import type { Metadata } from "next";
import Link from "next/link";
import { FileDiff } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { VARIATION_STATUS } from "@/components/app/variations/status";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/core/money";
import { variationRef } from "@/core/variation";
import { listAllVariations, type VariationFilter } from "@/db/variations";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Variations" };

const FILTERS: { key: VariationFilter; label: string }[] = [
  { key: "open", label: "In progress" },
  { key: "awaiting", label: "Awaiting approval" },
  { key: "to_invoice", label: "Approved, not invoiced" },
  { key: "all", label: "All" },
];
const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(d);

/** Every variation across the company's jobs: what's being drafted, waiting on clients, or ready to bill. */
export default async function VariationsPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const session = await requirePermission("quotes.edit");
  const raw = (await searchParams).filter;
  const filter = FILTERS.find((f) => f.key === (Array.isArray(raw) ? raw[0] : raw))?.key ?? "open";
  const rows = await withSession(session, (tx) => listAllVariations(tx, session.orgId, filter));

  return (
    <LiveAppShell active="variations" crumbs={["Variations", FILTERS.find((f) => f.key === filter)!.label]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="Variations" subtitle="Changes to accepted quotes, approved by your clients. Start one from the accepted quote." />
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter variations">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "open" ? "/app/variations" : `/app/variations?filter=${f.key}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", f.key === filter ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FileDiff className="size-6 text-subtle" strokeWidth={1.5} />
            <p className="font-medium">Nothing here</p>
            <p className="max-w-[420px] text-subtle">Open an accepted quote and click New variation to price extra work (or work taken out). The client approves it with a signature.</p>
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead className="border-b border-hairline text-[12px] text-subtle">
                <tr>
                  <th className="w-[120px] px-4 py-2.5 font-medium">Variation</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="w-[26%] px-4 py-2.5 font-medium">Job</th>
                  <th className="w-[170px] px-4 py-2.5 font-medium">Status</th>
                  <th className="w-[120px] px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="w-[90px] px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const s = VARIATION_STATUS[v.status] ?? VARIATION_STATUS.draft;
                  return (
                    <tr key={v.id} className="relative border-b border-hairline last:border-0 hover:bg-surface">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ink-2">{variationRef(v.quoteNumber, v.number)}</td>
                      <td className="truncate px-4 py-2.5 font-medium">
                        <Link href={`/app/variations/${v.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                          {v.title}
                        </Link>
                      </td>
                      <td className="truncate px-4 py-2.5 text-ink-2">
                        {v.quoteTitle} · {v.clientName}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {v.status === "approved" && <span className="ml-2 text-[12px] text-subtle">{v.billed ? "invoiced" : "to invoice"}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular">{formatGBP(v.totalPence)}</td>
                      <td className="px-4 py-2.5 text-right text-subtle">{date(v.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </LiveAppShell>
  );
}
