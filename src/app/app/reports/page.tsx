import type { Metadata } from "next";
import Link from "next/link";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { PROJECT_TONE } from "@/components/app/projects/types";
import { Badge } from "@/components/ui/badge";
import { margin } from "@/core/costs";
import { formatGBP } from "@/core/money";
import { PROJECT_STATUS_LABEL } from "@/core/projects";
import { formatMinutes } from "@/core/team";
import { costingReport } from "@/db/costs";
import { cisSettings } from "@/db/cis";
import { Button } from "@/components/ui/button";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const FILTERS = [
  { key: "current", label: "Current jobs" },
  { key: "complete", label: "Complete" },
  { key: "all", label: "All" },
] as const;

/**
 * Job costing across every job: what each one sells for, what it was estimated to cost, what's been spent
 * (bills and labour), and where the margin is heading. Expected cost is the larger of the estimate and
 * what's been spent, so a job over budget shows it.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const session = await requirePermission("costs.view");
  const raw = (await searchParams).filter;
  const filter = FILTERS.find((f) => f.key === (Array.isArray(raw) ? raw[0] : raw))?.key ?? "current";
  const { report, cis } = await withSession(session, async (tx) => ({ report: await costingReport(tx, session.orgId), cis: (await cisSettings(tx, session.orgId)).enabled }));
  const rows = report.rows.filter((r) => (filter === "all" ? true : filter === "complete" ? r.status === "complete" : r.status !== "complete"));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const income = sum((r) => r.incomeNet ?? 0);
  const expectedCost = sum((r) => Math.max(r.costs, r.estimate ?? 0));
  const all = margin(income, expectedCost);

  return (
    <LiveAppShell active="reports" crumbs={["Reports", "Job costing"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle title="Job costing" subtitle={`Every job's income against its costs. ${report.vatRegistered ? "All figures without VAT." : "Income without VAT; costs include VAT, as you're not VAT registered."}`}>
          {cis && (
            <Button variant="secondary" asChild>
              <Link href="/app/reports/cis">CIS monthly figures</Link>
            </Button>
          )}
        </ScreenTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Contract value" value={formatGBP(income, 0)} sub={`${rows.length} job${rows.length === 1 ? "" : "s"}`} />
          <Kpi label="Spent so far" value={formatGBP(sum((r) => r.costs), 0)} sub={`${formatGBP(sum((r) => r.labour), 0)} of it labour`} />
          <Kpi label="Expected profit" value={formatGBP(all.profit, 0)} sub={all.percent !== null ? `${all.percent}% margin` : undefined} tone={all.profit < 0 ? "text-danger" : undefined} />
          <Kpi label="To bill back to clients" value={formatGBP(sum((r) => r.toRecharge), 0)} sub="Purchases made on their behalf" tone={sum((r) => r.toRecharge) > 0 ? "text-warning" : undefined} />
        </div>
        <nav className="chip-row" aria-label="Filter jobs">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "current" ? "/app/reports" : `/app/reports?filter=${f.key}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", f.key === filter ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <Panel className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-subtle">No jobs here yet.</p>
          ) : (
            <table className="w-full min-w-[980px] tabular">
              <thead className="border-b border-hairline text-left text-[12px] text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Job</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Contract</th>
                  <th className="px-2 py-2 text-right font-medium">Estimated cost</th>
                  <th className="px-2 py-2 text-right font-medium">Spent so far</th>
                  <th className="w-[150px] px-2 py-2 font-medium">Of estimate</th>
                  <th className="px-2 py-2 text-right font-medium">Expected margin</th>
                  <th className="px-4 py-2 text-right font-medium">To bill back</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const used = r.estimate ? r.costs / r.estimate : null;
                  const m = r.incomeNet !== null ? margin(r.incomeNet, Math.max(r.costs, r.estimate ?? 0)) : null;
                  return (
                    <tr key={r.id} className="border-b border-muted last:border-0 hover:bg-surface-2">
                      <td className="max-w-[280px] px-4 py-2">
                        <Link href={`/app/projects/${r.id}?view=costs`} className="block truncate font-medium hover:underline">
                          {r.name}
                        </Link>
                        <span className="block truncate text-[11.5px] text-subtle">
                          {r.clientName}
                          {r.labourMinutes > 0 && ` · ${formatMinutes(r.labourMinutes)} on site`}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={PROJECT_TONE[r.status]}>{PROJECT_STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right">{r.incomeNet !== null ? formatGBP(r.incomeNet, 0) : <span className="text-subtle">No quote</span>}</td>
                      <td className="px-2 py-2 text-right text-ink-2">{r.estimate !== null ? formatGBP(r.estimate, 0) : "–"}</td>
                      <td className="px-2 py-2 text-right">{formatGBP(r.costs, 0)}</td>
                      <td className="px-2 py-2">
                        {used !== null ? (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                              <span className={cn("block h-full rounded-full", used > 1 ? "bg-danger" : used > 0.85 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, used * 100)}%` }} />
                            </span>
                            <span className={cn("w-10 text-right text-[12px]", used > 1 && "font-medium text-danger")}>{Math.round(used * 100)}%</span>
                          </span>
                        ) : (
                          <span className="text-subtle">–</span>
                        )}
                      </td>
                      <td className={cn("px-2 py-2 text-right", m && m.profit < 0 && "font-medium text-danger")}>{m?.percent != null ? `${m.percent}%` : "–"}</td>
                      <td className={cn("px-4 py-2 text-right", r.toRecharge > 0 ? "font-medium text-warning" : "text-subtle")}>{r.toRecharge > 0 ? formatGBP(r.toRecharge) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <p className="text-[12px] text-subtle">
          Estimated cost comes from the accepted quote&apos;s cost prices (before markup) plus approved variations. Spent so far is bills and receipts plus labour from site check-ins at each person&apos;s day rate. Purchases made for the client are left out of costs: they&apos;re billed back.
        </p>
      </div>
    </LiveAppShell>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 shadow-ring">
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className={cn("mt-1.5 mb-1 text-2xl font-semibold tracking-[-0.02em]", tone)}>{value}</div>
      {sub && <div className="text-xs text-subtle">{sub}</div>}
    </div>
  );
}
