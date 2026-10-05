import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, PO_STATUS_LABEL, margin, poRef } from "@/core/costs";
import { formatGBP } from "@/core/money";
import { formatMinutes } from "@/core/team";
import { cn } from "@/lib/utils";
import { shortDay } from "../projects/types";
import { ExpensesPanel } from "./expenses-panel";
import { PO_TONE, type Expense, type PoOption, type ProjectOption } from "./types";
import type { JobCosting } from "@/db/costs";

/**
 * A project's money going out, against what it earns: the quote's estimated cost, what's been spent so
 * far (expenses, labour from check-ins), orders placed but not billed yet, and purchases made for the
 * client that are billed back to them.
 */
export function JobCosts({
  projectId,
  quoteId,
  costing,
  expenses,
  projects,
  canEdit,
  storageEnabled,
}: {
  projectId: string;
  quoteId: string | null;
  costing: JobCosting;
  expenses: Expense[];
  projects: ProjectOption[];
  canEdit: boolean;
  storageEnabled: boolean;
}) {
  const c = costing;
  const income = c.quote?.incomeNet ?? null;
  const estimate = c.quote?.estimate ?? null;
  const spent = c.costsToDate;
  const forecast = Math.max(spent + c.committed, estimate ?? 0);
  const left = estimate !== null ? estimate - spent - c.committed : null;
  const used = estimate ? Math.min(100, ((spent + c.committed) / estimate) * 100) : 0;
  const expected = income !== null ? margin(income, forecast) : null;
  const orders: PoOption[] = c.purchaseOrders.map((o) => ({ id: o.id, number: o.number, projectId, supplierName: o.supplierName, netPence: o.netPence, vatRateBps: o.vatRateBps }));
  const vatNote = c.vatRegistered ? "Costs are shown without VAT (you reclaim it)." : "Costs include VAT, as you're not VAT registered (add a VAT number in Settings if you are).";

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2 px-4 py-5 lg:px-6">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Contract (ex VAT)" value={income !== null ? formatGBP(income, 0) : "–"} sub={c.quote ? (c.quote.variationsNet ? `incl. ${formatGBP(c.quote.variationsNet, 0)} variations` : "From the accepted quote") : "No accepted quote"} />
          <Kpi label="Estimated cost" value={estimate !== null ? formatGBP(estimate, 0) : "–"} sub={estimate !== null && income ? `${margin(income, estimate).percent}% margin at quote` : "From the quote's cost prices"} />
          <Kpi label="Spent so far" value={formatGBP(spent, 0)} sub={c.committed ? `+ ${formatGBP(c.committed, 0)} ordered, not billed` : `${formatGBP(c.expensesTotal, 0)} bills · ${formatGBP(c.labourTotal, 0)} labour`} />
          <Kpi
            label={left !== null && left < 0 ? "Over estimate" : "Left in the estimate"}
            value={left !== null ? formatGBP(Math.abs(left), 0) : "–"}
            tone={left !== null && left < 0 ? "text-danger" : undefined}
            sub={expected?.percent != null ? `Heading for ${expected.percent}% margin` : undefined}
          />
        </div>
        {estimate !== null && estimate > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white shadow-ring" aria-hidden>
              <div className={cn("h-full rounded-full", left !== null && left < 0 ? "bg-danger" : used > 85 ? "bg-warning" : "bg-success")} style={{ width: `${used}%` }} />
            </div>
            <span className="text-[12px] text-subtle tabular">{Math.round(((spent + c.committed) / estimate) * 100)}% of the estimate used</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4">
          <section className="rounded-[12px] bg-white p-5 shadow-ring">
            <h2 className="mb-2 font-semibold">Where the money&apos;s gone</h2>
            <dl className="flex flex-col gap-1.5 tabular">
              {EXPENSE_CATEGORIES.filter((k) => c.byCategory[k]).map((k) => (
                <Line key={k} label={EXPENSE_CATEGORY_LABEL[k]} value={c.byCategory[k]!} />
              ))}
              <Line label={`Labour (${formatMinutes(c.labour.reduce((s, l) => s + l.minutes, 0))} on site)`} value={c.labourTotal} />
              <div className="my-1 h-px bg-hairline" />
              <Line label="Spent so far" value={spent} strong />
              {c.committed > 0 && <Line label="Ordered, not billed yet" value={c.committed} muted />}
            </dl>
            {c.labour.length > 0 && (
              <table className="mt-4 w-full text-[12.5px]">
                <thead className="text-left text-[11.5px] text-subtle">
                  <tr>
                    <th className="pb-1 font-medium">Person</th>
                    <th className="pb-1 text-right font-medium">On site</th>
                    <th className="pb-1 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {c.labour.map((l) => (
                    <tr key={l.workerId} className="border-t border-muted">
                      <td className="py-1">
                        <Link href={`/app/team/${l.workerId}`} className="hover:underline">
                          {l.name}
                        </Link>
                        {l.unratedMinutes > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-warning" title="No day rate: their time isn't costed. Add one on their Team page.">
                            <AlertTriangle className="size-3" />
                            no day rate
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right">{formatMinutes(l.minutes)}</td>
                      <td className="py-1 text-right">{formatGBP(l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[12px] text-subtle">
              {vatNote} Labour is costed from site check-ins at each person&apos;s day rate (an 8-hour day).
            </p>
          </section>

          <div className="flex flex-col gap-4">
            <section className={cn("rounded-[12px] p-5 shadow-ring", c.recharges.outstanding > 0 ? "bg-warning-soft/40" : "bg-white")}>
              <h2 className="mb-1 font-semibold">Bought for the client</h2>
              {c.recharges.count === 0 ? (
                <p className="text-[12.5px] text-subtle">Nothing yet. When you buy something on the client&apos;s behalf (a boiler, the tiles they chose), tick &ldquo;Bought for the client&rdquo; on the expense to bill it back.</p>
              ) : (
                <>
                  <dl className="flex flex-col gap-1 tabular">
                    <Line label="To bill" value={c.recharges.outstanding} strong={c.recharges.outstanding > 0} />
                    <Line label="On invoices" value={c.recharges.billed} />
                    <Line label="Paid back another way" value={c.recharges.recovered} />
                  </dl>
                  <p className="mt-1 text-[11.5px] text-subtle">Before VAT. These aren&apos;t counted in your costs.</p>
                  {c.recharges.outstanding > 0 && quoteId && (
                    <Link href={`/app/quotes/${quoteId}`} className="mt-2 flex items-center gap-1 text-[12.5px] font-medium text-ink hover:underline">
                      Bill them from the payment schedule <ArrowRight className="size-3" />
                    </Link>
                  )}
                  {c.recharges.outstanding > 0 && !quoteId && <p className="mt-2 text-[12px] text-ink-2">This job has no quote, so bill these yourself, then mark them as paid back.</p>}
                </>
              )}
            </section>

            <section className="overflow-hidden rounded-[12px] bg-white shadow-ring">
              <div className="flex items-center gap-3 border-b border-hairline px-4 py-2.5">
                <h2 className="flex-1 font-semibold">Purchase orders</h2>
                {canEdit && (
                  <Button asChild variant="secondary">
                    <Link href={`/app/purchases/orders/new?project=${projectId}`}>
                      <Plus />
                      New order
                    </Link>
                  </Button>
                )}
              </div>
              {c.purchaseOrders.length === 0 ? (
                <p className="px-4 py-5 text-[12.5px] text-subtle">Order materials from suppliers here: email or print the order, then record their bill against it.</p>
              ) : (
                <ul>
                  {c.purchaseOrders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/app/purchases/orders/${o.id}`} className="flex items-center gap-3 border-b border-muted px-4 py-2 last:border-0 hover:bg-surface-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {poRef(o.number)} · {o.supplierName}
                          </span>
                          <span className="block text-[11.5px] text-subtle">
                            {o.lineCount} item{o.lineCount === 1 ? "" : "s"}
                            {o.neededBy ? ` · needed ${shortDay(o.neededBy)}` : ""}
                            {o.billedPence > 0 ? " · billed" : ""}
                          </span>
                        </span>
                        <span className="text-[12.5px] tabular">{formatGBP(o.netPence)}</span>
                        <Badge tone={PO_TONE[o.status]}>{PO_STATUS_LABEL[o.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <ExpensesPanel expenses={expenses} projects={projects} orders={orders} fixedProject={projectId} canEdit={canEdit} storageEnabled={storageEnabled} />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 shadow-ring">
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className={cn("mt-1.5 mb-1 text-2xl font-semibold tracking-[-0.02em] tabular", tone)}>{value}</div>
      {sub && <div className="text-xs text-subtle">{sub}</div>}
    </div>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "font-semibold", muted && "text-subtle")}>
      <dt className={strong ? undefined : "text-ink-2"}>{label}</dt>
      <dd>{formatGBP(value)}</dd>
    </div>
  );
}
