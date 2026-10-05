import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { INVOICE_STATE, shortDate } from "@/components/app/invoices/status";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/core/money";
import { invoiceRef, invoiceState, ukToday } from "@/core/payment-plan";
import { invoiceTotals, listInvoices, paymentSettings, type InvoiceFilter } from "@/db/invoices";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const FILTERS: { key: InvoiceFilter; label: string }[] = [
  { key: "outstanding", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All" },
];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const session = await requirePermission("invoices.manage");
  const raw = (await searchParams).filter;
  const filter = FILTERS.find((f) => f.key === (Array.isArray(raw) ? raw[0] : raw))?.key ?? "outstanding";
  const today = ukToday();
  const { invoices, totals, settings } = await withSession(session, async (tx) => ({
    invoices: await listInvoices(tx, session.orgId, filter, today),
    totals: await invoiceTotals(tx, session.orgId, today),
    settings: await paymentSettings(tx, session.orgId),
  }));
  const kpis = [
    { label: "Unpaid", value: formatGBP(totals.outstanding, 0), sub: "invoiced, not yet paid" },
    { label: "Overdue", value: formatGBP(totals.overdue, 0), sub: `${totals.overdueCount} ${totals.overdueCount === 1 ? "invoice" : "invoices"}`, tone: totals.overdueCount > 0 ? "text-danger" : undefined },
    { label: "Due in the next 7 days", value: formatGBP(totals.dueThisWeek, 0), sub: settings?.remindersEnabled ? "clients get reminders" : "reminders are off" },
    { label: "Paid this month", value: formatGBP(totals.paidThisMonth, 0), sub: "marked as received", tone: totals.paidThisMonth > 0 ? "text-success" : undefined },
  ];

  return (
    <LiveAppShell active="invoices" crumbs={["Payments", FILTERS.find((f) => f.key === filter)!.label]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle title="Payments" subtitle="Invoices raised from accepted quotes, paid by bank transfer or online." />

        {!settings?.bankSortCode && (
          <Panel className="flex items-center gap-3 border-l-4 border-warning px-4 py-3">
            <span className="flex-1">Add your bank details so invoices show clients where to pay.</span>
            <Link href="/app/settings/payments" className="font-medium underline underline-offset-2">
              Add bank details
            </Link>
          </Panel>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <Panel key={k.label} className="px-4 py-3.5">
              <div className="text-[12.5px] text-subtle">{k.label}</div>
              <div className={cn("mt-1 text-[22px] font-semibold tracking-[-0.02em] tabular", k.tone)}>{k.value}</div>
              <div className="mt-0.5 text-[12px] text-subtle">{k.sub}</div>
            </Panel>
          ))}
        </div>

        <nav className="flex gap-1.5" aria-label="Filter invoices">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "outstanding" ? "/app/payments" : `/app/payments?filter=${f.key}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", f.key === filter ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {invoices.length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Receipt className="size-6 text-subtle" strokeWidth={1.5} />
            <p className="font-medium">{filter === "overdue" ? "Nothing overdue" : filter === "paid" ? "No payments recorded yet" : filter === "outstanding" ? "Nothing waiting to be paid" : "No invoices yet"}</p>
            <p className="max-w-[420px] text-subtle">Once a client accepts a quote, open it and create an invoice for each payment in its plan.</p>
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead className="border-b border-hairline text-[12px] text-subtle">
                <tr>
                  <th className="w-[100px] px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">For</th>
                  <th className="w-[22%] px-4 py-2.5 font-medium">Client</th>
                  <th className="w-[110px] px-4 py-2.5 font-medium">Status</th>
                  <th className="w-[120px] px-4 py-2.5 font-medium">{filter === "paid" ? "Paid" : filter === "all" ? "Due or paid" : "Due"}</th>
                  <th className="w-[120px] px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const state = INVOICE_STATE[invoiceState(inv.status, inv.dueDate, today)];
                  return (
                    <tr key={inv.id} className="relative border-b border-hairline last:border-0 hover:bg-surface">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ink-2">{invoiceRef(inv.number)}</td>
                      <td className="truncate px-4 py-2.5 font-medium">
                        <Link href={`/app/invoices/${inv.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
                          {inv.description}
                        </Link>
                      </td>
                      <td className="truncate px-4 py-2.5 text-ink-2">{inv.clientName}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{shortDate(inv.paidOn ?? inv.dueDate)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular">{formatGBP(inv.totalPence)}</td>
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
