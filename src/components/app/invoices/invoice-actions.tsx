"use client";

import { WhatsAppButton } from "@/components/app/whatsapp-button";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Mail, Printer, Undo2 } from "lucide-react";
import { markInvoicePaid, markInvoiceUnpaid, sendInvoice, voidInvoiceAction, type InvoiceActionResult } from "@/app/app/payments/actions";
import { CopyButton } from "@/components/app/quotes/send-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { ukToday } from "@/core/payment-plan";
import { Field, control } from "../form-fields";

/** The team's buttons on an invoice: record payment, undo it, cancel, email it, copy the client's link. */
export function InvoiceActions({
  invoiceId,
  status,
  link,
  canEmail,
  sent,
  whatsapp,
}: {
  invoiceId: string;
  status: string;
  link: string | null;
  canEmail: boolean;
  sent: boolean;
  whatsapp: { phone: string | null; text: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const run = (fn: () => Promise<InvoiceActionResult>, done?: string, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      setMessage(r.ok ? (done ? { ok: true, text: done } : undefined) : { ok: false, text: r.message });
      if (r.ok) after?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {link && <CopyButton text={link} label="Copy client link" />}
        {whatsapp && <WhatsAppButton phone={whatsapp.phone} text={whatsapp.text} />}
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="text-ink-2" />
          Print
        </Button>
        {status === "issued" && canEmail && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => sendInvoice(invoiceId), "Emailed to the client.")}>
            <Mail className="text-ink-2" />
            {sent ? "Email again" : "Email to client"}
          </Button>
        )}
        {status === "issued" && <VoidButton pending={pending} onVoid={(close) => run(() => voidInvoiceAction(invoiceId), undefined, close)} />}
        {status === "issued" && <MarkPaidButton pending={pending} onSave={(paidOn, reference, close) => run(() => markInvoicePaid({ invoiceId, paidOn, reference }), undefined, close)} />}
        {status === "paid" && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => markInvoiceUnpaid(invoiceId))}>
            <Undo2 className="text-ink-2" />
            Mark as unpaid
          </Button>
        )}
      </div>
      {message && <p className={message.ok ? "text-[12px] text-success" : "text-[12px] text-danger"}>{message.text}</p>}
    </div>
  );
}

function MarkPaidButton({ pending, onSave }: { pending: boolean; onSave: (paidOn: string, reference: string | undefined, close: () => void) => void }) {
  const [open, setOpen] = React.useState(false);
  const [paidOn, setPaidOn] = React.useState(ukToday);
  const [reference, setReference] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CheckCircle2 />
          Mark as paid
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Record the payment</DialogTitle>
        <DialogDescription>When the money reached your account. Reminders stop once it&apos;s marked paid.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(paidOn, reference.trim() || undefined, () => setOpen(false));
          }}
        >
          <Field label="Date received">
            <input type="date" required value={paidOn} max={ukToday()} onChange={(e) => setPaidOn(e.target.value)} className={control} />
          </Field>
          <Field label="Bank reference" hint="Optional, as it appears on your statement.">
            <input value={reference} maxLength={TEXT.short} onChange={(e) => setReference(e.target.value)} className={control} />
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !paidOn}>
              {pending ? "Saving…" : "Mark as paid"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoidButton({ pending, onVoid }: { pending: boolean; onVoid: (close: () => void) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Ban className="text-ink-2" />
          Cancel invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Cancel this invoice?</DialogTitle>
        <DialogDescription>It stays on record as void, disappears from the client&apos;s portal and gets no more reminders. You can then raise the payment again, e.g. with a different date.</DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Keep it</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={() => onVoid(() => setOpen(false))}>
            {pending ? "Cancelling…" : "Cancel invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
