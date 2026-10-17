import type { Metadata } from "next";
import Link from "next/link";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { longDate } from "@/core/quote-snapshot";
import { requirePermission } from "@/auth/session";
import { xeroReport } from "@/server/xero/reports";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Xero figures" };

/** The business as Xero sees it: cash, the last 12 months' profit, money owed, and profit per job. */
export default async function XeroReportPage() {
  const session = await requirePermission("costs.view");
  const report = await xeroReport(session.orgId);

  return (
    <LiveAppShell active="reports" crumbs={["Reports", "Xero figures"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle
          title="Your business in Xero"
          subtitle={
            report && !("error" in report)
              ? `${report.organisation}, ${longDate(report.from)} to ${longDate(report.to)}. From Xero's own figures, so costs entered in Xero count too.`
              : "From Xero's own figures."
          }
        >
          <Button variant="secondary" asChild>
            <Link href="/app/reports">Job costing</Link>
          </Button>
        </ScreenTitle>
        {!report ? (
          <Panel className="max-w-[640px] p-5">
            <p className="text-ink-2">
              Connect Xero to see your cash, profit and what you&apos;re owed here.{" "}
              <Link href="/app/settings/xero" className="underline underline-offset-2">
                Connect Xero
              </Link>
            </p>
          </Panel>
        ) : "error" in report ? (
          <Panel className="max-w-[640px] p-5">
            <p className="text-danger">{report.error}</p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="In the bank"
                value={formatGBP(
                  report.bank.reduce((a, b) => a + b.balance, 0),
                  0,
                )}
                sub={report.bank.length ? report.bank.map((b) => b.account).join(", ") : "No bank accounts in Xero"}
              />
              <Kpi label="Income, last 12 months" value={formatGBP(report.pnl.income, 0)} sub="Without VAT" />
              <Kpi
                label="Profit, last 12 months"
                value={formatGBP(report.pnl.netProfit, 0)}
                sub={report.pnl.income ? `${Math.round((report.pnl.netProfit / report.pnl.income) * 100)}% of income` : undefined}
                tone={report.pnl.netProfit < 0 ? "text-danger" : undefined}
              />
              <Kpi
                label="Owed to you"
                value={formatGBP(report.owed.total, 0)}
                sub={report.owed.overdue ? `${formatGBP(report.owed.overdue, 0)} overdue` : `${report.owed.count} unpaid invoice${report.owed.count === 1 ? "" : "s"}`}
                tone={report.owed.overdue ? "text-warning" : undefined}
              />
            </div>
            <Panel className="overflow-x-auto">
              <div className="px-4 pt-3.5 pb-1">
                <h2 className="text-[13.5px] font-semibold">Profit per job</h2>
                <p className="text-[12.5px] text-subtle">Everything in Xero tagged with each job: your invoices, and bills and costs your bookkeeper tags too.</p>
              </div>
              {!report.jobs ? (
                <p className="px-4 pb-4 text-ink-2">
                  Turn on Profit per job in{" "}
                  <Link href="/app/settings/xero" className="underline underline-offset-2">
                    Settings, Xero
                  </Link>{" "}
                  to see it here.
                </p>
              ) : report.jobs.length === 0 ? (
                <p className="px-4 pb-4 text-ink-2">No tagged jobs yet. New invoices are tagged with their job automatically.</p>
              ) : (
                <table className="w-full min-w-[640px] tabular">
                  <thead className="border-b border-hairline text-left text-[12px] text-subtle">
                    <tr>
                      <th className="px-4 py-2 font-medium">Job</th>
                      <th className="px-2 py-2 text-right font-medium">Income</th>
                      <th className="px-2 py-2 text-right font-medium">Costs</th>
                      <th className="px-4 py-2 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.jobs.map((j) => (
                      <tr key={j.option} className="border-b border-muted last:border-0">
                        <td className="px-4 py-2.5">{j.option}</td>
                        <td className="px-2 py-2.5 text-right">{formatGBP(j.income, 0)}</td>
                        <td className="px-2 py-2.5 text-right">{formatGBP(j.costs, 0)}</td>
                        <td className={cn("px-4 py-2.5 text-right font-medium", j.profit < 0 && "text-danger")}>{formatGBP(j.profit, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </>
        )}
      </div>
    </LiveAppShell>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 shadow-ring">
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className={cn("mt-1.5 mb-1 text-2xl font-semibold tracking-[-0.02em]", tone)}>{value}</div>
      {sub && <div className="truncate text-xs text-subtle">{sub}</div>}
    </div>
  );
}
