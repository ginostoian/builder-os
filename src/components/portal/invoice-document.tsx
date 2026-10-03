import { Check } from "lucide-react";
import { formatAddress } from "@/core/clients";
import { formatGBP } from "@/core/money";
import { formatSortCode, invoiceState, ukToday } from "@/core/payment-plan";
import { longDate } from "@/core/quote-snapshot";
import type { InvoiceSnapshot } from "@/db/invoices";
import { cn } from "@/lib/utils";
import { CompanyMark } from "./quote-document";

export type InvoiceView = {
  snapshot: InvoiceSnapshot;
  status: string;
  issueDate: string;
  dueDate: string;
  netPence: number;
  vatPence: number;
  totalPence: number;
  paidOn: string | null;
};

/**
 * An invoice as the client sees it, from what was frozen when it was raised. Shared by the client portal and
 * the team's invoice screen. Prints cleanly on A4.
 */
export function InvoiceDocument({ invoice }: { invoice: InvoiceView }) {
  const s = invoice.snapshot;
  const state = invoiceState(invoice.status, invoice.dueDate, ukToday());
  const company = s.company.tradingName ?? s.company.name;
  return (
    <article className="flex flex-col gap-3.5">
      {state === "paid" && (
        <div className="flex items-center gap-2 rounded-[10px] bg-success-soft px-4 py-3 font-medium text-success">
          <Check className="size-4" />
          Paid{invoice.paidOn ? ` on ${longDate(invoice.paidOn)}` : ""}. Thank you.
        </div>
      )}
      {state === "void" && <div className="rounded-[10px] bg-muted px-4 py-3 font-medium text-ink-2">This invoice was cancelled. Nothing is owed on it.</div>}
      {state === "overdue" && <div className="rounded-[10px] bg-danger-soft px-4 py-3 font-medium text-danger">This invoice was due on {longDate(invoice.dueDate)}.</div>}

      <section className="rounded-[14px] bg-white px-6 py-6 shadow-ring print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <CompanyMark company={s.company} />
            <div>
              <div className="font-semibold">{company}</div>
              {s.company.tradingName && s.company.tradingName !== s.company.name && <div className="text-[12px] text-subtle">{s.company.name}</div>}
              {s.company.vatNumber && <div className="text-[12px] text-subtle">VAT {s.company.vatNumber}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12.5px] text-subtle">Invoice</div>
            <div className="font-mono text-[18px] font-semibold">{s.ref}</div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div className="col-span-2">
            <dt className="text-[12px] text-subtle">Billed to</dt>
            <dd className="mt-0.5">
              <div className="font-medium">{s.client.name}</div>
              {s.client.address && <div className="text-ink-2">{formatAddress(s.client.address)}</div>}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-subtle">Issued</dt>
            <dd className="mt-0.5">{longDate(invoice.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-subtle">Due</dt>
            <dd className={cn("mt-0.5 font-medium", state === "overdue" && "text-danger")}>{longDate(invoice.dueDate)}</dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-hairline">
          <div className="flex items-baseline gap-3 py-3">
            <span className="flex-1">{s.description}</span>
            <span className="tabular">{formatGBP(invoice.netPence)}</span>
          </div>
          <div className="flex flex-col gap-1 border-t border-hairline pt-3 tabular">
            <div className="flex justify-between text-ink-2">
              <span>Subtotal</span>
              <span>{formatGBP(invoice.netPence)}</span>
            </div>
            <div className="flex justify-between text-ink-2">
              <span>VAT {Number((s.vatRateBps / 100).toFixed(2))}%</span>
              <span>{formatGBP(invoice.vatPence)}</span>
            </div>
            <div className="mt-1 flex justify-between text-[17px] font-semibold">
              <span>{state === "paid" ? "Total paid" : "Amount due"}</span>
              <span>{formatGBP(invoice.totalPence)}</span>
            </div>
          </div>
        </div>
      </section>

      {state !== "void" && (
        <section className="rounded-[14px] bg-white px-6 py-5 shadow-ring print:shadow-none print:break-inside-avoid">
          <h2 className="font-semibold">Pay by bank transfer</h2>
          <p className="mt-0.5 text-[12.5px] text-subtle">Please use the reference so we can match your payment.</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-subtle">Account name</dt>
            <dd className="font-medium">{s.bank.accountName}</dd>
            <dt className="text-subtle">Sort code</dt>
            <dd className="font-mono font-medium">{formatSortCode(s.bank.sortCode)}</dd>
            <dt className="text-subtle">Account number</dt>
            <dd className="font-mono font-medium">{s.bank.accountNumber}</dd>
            <dt className="text-subtle">Reference</dt>
            <dd className="font-mono font-medium">{s.ref}</dd>
            <dt className="text-subtle">Amount</dt>
            <dd className="font-medium tabular">{formatGBP(invoice.totalPence)}</dd>
          </dl>
        </section>
      )}
    </article>
  );
}
