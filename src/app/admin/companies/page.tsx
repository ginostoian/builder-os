import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { CompToggle } from "@/components/admin/comp-toggle";
import { BUCKET_STYLE, ago, date, gbp, num } from "@/components/admin/format";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { BUCKET_LABEL, type CompanyBucket } from "@/core/metrics";
import { PLAN_LABEL } from "@/core/plans";
import { cn } from "@/lib/utils";
import { requirePlatformAdmin } from "@/auth/platform-admin";
import { loadPlatformDashboard, type CompanyRow } from "@/server/platform-dashboard";

export const metadata: Metadata = { title: "Companies" };

const SORTS = {
  mrr: { label: "MRR", by: (a: CompanyRow, b: CompanyRow) => b.mrrPence - a.mrrPence || b.active30d - a.active30d },
  active: { label: "Most active", by: (a: CompanyRow, b: CompanyRow) => b.views30d - a.views30d },
  recent: { label: "Last active", by: (a: CompanyRow, b: CompanyRow) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0) },
  joined: { label: "Newest", by: (a: CompanyRow, b: CompanyRow) => b.createdAt.getTime() - a.createdAt.getTime() },
} as const;
type Sort = keyof typeof SORTS;

/** Every customer company: plan, what it pays, how much it's used, and complimentary Pro. */
export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<{ sort?: string; show?: string; q?: string }> }) {
  const me = await requirePlatformAdmin();
  const params = await searchParams;
  const sort: Sort = params.sort && params.sort in SORTS ? (params.sort as Sort) : "mrr";
  const show = params.show && params.show in BUCKET_LABEL ? (params.show as CompanyBucket) : params.show === "deleted" ? "deleted" : null;
  const q = (params.q ?? "").trim().toLowerCase().slice(0, 100);
  const now = new Date();
  const d = await loadPlatformDashboard(now);
  const rows = d.companies
    .filter((c) => (show === "deleted" ? c.deletedAt : !c.deletedAt && (!show || c.bucket === show)))
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort(SORTS[sort].by);
  const href = (next: { sort?: Sort; show?: string | null }) => {
    const qs = new URLSearchParams();
    const s = next.sort ?? sort;
    const f = next.show === undefined ? show : next.show;
    if (s !== "mrr") qs.set("sort", s);
    if (f) qs.set("show", f);
    if (q) qs.set("q", q);
    const str = qs.toString();
    return `/admin/companies${str ? `?${str}` : ""}`;
  };

  return (
    <AdminShell active="companies" who={me.email}>
      <ScreenTitle title="Companies" subtitle={`${d.counts.total} customers${d.counts.deleted ? `, ${d.counts.deleted} deleted` : ""}. Complimentary Pro is free until you turn it off.`}>
        <form action="/admin/companies" className="flex">
          {sort !== "mrr" && <input type="hidden" name="sort" value={sort} />}
          {show && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} placeholder="Find a company" aria-label="Find a company" className="h-8 w-[220px] rounded-md bg-white px-2.5 shadow-ring-input outline-none" />
        </form>
      </ScreenTitle>
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
            <h2 className="font-semibold">Companies</h2>
            <nav aria-label="Show" className="flex flex-wrap gap-1 text-[12px]">
              {([null, ...(Object.keys(BUCKET_LABEL) as CompanyBucket[]), ...(d.counts.deleted ? ["deleted" as const] : [])] as (CompanyBucket | "deleted" | null)[]).map((b) => (
                <Link
                  key={b ?? "all"}
                  href={href({ show: b })}
                  aria-current={show === b ? "true" : undefined}
                  className={cn("rounded-full px-2.5 py-1", show === b ? "bg-ink text-white" : "bg-surface text-ink-2 hover:text-ink")}
                >
                  {b === null ? `All ${d.counts.total}` : b === "deleted" ? `Deleted ${d.counts.deleted}` : `${BUCKET_LABEL[b]} ${d.counts[b]}`}
                </Link>
              ))}
            </nav>
            <div className="flex-1" />
            <nav aria-label="Sort" className="flex items-center gap-1 text-[12px] text-subtle">
              Sort:
              {(Object.keys(SORTS) as Sort[]).map((s) => (
                <Link key={s} href={href({ sort: s })} aria-current={sort === s ? "true" : undefined} className={cn("rounded px-1.5 py-0.5", sort === s ? "font-medium text-ink" : "hover:text-ink")}>
                  {SORTS[s].label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface text-left text-[11.5px] text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">MRR</th>
                  <th className="px-3 py-2 text-right font-medium" title="Active logins">Users</th>
                  <th className="px-3 py-2 text-right font-medium" title="People active in the last 7 / 30 days">Active 7d / 30d</th>
                  <th className="px-3 py-2 text-right font-medium" title="Page views in the last 30 days (site app in brackets)">Views 30d</th>
                  <th className="px-3 py-2 font-medium">Last active</th>
                  <th className="px-3 py-2 text-right font-medium" title="Quotes sent for the first time: last 30 days / ever">Quotes 30d / all</th>
                  <th className="px-3 py-2 text-right font-medium">Projects</th>
                  <th className="px-3 py-2 text-right font-medium" title="New leads in the last 30 days">Leads 30d</th>
                  <th className="px-3 py-2 font-medium">Complimentary</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11.5px] text-subtle">Joined {date(c.createdAt)}{c.deletedAt ? ` · deleted ${date(c.deletedAt)}` : ""}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", BUCKET_STYLE[c.bucket])} />
                        {c.bucket === "paying" || c.bucket === "past_due" ? PLAN_LABEL[c.plan] : BUCKET_LABEL[c.bucket]}
                      </span>
                      <span className="text-[11.5px] text-subtle">
                        {c.bucket === "past_due" ? "Payment failed" : c.bucket === "trial" && c.trialEndsAt ? `Ends ${date(c.trialEndsAt)}` : c.cancelAtPeriodEnd && c.mrrPence > 0 ? "Cancelling" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{c.mrrPence ? gbp(c.mrrPence) : "–"}</td>
                    <td className="px-3 py-2.5 text-right">{c.users}</td>
                    <td className="px-3 py-2.5 text-right">
                      {c.active7d} / {c.active30d}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {num(c.views30d)}
                      {c.siteViews30d > 0 && <span className="text-subtle"> ({num(c.siteViews30d)})</span>}
                    </td>
                    <td className={cn("px-3 py-2.5", !c.lastActiveAt || now.getTime() - c.lastActiveAt.getTime() > 14 * 86_400_000 ? "text-danger" : "text-ink-2")}>{ago(c.lastActiveAt, now)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {c.quotesSent30d} / {c.quotesSentTotal}
                    </td>
                    <td className="px-3 py-2.5 text-right">{c.projects}</td>
                    <td className="px-3 py-2.5 text-right">{c.leads30d}</td>
                    <td className="px-3 py-2.5">{!c.deletedAt && <CompToggle orgId={c.id} comped={c.comped} />}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-subtle">
                      No companies here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
    </AdminShell>
  );
}
