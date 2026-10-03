import type { BadgeTone } from "@/components/ui/badge";
import type { InvoiceState } from "@/core/payment-plan";

/** How an invoice's state reads in lists and headers. */
export const INVOICE_STATE: Record<InvoiceState, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "green" },
  void: { label: "Void", tone: "muted" },
  overdue: { label: "Overdue", tone: "red" },
  due_today: { label: "Due today", tone: "amber" },
  due_soon: { label: "Due soon", tone: "amber" },
  upcoming: { label: "Unpaid", tone: "blue" },
};

export const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
