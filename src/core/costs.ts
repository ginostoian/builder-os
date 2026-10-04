/**
 * Job costing: what a job costs (expenses with receipts, labour from site check-ins, purchase orders) set
 * against what it earns. Some purchases are made on the client's behalf (a boiler, tiles they picked):
 * those are "recharges", billed back to the client rather than counted as the company's cost. Pure rules
 * shared by the screens, the database layer and the site app.
 */
import { applyBps, type Bps, type Pence } from "./money";

export const EXPENSE_CATEGORIES = ["materials", "subcontractor", "plant", "waste", "labour", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  materials: "Materials",
  subcontractor: "Subcontractor",
  plant: "Plant and tool hire",
  waste: "Skips and waste",
  labour: "Agency or extra labour",
  other: "Other",
};

/** Receipts (photos or PDFs) per expense. */
export const MAX_RECEIPTS = 6;

/** A working day for costing labour from check-ins: a day rate covers this many minutes on site. */
export const LABOUR_DAY_MINUTES = 8 * 60;

/** What someone's time on site cost: their day rate, pro rata by the minute (an 8-hour day). */
export function labourCost(minutes: number, dayRatePence: Pence): Pence {
  return Math.round((minutes * dayRatePence) / LABOUR_DAY_MINUTES);
}

/**
 * What an expense costs the company. A VAT-registered company reclaims the VAT, so its cost is the net;
 * otherwise the VAT is part of the cost.
 */
export const costOf = (e: { netPence: Pence; totalPence: Pence }, vatRegistered: boolean): Pence => (vatRegistered ? e.netPence : e.totalPence);

/**
 * The amount billed back to the client for something bought on their behalf, before VAT: what it cost the
 * company (as `costOf`) plus any handling markup.
 */
export function rechargeNet(cost: Pence, markupBps: Bps): Pence {
  return cost + applyBps(cost, markupBps);
}

/** "VAT included at 20%" on a gross amount: the VAT part, rounded to the penny. */
export function vatInGross(gross: Pence, vatBps: Bps): Pence {
  return gross - Math.round((gross * 10_000) / (10_000 + vatBps));
}

// ── Purchase orders ──────────────────────────────────────────────────────────

export const PO_STATUSES = ["draft", "ordered", "delivered", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const PO_STATUS_LABEL: Record<PoStatus, string> = { draft: "Draft", ordered: "Ordered", delivered: "Delivered", cancelled: "Cancelled" };
export const MAX_PO_LINES = 200;

export type PoLine = { id: string; description: string; qty: number; unit: string; unitPricePence: Pence };

export const poRef = (n: number) => `PO-${String(n).padStart(4, "0")}`;

export function poLineTotal(l: Pick<PoLine, "qty" | "unitPricePence">): Pence {
  return Math.round(l.qty * l.unitPricePence);
}

export function poTotals(lines: Pick<PoLine, "qty" | "unitPricePence">[], vatBps: Bps): { net: Pence; vat: Pence; total: Pence } {
  const net = lines.reduce((s, l) => s + poLineTotal(l), 0);
  const vat = applyBps(net, vatBps);
  return { net, vat, total: net + vat };
}

// ── The summary ──────────────────────────────────────────────────────────────

/** Profit and margin (as a percentage of income, one decimal), or null margin with no income. */
export function margin(income: Pence, costs: Pence): { profit: Pence; percent: number | null } {
  const profit = income - costs;
  return { profit, percent: income > 0 ? Math.round((profit / income) * 1000) / 10 : null };
}
