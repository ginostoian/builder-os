import type { BadgeTone } from "@/components/ui/badge";
import type { ExpenseCategory, PoStatus } from "@/core/costs";

/** An expense as the office screens show it. Receipts carry their public URL. */
export type Expense = {
  id: string;
  projectId: string;
  projectName: string;
  purchaseOrderId: string | null;
  poNumber: number | null;
  category: ExpenseCategory;
  supplier: string | null;
  description: string;
  spentOn: string;
  netPence: number;
  vatPence: number;
  totalPence: number;
  receipts: { key: string; url: string; contentType: string }[];
  rechargeable: boolean;
  rechargeMarkupBps: number;
  invoiceId: string | null;
  invoiceNumber: number | null;
  /** On a live (not cancelled) invoice. */
  billed: boolean;
  recoveredOn: string | null;
  createdByName: string | null;
  /** A CIS payment to a subcontractor: materials part, rate and deduction. */
  cis: { workerId: string; materialsPence: number; rateBps: number; deductionPence: number } | null;
};

export type ProjectOption = { id: string; name: string };
export type PoOption = { id: string; number: number; projectId: string; supplierName: string; netPence: number; vatRateBps: number };

export const PO_TONE: Record<PoStatus, BadgeTone> = { draft: "grey", ordered: "blue", delivered: "green", cancelled: "muted" };
