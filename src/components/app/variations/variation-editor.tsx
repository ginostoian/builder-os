"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, Trash2 } from "lucide-react";
import { removeVariationDraft, saveVariationDraft, sendVariationToClient } from "@/app/app/variations/actions";
import { CopyButton } from "@/components/app/quotes/send-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MAX_MARKUP_BPS, TEXT } from "@/core/limits";
import { formatBps, formatGBP, parsePence, parsePercentToBps } from "@/core/money";
import { qty as qtySchema } from "@/core/schemas";
import { MAX_VARIATION_LINES, variationLineTotal, variationTotals, type VariationLine } from "@/core/variation";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";

type Row = { id: string; name: string; qty: string; unit: string; rate: string; markup: string; omit: boolean };

const toRow = (l: VariationLine): Row => ({
  id: l.id,
  name: l.name,
  qty: String(Number(l.qty.toFixed(3))),
  unit: l.unit,
  rate: (l.ratePence / 100).toFixed(2),
  markup: String(Number((l.markupBps / 100).toFixed(2))),
  omit: l.omit,
});

/** A row as a priced line, or null with the reason it can't be. */
function parseRow(r: Row): VariationLine | null {
  const q = qtySchema.safeParse(Number(r.qty));
  const rate = parsePence(r.rate);
  const markup = parsePercentToBps(r.markup, MAX_MARKUP_BPS);
  if (!r.name.trim() || !r.unit.trim() || r.qty.trim() === "" || !q.success || rate === null || rate < 0 || markup === null) return null;
  return { id: r.id, name: r.name.trim(), qty: q.data, unit: r.unit.trim(), ratePence: rate, markupBps: markup, omit: r.omit };
}

/**
 * A draft variation: title, why it's needed, and its lines (cost rate + markup, like a quote; "taken out"
 * lines are credits). Saved with a button; sending saves first, then freezes it and gives the client link.
 */
export function VariationEditor({
  variation,
  defaultMarkupBps,
  clientName,
  clientEmail,
  emailEnabled,
}: {
  variation: { id: string; ref: string; title: string; reason: string | null; lines: VariationLine[]; vatRateBps: number; quoteId: string; quoteRef: string; quoteTitle: string };
  defaultMarkupBps: number;
  clientName: string;
  clientEmail: string | null;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(variation.title);
  const [reason, setReason] = React.useState(variation.reason ?? "");
  const [rows, setRows] = React.useState<Row[]>(() => (variation.lines.length ? variation.lines.map(toRow) : [blankRow(defaultMarkupBps)]));
  const [dirty, setDirty] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();

  const parsed = rows.map(parseRow);
  const valid = parsed.filter((l): l is VariationLine => l !== null);
  const totals = variationTotals(valid, variation.vatRateBps);
  const allValid = parsed.every((l) => l !== null) && title.trim() !== "";

  const edit = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const save = async (): Promise<boolean> => {
    if (!allValid) {
      setMessage({ ok: false, text: "Fix the highlighted lines first: each needs a name, quantity, unit and rate." });
      return false;
    }
    const r = await saveVariationDraft({ variationId: variation.id, title: title.trim(), reason: reason.trim() || undefined, lines: valid });
    if (!r.ok) {
      setMessage({ ok: false, text: r.message });
      return false;
    }
    setDirty(false);
    setMessage({ ok: true, text: "Saved" });
    return true;
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-surface-2">
        <div className="flex items-start gap-4 border-b border-hairline bg-white px-6 pt-[18px] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[12px] text-subtle">{variation.ref}</span>
              <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{title || "Untitled variation"}</h1>
              <Badge tone="grey">Draft</Badge>
            </div>
            <div className="mt-1 text-subtle">
              Variation to{" "}
              <Link href={`/app/quotes/${variation.quoteId}`} className="hover:text-ink">
                {variation.quoteRef} · {variation.quoteTitle}
              </Link>{" "}
              for {clientName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {message && <span className={cn("text-[12px]", message.ok ? "text-success" : "text-danger")}>{message.text}</span>}
            <Button variant="secondary" disabled={pending || !dirty} onClick={() => startTransition(async () => void (await save()))}>
              {pending ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </Button>
            <SendVariationDialog
              disabled={pending || valid.length === 0 || !allValid}
              clientName={clientName}
              clientEmail={clientEmail}
              emailEnabled={emailEnabled}
              total={totals.total}
              beforeSend={save}
              onSend={(email) => sendVariationToClient({ variationId: variation.id, email })}
              onDone={() => router.refresh()}
            />
          </div>
        </div>

        <div className="flex max-w-[1000px] flex-col gap-5 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" hint="What the client sees, e.g. Two extra double sockets in the kitchen." className="col-span-2">
              <input value={title} maxLength={TEXT.name} onChange={(e) => (setTitle(e.target.value), setDirty(true))} className={control} />
            </Field>
            <Field label="Why it's needed" hint="Optional. Shown to the client, e.g. what they asked for or what was found on site." className="col-span-2">
              <textarea value={reason} maxLength={TEXT.note} rows={3} onChange={(e) => (setReason(e.target.value), setDirty(true))} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
            </Field>
          </div>

          <div className="overflow-hidden rounded-[10px] bg-white shadow-ring">
            <div className="grid grid-cols-[minmax(0,1fr)_76px_72px_100px_76px_92px_104px_36px] items-center gap-2 border-b border-hairline bg-surface-2 px-3 py-2 text-[11.5px] font-medium text-subtle">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span>Unit</span>
              <span className="text-right">Rate £</span>
              <span className="text-right">Markup %</span>
              <span>Type</span>
              <span className="text-right">Client price</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const line = parsed[i];
              return (
                <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_76px_72px_100px_76px_92px_104px_36px] items-center gap-2 border-b border-hairline px-3 py-1.5 last:border-b-0">
                  <input aria-label="Item" value={r.name} maxLength={TEXT.line} placeholder="e.g. Extra double socket" onChange={(e) => edit(i, { name: e.target.value })} className={cn(control, !r.name.trim() && dirty && "shadow-[0_0_0_1.5px_var(--color-danger)]")} />
                  <input aria-label="Quantity" value={r.qty} inputMode="decimal" onChange={(e) => edit(i, { qty: e.target.value })} className={cn(control, "text-right tabular")} />
                  <input aria-label="Unit" value={r.unit} maxLength={TEXT.short} onChange={(e) => edit(i, { unit: e.target.value })} className={control} />
                  <input aria-label="Cost rate in pounds" value={r.rate} inputMode="decimal" onChange={(e) => edit(i, { rate: e.target.value })} className={cn(control, "text-right tabular")} />
                  <input aria-label="Markup percent" value={r.markup} inputMode="decimal" onChange={(e) => edit(i, { markup: e.target.value })} className={cn(control, "text-right tabular")} />
                  <select aria-label="Type" value={r.omit ? "omit" : "add"} onChange={(e) => edit(i, { omit: e.target.value === "omit" })} className={control}>
                    <option value="add">Extra</option>
                    <option value="omit">Taken out</option>
                  </select>
                  <span className={cn("text-right font-medium tabular", !line && "text-subtle", line?.omit && "text-info")}>{line ? formatGBP(variationLineTotal(line)) : "–"}</span>
                  <button
                    type="button"
                    aria-label="Remove line"
                    title="Remove line"
                    onClick={() => (setRows((rs) => rs.filter((_, j) => j !== i)), setDirty(true))}
                    className="grid size-7 place-items-center rounded-md text-subtle hover:bg-muted hover:text-ink [&_svg]:size-3.5"
                  >
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" disabled={rows.length >= MAX_VARIATION_LINES} onClick={() => (setRows((rs) => [...rs, blankRow(defaultMarkupBps)]), setDirty(true))}>
              <Plus />
              Add line
            </Button>
            <p className="text-[12px] text-subtle">Rates are your cost before markup, like on quotes. The client only sees the price.</p>
          </div>

          <div className="flex flex-col items-start gap-2 border-t border-hairline pt-5">
            <h2 className="text-[13.5px] font-semibold">Delete draft</h2>
            <p className="text-subtle">Removes this variation. It hasn&apos;t been sent, so the client never saw it.</p>
            <Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => void (await removeVariationDraft(variation.id)))}>
              <Trash2 />
              Delete draft
            </Button>
          </div>
        </div>
      </div>

      <aside className="flex w-[296px] flex-none flex-col gap-4 overflow-auto border-l border-hairline bg-surface-2 p-[18px]">
        <div>
          <div className="mb-2.5 text-xs font-medium text-subtle">Summary</div>
          <dl className="flex flex-col gap-2 tabular">
            <Row2 label="Your cost" value={formatGBP(totals.cost)} />
            <Row2 label="Subtotal" value={formatGBP(totals.net)} />
            <Row2 label={`VAT ${formatBps(variation.vatRateBps)}`} value={formatGBP(totals.vat)} />
            <div className="my-1 h-px bg-hairline" />
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">{totals.total < 0 ? "Credit" : "Total"}</dt>
              <dd className="text-[22px] font-semibold tracking-[-0.02em]">{formatGBP(totals.total)}</dd>
            </div>
          </dl>
        </div>
        {totals.net > 0 && (
          <div className="rounded-[10px] bg-white px-3.5 py-3 shadow-ring">
            <div className="flex justify-between text-[12.5px]">
              <span className="font-medium">Gross margin</span>
              <span className="font-medium tabular">{formatBps(totals.margin)}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-subtle">Only your team sees this.</div>
          </div>
        )}
        <p className="mt-auto text-[11.5px] leading-normal text-subtle">
          When it&apos;s sent, {clientName} approves it with a signature in their portal. Approved variations can be invoiced on their own or added to a payment.
        </p>
      </aside>
    </div>
  );
}

const blankRow = (markupBps: number): Row => ({ id: crypto.randomUUID(), name: "", qty: "1", unit: "item", rate: "", markup: String(Number((markupBps / 100).toFixed(2))), omit: false });

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SendVariationDialog({
  disabled,
  clientName,
  clientEmail,
  emailEnabled,
  total,
  beforeSend,
  onSend,
  onDone,
}: {
  disabled: boolean;
  clientName: string;
  clientEmail: string | null;
  emailEnabled: boolean;
  total: number;
  beforeSend: () => Promise<boolean>;
  onSend: (email: boolean) => ReturnType<typeof sendVariationToClient>;
  onDone: () => void;
}) {
  const canEmail = emailEnabled && Boolean(clientEmail);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState(canEmail);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof sendVariationToClient>>>();
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && result?.ok) onDone();
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Send />
          Send to client
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result?.ok ? (
          <>
            <DialogTitle>Sent to {clientName}</DialogTitle>
            <DialogDescription>
              {result.emailed ? `We emailed it to ${result.clientEmail}.` : (result.emailError ?? "Copy the link and send it to them.")} They approve or reject it in their portal.
            </DialogDescription>
            <div className="mt-4 flex items-center gap-2">
              <input readOnly value={result.link} className={cn(control, "font-mono text-[12px]")} onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={result.link} />
            </div>
            <div className="mt-5 flex justify-end">
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Send this variation?</DialogTitle>
            <DialogDescription>
              {clientName} gets a link to approve or reject it ({total < 0 ? "a credit of " : ""}
              {formatGBP(Math.abs(total))} inc. VAT). Once sent it can&apos;t be edited, only withdrawn or revised.
            </DialogDescription>
            <label className="mt-4 flex items-center gap-2">
              <input type="checkbox" checked={email && canEmail} disabled={!canEmail} onChange={(e) => setEmail(e.target.checked)} />
              <span className={canEmail ? undefined : "text-subtle"}>{canEmail ? `Email it to ${clientEmail}` : clientEmail ? "Email isn't set up yet" : `${clientName} has no email address`}</span>
            </label>
            {result && !result.ok && <p className="mt-3 text-danger">{result.message}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (!(await beforeSend())) return setResult({ ok: false, message: "Couldn't save the latest changes. Check the lines and try again." });
                    setResult(await onSend(email && canEmail));
                  })
                }
              >
                <Send />
                {pending ? "Sending…" : "Send variation"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
