"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FilePen, FileText, ThumbsDown, Undo2 } from "lucide-react";
import { createInvoice } from "@/app/app/payments/actions";
import { reviseVariationAction, withdrawVariationAction, type VariationActionResult } from "@/app/app/variations/actions";
import { CopyButton } from "@/components/app/quotes/send-dialog";
import { VariationDocument } from "@/components/portal/variation-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatGBP } from "@/core/money";
import { invoiceRef } from "@/core/payment-plan";
import type { VariationSnapshot } from "@/core/variation";
import { VARIATION_STATUS } from "./status";

const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

export type VariationViewProps = {
  id: string;
  quoteId: string;
  status: string;
  snapshot: VariationSnapshot;
  sentAt: Date;
  link: string | null;
  decision: { at: Date; name: string; signature: string | null; reason: string | null; ip: string | null } | null;
  contentHash: string;
  invoice: { id: string; number: number } | null;
  canEdit: boolean;
  canInvoice: boolean;
  bankReady: boolean;
  clientName: string;
};

/** A sent variation from the team's side: what the client sees, their decision, and what to do next. */
export function VariationView(p: VariationViewProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const s = VARIATION_STATUS[p.status] ?? VARIATION_STATUS.sent;
  const run = (fn: () => Promise<VariationActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
      router.refresh();
    });
  const canRevise = p.canEdit && (p.status === "sent" || p.status === "rejected" || p.status === "withdrawn");

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-surface-2">
        <div className="flex items-start gap-4 border-b border-hairline bg-white px-6 pt-[18px] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[12px] text-subtle">{p.snapshot.ref}</span>
              <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{p.snapshot.title}</h1>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <div className="mt-1 text-subtle">
              Variation to{" "}
              <Link href={`/app/quotes/${p.quoteId}`} className="hover:text-ink">
                {p.snapshot.quote.ref} · {p.snapshot.quote.title}
              </Link>{" "}
              · sent {time(p.sentAt)}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {p.link && p.status === "sent" && <CopyButton text={p.link} label="Copy client link" />}
            {canRevise && (
              <Button variant="secondary" disabled={pending} onClick={() => run(() => reviseVariationAction(p.id))}>
                <FilePen className="text-ink-2" />
                {p.status === "sent" ? "Revise" : "Revise and resend"}
              </Button>
            )}
            {p.canEdit && p.status === "sent" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <Undo2 className="text-ink-2" />
                    Withdraw
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Withdraw this variation?</DialogTitle>
                  <DialogDescription>{p.clientName} won&apos;t be able to approve it any more. It stays on record as withdrawn.</DialogDescription>
                  <div className="mt-5 flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="ghost">Keep it</Button>
                    </DialogClose>
                    <Button variant="destructive" disabled={pending} onClick={() => run(() => withdrawVariationAction(p.id))}>
                      Withdraw
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        {error && <p className="mx-6 mt-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-danger">{error}</p>}
        <div className="mx-auto w-full max-w-[820px] px-4 py-5 lg:px-6">
          <p className="mb-3 text-[12.5px] text-subtle">This is exactly what {p.clientName} sees. Costs and markups aren&apos;t shown to clients.</p>
          <VariationDocument snapshot={p.snapshot} sentAt={p.sentAt} />
        </div>
      </div>

      <aside className="flex w-[320px] flex-none flex-col gap-4 overflow-auto border-l border-hairline bg-white p-[18px]">
        <div>
          <div className="text-[12.5px] text-subtle">{p.snapshot.totals.total < 0 ? "Credit inc. VAT" : "Total inc. VAT"}</div>
          <div className="text-[24px] font-semibold tracking-[-0.02em] tabular">{formatGBP(p.snapshot.totals.total)}</div>
        </div>
        {p.status === "sent" && <div className="rounded-[10px] bg-warning-soft px-3.5 py-3 text-warning">Waiting for {p.clientName} to approve or reject it.</div>}
        {p.status === "withdrawn" && <div className="rounded-[10px] bg-surface px-3.5 py-3 text-ink-2">Withdrawn. {p.clientName} can no longer see or approve it.</div>}
        {p.decision && p.status === "rejected" && (
          <div className="rounded-[10px] bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2 font-medium text-ink-2">
              <ThumbsDown className="size-4" />
              Rejected by {p.decision.name}
            </div>
            <div className="mt-0.5 text-[12px] text-subtle">{time(p.decision.at)}</div>
            {p.decision.reason && <p className="mt-2 whitespace-pre-line text-ink-2">&ldquo;{p.decision.reason}&rdquo;</p>}
          </div>
        )}
        {p.decision && p.status === "approved" && (
          <div className="rounded-[10px] bg-success-soft px-3.5 py-3">
            <div className="flex items-center gap-2 font-medium text-success">
              <Check className="size-4" />
              Approved
            </div>
            <div className="mt-2 font-signature text-[22px] leading-tight">{p.decision.signature}</div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
              <dt className="text-subtle">Name</dt>
              <dd>{p.decision.name}</dd>
              <dt className="text-subtle">Time</dt>
              <dd>{time(p.decision.at)}</dd>
              {p.decision.ip && (
                <>
                  <dt className="text-subtle">IP</dt>
                  <dd className="font-mono">{p.decision.ip}</dd>
                </>
              )}
              <dt className="text-subtle">Version</dt>
              <dd className="font-mono break-all">{p.contentHash.slice(0, 16)}</dd>
            </dl>
          </div>
        )}
        {p.status === "approved" && (
          <div>
            <div className="mb-2 text-xs font-medium text-subtle">Billing</div>
            {p.invoice ? (
              <Link href={`/app/invoices/${p.invoice.id}`} className="flex items-center gap-2 rounded-[10px] bg-surface px-3.5 py-3 hover:bg-muted">
                <FileText className="size-4 text-ink-2" />
                On invoice <span className="font-mono">{invoiceRef(p.invoice.number)}</span>
              </Link>
            ) : p.snapshot.totals.total <= 0 ? (
              <p className="text-[12.5px] text-ink-2">A credit: add it to a payment&apos;s invoice from the quote&apos;s payment schedule.</p>
            ) : p.canInvoice ? (
              <InvoiceButton quoteId={p.quoteId} variationId={p.id} disabled={!p.bankReady} />
            ) : (
              <p className="text-[12.5px] text-ink-2">Not invoiced yet.</p>
            )}
            {p.canInvoice && !p.invoice && <p className="mt-2 text-[12px] text-subtle">Or add it to a payment&apos;s invoice from the quote&apos;s payment schedule.</p>}
            {p.canInvoice && !p.bankReady && !p.invoice && (
              <p className="mt-2 text-[12px] text-warning">
                Add your bank details in{" "}
                <Link href="/app/settings/payments" className="underline underline-offset-2">
                  Settings
                </Link>{" "}
                first.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function InvoiceButton({ quoteId, variationId, disabled }: { quoteId: string; variationId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  return (
    <>
      <Button
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            const r = await createInvoice({ quoteId, variationIds: [variationId], email: false });
            if (!r.ok) return setError(r.message);
            if (r.invoiceId) router.push(`/app/invoices/${r.invoiceId}`);
          })
        }
      >
        <FileText />
        {pending ? "Creating…" : "Create invoice"}
      </Button>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </>
  );
}
