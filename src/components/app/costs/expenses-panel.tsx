"use client";

import * as React from "react";
import { Paperclip, Plus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORY_LABEL, poRef } from "@/core/costs";
import { formatGBP } from "@/core/money";
import { invoiceRef } from "@/core/payment-plan";
import { cn } from "@/lib/utils";
import { shortDay } from "../projects/types";
import { ExpenseDialog, type ExpenseDraft } from "./expense-dialog";
import type { Expense, PoOption, ProjectOption } from "./types";

/** Where a purchase made for the client stands. */
export function RechargeBadge({ e }: { e: Pick<Expense, "rechargeable" | "billed" | "invoiceNumber" | "recoveredOn"> }) {
  if (!e.rechargeable) return null;
  if (e.recoveredOn) return <Badge tone="green">Paid back</Badge>;
  if (e.billed && e.invoiceNumber) return <Badge tone="blue">On {invoiceRef(e.invoiceNumber)}</Badge>;
  return <Badge tone="amber">For client · to bill</Badge>;
}

/**
 * A list of expenses with receipts, and the dialog to add or change one. On a project's Costs view the
 * project is fixed and its column hidden.
 */
export function ExpensesPanel({
  expenses,
  projects,
  orders,
  fixedProject,
  canEdit,
  storageEnabled,
  title = "Expenses",
  empty,
}: {
  expenses: Expense[];
  projects: ProjectOption[];
  orders: PoOption[];
  fixedProject?: string;
  canEdit: boolean;
  storageEnabled: boolean;
  title?: string;
  empty?: string;
}) {
  const [editing, setEditing] = React.useState<Expense | null>(null);
  const [adding, setAdding] = React.useState<ExpenseDraft | null>(null);
  // Remount the dialog per expense so its form starts fresh.
  const [key, setKey] = React.useState(0);
  const open = (e: Expense | null, draft: ExpenseDraft | null) => {
    setEditing(e);
    setAdding(draft);
    setKey((k) => k + 1);
  };

  return (
    <section className="overflow-hidden rounded-[12px] bg-white shadow-ring">
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-2.5">
        <h2 className="flex-1 font-semibold">{title}</h2>
        {canEdit && projects.length > 0 && (
          <Button size="app" onClick={() => open(null, fixedProject ? { projectId: fixedProject } : {})}>
            <Plus />
            Add expense
          </Button>
        )}
      </div>
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center text-subtle">
          <Receipt className="size-5" strokeWidth={1.5} />
          <p className="max-w-[420px]">{empty ?? "No expenses yet. Add receipts and bills as they come in: materials, hire, skips, subcontractors."}</p>
        </div>
      ) : (
        <table className="w-full">
          <thead className="border-b border-hairline text-left text-[12px] text-subtle">
            <tr>
              <th className="w-[84px] px-4 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">What</th>
              {!fixedProject && <th className="px-2 py-2 font-medium">Project</th>}
              <th className="w-[60px] px-2 py-2 font-medium">Receipt</th>
              <th className="px-2 py-2 font-medium" />
              <th className="w-[110px] px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} onClick={() => canEdit && open(e, null)} className={cn("border-b border-muted last:border-0", canEdit && "cursor-pointer hover:bg-surface-2")}>
                <td className="px-4 py-2 text-ink-2 tabular">{shortDay(e.spentOn)}</td>
                <td className="max-w-0 px-2 py-2">
                  <div className="truncate font-medium">{e.description}</div>
                  <div className="truncate text-[11.5px] text-subtle">
                    {[e.supplier, EXPENSE_CATEGORY_LABEL[e.category], e.poNumber ? poRef(e.poNumber) : null, e.createdByName ? `added by ${e.createdByName}` : null].filter(Boolean).join(" · ")}
                  </div>
                </td>
                {!fixedProject && <td className="max-w-[200px] truncate px-2 py-2 text-ink-2">{e.projectName}</td>}
                <td className="px-2 py-2">
                  {e.receipts.length > 0 ? (
                    <a href={e.receipts[0].url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-1 text-ink-2 hover:text-ink" title="Open receipt">
                      <Paperclip className="size-3.5" />
                      {e.receipts.length}
                    </a>
                  ) : (
                    <span className="text-[11.5px] text-warning">None</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <RechargeBadge e={e} />
                </td>
                <td className="px-4 py-2 text-right tabular">
                  <div className="font-medium">{formatGBP(e.totalPence)}</div>
                  {e.vatPence > 0 && <div className="text-[11px] text-subtle">{formatGBP(e.vatPence)} VAT</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(editing || adding) && (
        <ExpenseDialog
          key={key}
          open
          onOpenChange={(o) => !o && open(null, null)}
          expense={editing ?? undefined}
          draft={adding ?? undefined}
          projects={projects}
          orders={orders}
          fixedProject={fixedProject}
          storageEnabled={storageEnabled}
        />
      )}
    </section>
  );
}
