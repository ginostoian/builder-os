"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { createInvoice } from "@/app/app/payments/actions";
import { INVOICE_STATE, shortDate } from "@/components/app/invoices/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatGBP } from "@/core/money";
import { invoiceRef, invoiceState, ukToday } from "@/core/payment-plan";
import type { SnapshotStage } from "@/core/quote-snapshot";

export type BillableVariation = { id: string; number: number; title: string; totalPence: number };

export type ScheduleRow = SnapshotStage & { invoice: { id: string; number: number; status: string; dueDate: string; paidOn: string | null } | null };

const dueText = (s: SnapshotStage) => (s.dueKind === "on_acceptance" ? "On acceptance" : s.dueKind === "date" && s.dueDate ? shortDate(s.dueDate) : "At a stage of work");

/** An accepted quote's payments: each one's invoice and where it stands, or a button to raise it. */
export function PaymentSchedule({
  quoteId,
  rows,
  billable,
  canInvoice,
  bankReady,
  emailEnabled,
  clientName,
  clientEmail,
}: {
  quoteId: string;
  rows: ScheduleRow[];
  billable: BillableVariation[];
  canInvoice: boolean;
  bankReady: boolean;
  emailEnabled: boolean;
  clientName: string;
  clientEmail: string | null;
}) {
  const today = ukToday();
  const paid = rows.reduce((a, r) => a + (r.invoice?.status === "paid" ? r.amount : 0), 0);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-subtle">Payment schedule</span>
        <span className="text-[12px] text-subtle tabular">
          {formatGBP(paid)} of {formatGBP(total)} paid
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-success" style={{ width: `${total ? (paid / total) * 100 : 0}%` }} />
      </div>
      {canInvoice && !bankReady && (
        <p className="mb-2 rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-warning">
          Add your bank details in{" "}
          <Link href="/app/settings/payments" className="underline underline-offset-2">
            Settings
          </Link>{" "}
          before raising invoices.
        </p>
      )}
      <ol className="flex flex-col divide-y divide-hairline rounded-[10px] shadow-ring">
        {rows.map((r) => {
          const state = r.invoice ? INVOICE_STATE[invoiceState(r.invoice.status, r.invoice.dueDate, today)] : null;
          return (
            <li key={r.id} className="flex flex-col gap-1.5 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{r.label}</span>
                <span className="font-medium tabular">{formatGBP(r.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
                {r.invoice ? (
                  <>
                    <Link href={`/app/invoices/${r.invoice.id}`} className="font-mono text-ink-2 underline-offset-2 hover:underline">
                      {invoiceRef(r.invoice.number)}
                    </Link>
                    <span className="flex items-center gap-2">
                      {r.invoice.paidOn ? `Paid ${shortDate(r.invoice.paidOn)}` : `Due ${shortDate(r.invoice.dueDate)}`}
                      {state && <Badge tone={state.tone}>{state.label}</Badge>}
                    </span>
                  </>
                ) : (
                  <>
                    <span>{dueText(r)}</span>
                    {canInvoice && <CreateInvoiceButton quoteId={quoteId} row={r} billable={billable} disabled={!bankReady} emailEnabled={emailEnabled} clientName={clientName} clientEmail={clientEmail} />}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CreateInvoiceButton({
  quoteId,
  row,
  billable,
  disabled,
  emailEnabled,
  clientName,
  clientEmail,
}: {
  quoteId: string;
  row: ScheduleRow;
  billable: BillableVariation[];
  disabled: boolean;
  emailEnabled: boolean;
  clientName: string;
  clientEmail: string | null;
}) {
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set());
  const total = row.amount + billable.filter((v) => picked.has(v.id)).reduce((a, v) => a + v.totalPence, 0);
  const router = useRouter();
  const canEmail = emailEnabled && Boolean(clientEmail);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState(canEmail);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <FileText className="text-ink-2" />
          Create invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Invoice {row.label.toLowerCase()}?</DialogTitle>
        <DialogDescription>
          {formatGBP(row.amount)} inc. VAT, payable by bank transfer. {row.dueKind === "date" && row.dueDate ? `Due ${shortDate(row.dueDate)} (or after your payment terms if that's passed).` : "Due after your payment terms."} It also appears in {clientName}&apos;s portal.
        </DialogDescription>
        {billable.length > 0 && (
          <fieldset className="mt-4 flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-medium">Add approved variations</legend>
            {billable.map((v) => (
              <label key={v.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={picked.has(v.id)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(v.id);
                      else next.delete(v.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  V{v.number} {v.title}
                </span>
                <span className="tabular">{formatGBP(v.totalPence)}</span>
              </label>
            ))}
            {picked.size > 0 && (
              <div className="mt-1 flex justify-between border-t border-hairline pt-1.5 font-medium tabular">
                <span>Invoice total</span>
                <span>{formatGBP(total)}</span>
              </div>
            )}
          </fieldset>
        )}
        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" checked={email} disabled={!canEmail} onChange={(e) => setEmail(e.target.checked)} />
          <span className={canEmail ? undefined : "text-subtle"}>{canEmail ? `Email it to ${clientEmail}` : clientEmail ? "Email isn't set up yet" : `${clientName} has no email address`}</span>
        </label>
        {error && <p className="mt-3 text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await createInvoice({ quoteId, stageId: row.id, variationIds: [...picked], email: email && canEmail });
                if (!r.ok) return setError(r.message);
                if (r.emailError) setError(`Invoice created, but: ${r.emailError}`);
                else setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Creating…" : email && canEmail ? "Create and email" : "Create invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
