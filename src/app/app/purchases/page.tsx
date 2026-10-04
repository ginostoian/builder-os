import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { ExpensesPanel } from "@/components/app/costs/expenses-panel";
import { toExpense } from "@/components/app/costs/to-expense";
import { PO_TONE } from "@/components/app/costs/types";
import { shortDay } from "@/components/app/projects/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PO_STATUS_LABEL, poRef } from "@/core/costs";
import { formatGBP } from "@/core/money";
import { can } from "@/core/roles";
import { costProjects, listExpenses, listPurchaseOrders, type ExpenseFilter } from "@/db/costs";
import { requirePermission, withSession } from "@/auth/session";
import { storageConfigured } from "@/server/storage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Purchases" };

const VIEWS = [
  { key: "all", label: "Expenses" },
  { key: "to_recharge", label: "To bill to clients" },
  { key: "no_receipt", label: "Missing receipts" },
  { key: "orders", label: "Purchase orders" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/** Money going out across every job: receipts and bills, purchases to bill back to clients, and orders. */
export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const session = await requirePermission("costs.view");
  const raw = (await searchParams).view;
  const view: View = VIEWS.find((v) => v.key === (Array.isArray(raw) ? raw[0] : raw))?.key ?? "all";
  const canEdit = can(session.role, "costs.edit");
  const data = await withSession(session, async (tx) => ({
    projects: await costProjects(tx, session.orgId),
    expenses: view === "orders" ? [] : await listExpenses(tx, session.orgId, { filter: view as ExpenseFilter, limit: 500 }),
    orders: await listPurchaseOrders(tx, session.orgId),
  }));
  const projects = data.projects.map((p) => ({ id: p.id, name: p.name }));
  const orders = data.orders.map((o) => ({ id: o.id, number: o.number, projectId: o.projectId, supplierName: o.supplierName, netPence: o.netPence, vatRateBps: o.vatRateBps }));
  const label = VIEWS.find((v) => v.key === view)!.label;

  return (
    <LiveAppShell active="purchases" crumbs={["Purchases", label]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="Purchases" subtitle="Receipts, supplier bills and orders for every job. Each one goes into its job's costs.">
          {canEdit && projects.length > 0 && (
            <Button asChild variant="secondary">
              <Link href="/app/purchases/orders/new">
                <Plus />
                New purchase order
              </Link>
            </Button>
          )}
        </ScreenTitle>
        <nav className="flex gap-1.5" aria-label="Purchases views">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={v.key === "all" ? "/app/purchases" : `/app/purchases?view=${v.key}`}
              aria-current={v.key === view ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", v.key === view ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        {projects.length === 0 ? (
          <Panel className="px-6 py-12 text-center text-subtle">Costs belong to a job. Start a project first, then add its receipts and orders.</Panel>
        ) : view === "orders" ? (
          <Panel className="overflow-hidden">
            {data.orders.length === 0 ? (
              <p className="px-6 py-10 text-center text-subtle">No purchase orders yet. Raise one to order materials for a job, then email or print it.</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-hairline text-left text-[12px] text-subtle">
                  <tr>
                    <th className="px-4 py-2 font-medium">Order</th>
                    <th className="px-2 py-2 font-medium">Supplier</th>
                    <th className="px-2 py-2 font-medium">Project</th>
                    <th className="px-2 py-2 font-medium">Needed by</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Ex VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-muted last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2 font-mono">
                        <Link href={`/app/purchases/orders/${o.id}`} className="hover:underline">
                          {poRef(o.number)}
                        </Link>
                      </td>
                      <td className="px-2 py-2 font-medium">{o.supplierName}</td>
                      <td className="max-w-[240px] truncate px-2 py-2 text-ink-2">{o.projectName}</td>
                      <td className="px-2 py-2 text-ink-2">{o.neededBy ? shortDay(o.neededBy) : "–"}</td>
                      <td className="px-2 py-2">
                        <Badge tone={PO_TONE[o.status]}>{PO_STATUS_LABEL[o.status]}</Badge>
                        {o.billedPence > 0 && <span className="ml-1.5 text-[11.5px] text-subtle">billed</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular">{formatGBP(o.netPence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        ) : (
          <ExpensesPanel
            title={label}
            expenses={data.expenses.map(toExpense)}
            projects={projects}
            orders={orders}
            canEdit={canEdit}
            storageEnabled={storageConfigured()}
            empty={
              view === "to_recharge"
                ? "Nothing to bill back. Purchases ticked “Bought for the client” show here until they're invoiced or paid back."
                : view === "no_receipt"
                  ? "Every expense has its receipt."
                  : undefined
            }
          />
        )}
      </div>
    </LiveAppShell>
  );
}
