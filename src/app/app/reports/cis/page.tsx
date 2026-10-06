import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { CIS_STATUS_LABEL, taxMonth } from "@/core/cis";
import { formatGBP } from "@/core/money";
import { addDays, ukToday } from "@/core/payment-plan";
import { longDate } from "@/core/quote-snapshot";
import { cisMonth, cisSettings } from "@/db/cis";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "CIS" };

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * One tax month's CIS: each subcontractor paid, their gross, materials and deduction, as they go on the
 * CIS300 return; and a statement to give each of them.
 */
export default async function CisReportPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const session = await requirePermission("costs.view");
  const raw = (await searchParams).month;
  const day = isDay(Array.isArray(raw) ? raw[0] : raw) ? (Array.isArray(raw) ? raw[0] : raw)! : ukToday();
  const m = taxMonth(day);
  const data = await withSession(session, async (tx) => ({ settings: await cisSettings(tx, session.orgId), lines: await cisMonth(tx, session.orgId, m.start, m.end) }));
  const total = data.lines.reduce((a, l) => ({ gross: a.gross + l.grossPence, materials: a.materials + l.materialsPence, deduction: a.deduction + l.deductionPence }), { gross: 0, materials: 0, deduction: 0 });
  const prev = taxMonth(addDays(m.start, -1)).start;
  const next = addDays(m.end, 1);
  const current = taxMonth(ukToday()).start;

  return (
    <LiveAppShell active="reports" crumbs={["Reports", "CIS"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle title="CIS" subtitle="Payments to subcontractors under the Construction Industry Scheme, by tax month (the 6th to the 5th).">
          {data.lines.length > 0 && (
            <Button variant="secondary" asChild>
              <a href={`/app/reports/cis/csv?month=${m.start}`}>
                <Download className="text-ink-2" />
                Download CSV
              </a>
            </Button>
          )}
        </ScreenTitle>

        {!data.settings.enabled && (
          <Panel className="px-5 py-4 text-ink-2">
            CIS is off. If you pay subcontractors under CIS, turn it on in{" "}
            <Link href="/app/settings/cis" className="text-ink underline underline-offset-2">
              Settings, CIS
            </Link>
            .
          </Panel>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/reports/cis?month=${prev}`} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-md bg-white shadow-ring hover:bg-accent">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={`/app/reports/cis?month=${next}`} aria-label="Next month" className="flex size-8 items-center justify-center rounded-md bg-white shadow-ring hover:bg-accent">
            <ChevronRight className="size-4" />
          </Link>
          <h2 className="ml-1.5 text-[15px] font-semibold">{m.label}</h2>
          {m.start !== current && (
            <Link href="/app/reports/cis" className="text-[12.5px] text-ink-2 hover:text-ink">
              This month
            </Link>
          )}
          <span className="w-full text-[12.5px] text-subtle sm:ml-auto sm:w-auto">Return and payment due by {longDate(m.dueBy)}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi label="Paid to subcontractors (before VAT)" value={formatGBP(total.gross)} />
          <Kpi label="Materials" value={formatGBP(total.materials)} />
          <Kpi label="Deducted, to pay HMRC" value={formatGBP(total.deduction)} />
        </div>

        <Panel className="overflow-x-auto">
          {data.lines.length === 0 ? (
            <p className="px-5 py-8 text-center text-subtle">No CIS payments in this tax month. Record subcontractors&apos; invoices as Subcontractor expenses with CIS details and they show here.</p>
          ) : (
            <table className="w-full min-w-[720px] tabular">
              <thead className="border-b border-hairline text-left text-[12px] text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Subcontractor</th>
                  <th className="px-2 py-2 font-medium">UTR</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Gross</th>
                  <th className="px-2 py-2 text-right font-medium">Materials</th>
                  <th className="px-2 py-2 text-right font-medium">Deducted</th>
                  <th className="px-4 py-2 text-right font-medium">Statement</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.workerId} className="border-b border-muted last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/app/team/${l.workerId}`} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                      <div className="text-[11.5px] text-subtle">
                        {l.payments} payment{l.payments === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-ink-2">{l.utr ?? <span className="text-warning">Missing</span>}</td>
                    <td className="px-2 py-2 text-ink-2">{l.status ? CIS_STATUS_LABEL[l.status] : <span className="text-warning">Not verified</span>}</td>
                    <td className="px-2 py-2 text-right">{formatGBP(l.grossPence)}</td>
                    <td className="px-2 py-2 text-right">{formatGBP(l.materialsPence)}</td>
                    <td className="px-2 py-2 text-right font-medium">{formatGBP(l.deductionPence)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/app/reports/cis/${l.workerId}?month=${m.start}`} className="text-[12.5px] text-ink-2 underline underline-offset-2 hover:text-ink">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <p className="text-[12px] text-subtle">
          Builder OS works out the figures; it doesn&apos;t file the return. Enter them in HMRC&apos;s CIS online service (or your payroll software) each month, and give each subcontractor their statement within 14 days of the month ending.
        </p>
      </div>
    </LiveAppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 shadow-ring">
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">{value}</div>
    </div>
  );
}
