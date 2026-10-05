import "server-only";
import { isBilled, type ExpenseRow } from "@/db/costs";
import { privateUrl } from "@/server/storage";
import type { Expense } from "./types";

/** A database expense row, shaped for the client screens. */
export function toExpense(e: ExpenseRow): Expense {
  return {
    id: e.id,
    projectId: e.projectId,
    projectName: e.projectName,
    purchaseOrderId: e.purchaseOrderId,
    poNumber: e.poNumber,
    category: e.category,
    supplier: e.supplier,
    description: e.description,
    spentOn: e.spentOn,
    netPence: e.netPence,
    vatPence: e.vatPence,
    totalPence: e.totalPence,
    receipts: e.receipts.map((r) => ({ ...r, url: privateUrl(r.key) })),
    rechargeable: e.rechargeable,
    rechargeMarkupBps: e.rechargeMarkupBps,
    invoiceId: e.invoiceId,
    invoiceNumber: e.invoiceNumber,
    billed: isBilled(e),
    recoveredOn: e.recoveredOn,
    createdByName: e.createdByName,
  };
}
