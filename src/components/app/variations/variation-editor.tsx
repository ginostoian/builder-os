"use client";

import { StoredImage } from "@/components/stored-image";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Layers, Library, Plus, Send, Trash2, X } from "lucide-react";
import { removeVariationDraft, removeVariationPhotoAction, saveVariationDraft, sendVariationToClient, uploadVariationPhoto } from "@/app/app/variations/actions";
import { pickLines, searchLibrary, type LibraryPickOption } from "@/core/library-search";
import { shrinkPhoto } from "../shrink-photo";
import { CopyButton } from "@/components/app/quotes/send-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MAX_MARKUP_BPS, TEXT } from "@/core/limits";
import { formatBps, formatGBP, parsePence, parsePercentToBps } from "@/core/money";
import { qty as qtySchema } from "@/core/schemas";
import { MAX_VARIATION_LINES, MAX_VARIATION_PHOTOS, variationLineTotal, variationTotals, type VariationLine } from "@/core/variation";
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
  library,
  photos,
  storageEnabled,
}: {
  variation: { id: string; ref: string; title: string; reason: string | null; lines: VariationLine[]; vatRateBps: number; quoteId: string; quoteRef: string; quoteTitle: string };
  defaultMarkupBps: number;
  clientName: string;
  clientEmail: string | null;
  emailEnabled: boolean;
  library: LibraryPickOption[];
  photos: { key: string; url: string }[];
  storageEnabled: boolean;
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-visible">
      <div className="flex min-w-0 flex-1 flex-col bg-surface-2 lg:overflow-auto">
        <div className="flex flex-wrap items-start gap-4 border-b border-hairline bg-white px-4 pt-[18px] pb-3.5 lg:px-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Title" hint="What the client sees, e.g. Two extra double sockets in the kitchen." className="col-span-2">
              <input value={title} maxLength={TEXT.name} onChange={(e) => (setTitle(e.target.value), setDirty(true))} className={control} />
            </Field>
            <Field label="Why it's needed" hint="Optional. Shown to the client, e.g. what they asked for or what was found on site." className="col-span-2">
              <textarea value={reason} maxLength={TEXT.note} rows={3} onChange={(e) => (setReason(e.target.value), setDirty(true))} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
            </Field>
          </div>

          <div className="overflow-x-auto rounded-[10px] bg-white shadow-ring">
            <div className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_76px_72px_100px_76px_92px_104px_36px] items-center gap-2 border-b border-hairline bg-surface-2 px-3 py-2 text-[11.5px] font-medium text-subtle">
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
                <div key={r.id} className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_76px_72px_100px_76px_92px_104px_36px] items-center gap-2 border-b border-hairline px-3 py-1.5 last:border-b-0">
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
          <div className="flex flex-wrap items-center gap-2">
            <LibraryPicker
              library={library}
              disabled={rows.length >= MAX_VARIATION_LINES}
              onPick={(option) => {
                const picked = pickLines(option, defaultMarkupBps).map((l) => toRow({ id: crypto.randomUUID(), name: l.name, qty: l.qty, unit: l.unit, ratePence: l.ratePence, markupBps: l.markupBps, omit: false }));
                // Replace the empty starter line rather than leaving it behind.
                setRows((rs) => [...rs.filter((r) => r.name.trim() || r.rate.trim()), ...picked].slice(0, MAX_VARIATION_LINES));
                setDirty(true);
              }}
            />
            <Button variant="secondary" disabled={rows.length >= MAX_VARIATION_LINES} onClick={() => (setRows((rs) => [...rs, blankRow(defaultMarkupBps)]), setDirty(true))}>
              <Plus />
              Custom line
            </Button>
            <p className="ml-auto text-[12px] text-subtle">Rates are your cost before markup, like on quotes. The client only sees the price.</p>
          </div>

          <Photos variationId={variation.id} initial={photos} enabled={storageEnabled} />

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

      <aside className="flex w-full flex-none flex-col gap-4 overflow-auto border-t border-hairline bg-surface-2 p-[18px] lg:w-[296px] lg:border-t-0 lg:border-l">
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

/** Search the service library and add a service (or a bundle's services) as lines. */
function LibraryPicker({ library, disabled, onPick }: { library: LibraryPickOption[]; disabled: boolean; onPick: (o: LibraryPickOption) => void }) {
  const [text, setText] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(0);
  const listId = React.useId();
  const hits = React.useMemo(() => searchLibrary(library, text), [library, text]);
  const show = open && text.trim() !== "";
  const pick = (o: LibraryPickOption) => {
    onPick(o);
    setText("");
    setHighlighted(0);
  };
  return (
    <div className="relative w-[340px]">
      <Library className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
      <input
        value={text}
        disabled={disabled || library.length === 0}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(hits.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (hits[highlighted]) pick(hits[highlighted]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={library.length === 0 ? "Your service library is empty" : "Add from your service library…"}
        aria-label="Add from your service library"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        maxLength={TEXT.line}
        className={cn(control, "pl-8")}
      />
      {show && (
        <div id={listId} role="listbox" className="absolute top-[36px] left-0 z-20 w-[520px] rounded-[10px] bg-white p-1.5 shadow-pop">
          {hits.length === 0 ? (
            <div className="px-2 py-2 text-subtle">Nothing in your library matches. Use &ldquo;Custom line&rdquo; instead.</div>
          ) : (
            hits.map((o, i) => (
              <div
                key={o.id}
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-md p-2", i === highlighted && "bg-muted")}
              >
                {o.kind === "bundle" ? <Layers className="size-3.5 flex-none text-subtle" /> : <Library className="size-3.5 flex-none text-subtle" />}
                <span className="min-w-0 flex-1 truncate">
                  {o.name}
                  <span className="ml-2 text-xs text-subtle">{o.kind === "bundle" ? `Bundle · ${o.items.length} lines` : o.category}</span>
                </span>
                <span className="text-xs text-subtle">{o.unit}</span>
                <span className="w-[76px] text-right font-medium tabular">{formatGBP(o.ratePence)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Site photos on a draft: added and removed straight away (not part of "Save draft"). */
function Photos({ variationId, initial, enabled }: { variationId: string; initial: { key: string; url: string }[]; enabled: boolean }) {
  const [photos, setPhotos] = React.useState<{ key: string; url: string; preview?: string }[]>(initial);
  const [busy, setBusy] = React.useState(0);
  const [error, setError] = React.useState<string>();
  const input = React.useRef<HTMLInputElement>(null);

  const add = async (files: FileList) => {
    setError(undefined);
    const room = MAX_VARIATION_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(`A variation can have up to ${MAX_VARIATION_PHOTOS} photos.`);
    for (const file of list) {
      setBusy((n) => n + 1);
      try {
        let shrunk: Blob;
        try {
          shrunk = await shrinkPhoto(file);
        } catch {
          setError("That photo couldn't be read. Use a JPEG or PNG.");
          continue;
        }
        const form = new FormData();
        form.set("variationId", variationId);
        form.set("photo", new File([shrunk], "photo.jpg", { type: "image/jpeg" }));
        const r = await uploadVariationPhoto(form).catch(() => ({ ok: false as const, message: "The upload didn't go through. Check your connection and try again." }));
        // Show their own copy straight away: the CDN can take a few seconds to have the new photo.
        if (r.ok) setPhotos((p) => [...p, { key: r.key, url: r.url, preview: URL.createObjectURL(shrunk) }]);
        else setError(r.message);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13.5px] font-semibold">Photos</h2>
        <span className="text-[12px] text-subtle">
          {photos.length} of {MAX_VARIATION_PHOTOS} · shown to the client with the variation
        </span>
      </div>
      {!enabled ? (
        <p className="text-subtle">File storage isn&apos;t set up yet, so photos can&apos;t be added. See Settings → Company for the logo upload, which uses the same storage.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
          {photos.map((p) => (
            <div key={p.key} className="group relative aspect-square overflow-hidden rounded-[10px] bg-muted shadow-ring">
              <StoredImage src={p.url} preview={p.preview} alt="Site photo" className="size-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                title="Remove photo"
                onClick={async () => {
                  const r = await removeVariationPhotoAction(variationId, p.key);
                  if (r.ok) setPhotos((ps) => ps.filter((x) => x.key !== p.key));
                  else setError(r.message);
                }}
                className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-ink/70 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [&_svg]:size-3.5"
              >
                <X />
              </button>
            </div>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <div key={`busy-${i}`} className="grid aspect-square animate-pulse place-items-center rounded-[10px] bg-muted text-[12px] text-subtle">
              Uploading…
            </div>
          ))}
          {photos.length + busy < MAX_VARIATION_PHOTOS && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-faint text-ink-2 hover:bg-white hover:text-ink"
            >
              <span className="flex flex-col items-center gap-1.5 text-[12.5px]">
                <Camera className="size-5" />
                Add photos
              </span>
            </button>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void add(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
