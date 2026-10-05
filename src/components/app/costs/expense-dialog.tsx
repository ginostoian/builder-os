"use client";

import { StoredImage } from "@/components/stored-image";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
import { deleteExpenseAction, removeReceiptAction, saveExpenseAction, setRecoveredAction, uploadReceiptAction } from "@/app/app/purchases/actions";
import { shrinkPhoto } from "@/components/app/shrink-photo";
import { useReceiptReader } from "@/components/receipt-reader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, MAX_RECEIPTS, poRef, vatInGross, type ExpenseCategory } from "@/core/costs";
import { TEXT } from "@/core/limits";
import { formatGBP, parsePence } from "@/core/money";
import { invoiceRef, ukToday } from "@/core/payment-plan";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import type { Expense, PoOption, ProjectOption } from "./types";
import { useCis } from "./cis-context";
import { cisDeduction } from "@/core/cis";

/** What a new expense starts with (e.g. "record the bill" on an order fills in the supplier and amount). */
export type ExpenseDraft = Partial<Pick<Expense, "projectId" | "purchaseOrderId" | "supplier" | "description" | "totalPence" | "vatPence" | "category" | "rechargeable">>;

const pounds = (p: number | null | undefined) => (p == null ? "" : (p / 100).toFixed(2));

/**
 * Add or change an expense: what it was, the total off the receipt (and the VAT part), receipts, and
 * whether it was bought for the client (billed back to them, so not the company's cost).
 */
export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  draft,
  projects,
  orders,
  fixedProject,
  storageEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
  draft?: ExpenseDraft;
  projects: ProjectOption[];
  orders: PoOption[];
  /** On a project's own page the project is fixed. */
  fixedProject?: string;
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const start = expense ?? draft ?? {};
  const [v, setV] = React.useState(() => ({
    projectId: start.projectId ?? fixedProject ?? projects[0]?.id ?? "",
    purchaseOrderId: start.purchaseOrderId ?? "",
    category: (start.category ?? "materials") as ExpenseCategory,
    supplier: start.supplier ?? "",
    description: start.description ?? "",
    spentOn: expense?.spentOn ?? ukToday(),
    total: pounds(start.totalPence),
    vat: pounds(start.vatPence ?? 0),
    rechargeable: start.rechargeable ?? false,
    markup: expense ? String(expense.rechargeMarkupBps / 100) : "0",
  }));
  const cisList = useCis();
  const [cis, setCis] = React.useState({ workerId: expense?.cis?.workerId ?? "", materials: pounds(expense?.cis?.materialsPence ?? 0) });
  const [files, setFiles] = React.useState<File[]>([]);
  // The first receipt fills in whatever hasn't been typed yet.
  const reader = useReceiptReader((r) =>
    setV((x) => ({
      ...x,
      supplier: x.supplier.trim() ? x.supplier : (r.supplier ?? ""),
      description: x.description.trim() ? x.description : (r.description ?? ""),
      spentOn: !expense && r.spentOn && r.spentOn <= ukToday() ? r.spentOn : x.spentOn,
      total: x.total.trim() || r.totalPence === null ? x.total : pounds(r.totalPence),
      vat: (x.vat.trim() && parsePence(x.vat) !== 0) || r.vatPence === null ? x.vat : pounds(r.vatPence),
      category: !expense && !draft?.category && r.category ? r.category : x.category,
    })),
  );
  const [receipts, setReceipts] = React.useState(expense?.receipts ?? []);
  const [error, setError] = React.useState<string>();
  const [progress, setProgress] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const locked = expense?.billed ?? false;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const projectOrders = orders.filter((o) => o.projectId === v.projectId);
  const total = parsePence(v.total);
  const vat = v.vat.trim() ? parsePence(v.vat) : 0;
  const room = MAX_RECEIPTS - receipts.length - files.length;
  // CIS: only for subcontractor payments, when the company uses it.
  const cisOn = cisList !== null && v.category === "subcontractor";
  const cisSub = cisOn ? cisList.find((c) => c.id === cis.workerId) : undefined;
  const cisRate = cisSub ? (expense?.cis?.workerId === cisSub.id ? expense.cis.rateBps : cisSub.rateBps) : null;
  const materials = cis.materials.trim() ? parsePence(cis.materials) : 0;
  const net = total !== null && vat !== null ? total - vat : null;
  const deduction = cisRate !== null && net !== null && materials !== null ? cisDeduction(net, materials, cisRate) : null;

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      if (total === null) return setError("Enter the total from the receipt.");
      if (vat === null || vat > total) return setError("Check the VAT: it can't be more than the total.");
      if (cisSub && (materials === null || (net !== null && materials > net))) return setError("Check the materials: they can't be more than the amount before VAT.");
      const markup = Math.round(Number(v.markup || "0") * 100);
      if (!Number.isFinite(markup) || markup < 0) return setError("Check the markup.");
      const r = await saveExpenseAction(expense?.id ?? null, {
        projectId: v.projectId,
        purchaseOrderId: v.purchaseOrderId || undefined,
        category: v.category,
        supplier: v.supplier.trim() || undefined,
        description: v.description.trim(),
        spentOn: v.spentOn,
        totalPence: total,
        vatPence: vat,
        rechargeable: v.rechargeable,
        rechargeMarkupBps: v.rechargeable ? markup : 0,
        cis: cisSub && materials !== null ? { workerId: cisSub.id, materialsPence: materials } : undefined,
      });
      if (!r.ok || !r.id) return setError(r.ok ? "Couldn't save that." : r.message);
      let failed = "";
      for (const [i, f] of files.entries()) {
        setProgress(`Uploading receipt ${i + 1} of ${files.length}…`);
        try {
          const form = new FormData();
          form.set("expenseId", r.id);
          form.set("file", f.type === "application/pdf" ? f : new File([await shrinkPhoto(f)], "receipt.jpg", { type: "image/jpeg" }));
          const u = await uploadReceiptAction(form);
          if (!u.ok) failed = u.message;
        } catch {
          failed = "A receipt couldn't be read. Try a photo or a PDF.";
        }
      }
      setProgress(undefined);
      router.refresh();
      if (failed) {
        setFiles([]);
        return setError(`Saved, but a receipt didn't upload: ${failed}`);
      }
      onOpenChange(false);
    });

  const remove = () =>
    startTransition(async () => {
      if (!expense || !window.confirm("Delete this expense and its receipts?")) return;
      const r = await deleteExpenseAction(expense.id);
      if (!r.ok) return setError(r.message);
      router.refresh();
      onOpenChange(false);
    });

  const recovered = () =>
    startTransition(async () => {
      if (!expense) return;
      const r = await setRecoveredAction(expense.id, !expense.recoveredOn);
      if (!r.ok) return setError(r.message);
      router.refresh();
      onOpenChange(false);
    });

  const dropReceipt = (key: string) =>
    startTransition(async () => {
      if (!expense) return;
      const r = await removeReceiptAction(expense.id, key);
      if (!r.ok) return setError(r.message);
      setReceipts((x) => x.filter((y) => y.key !== key));
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <DialogTitle>{expense ? "Expense" : "Add an expense"}</DialogTitle>
        <DialogDescription>A receipt, a supplier&apos;s bill or a subcontractor&apos;s invoice for this job.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {locked && expense?.invoiceNumber && (
            <p className="rounded-lg bg-info-soft px-3 py-2 text-[12.5px] text-info">
              Billed to the client on {invoiceRef(expense.invoiceNumber)}. Cancel that invoice to change the amounts.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="What for" required className="sm:col-span-2">
              <input value={v.description} onChange={set("description")} maxLength={TEXT.line} required placeholder="e.g. Plasterboard and screws" className={control} autoFocus={!expense} />
            </Field>
            {!fixedProject && (
              <Field label="Project" className="sm:col-span-2">
                <select value={v.projectId} onChange={(e) => setV((x) => ({ ...x, projectId: e.target.value, purchaseOrderId: "" }))} disabled={locked} className={control}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Supplier">
              <input value={v.supplier} onChange={set("supplier")} maxLength={TEXT.name} placeholder="e.g. Travis Perkins" className={control} />
            </Field>
            <Field label="Type">
              <select value={v.category} onChange={set("category")} className={control}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={v.spentOn} onChange={set("spentOn")} required className={control} />
            </Field>
            {projectOrders.length > 0 ? (
              <Field label="Purchase order">
                <select value={v.purchaseOrderId} onChange={set("purchaseOrderId")} className={control}>
                  <option value="">None</option>
                  {projectOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {poRef(o.number)} · {o.supplierName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div />
            )}
            <Field label="Total paid" required hint="As on the receipt, including any VAT.">
              <Money value={v.total} onChange={set("total")} disabled={locked} />
            </Field>
            <Field label="VAT included">
              <Money value={v.vat} onChange={set("vat")} disabled={locked} />
              <span className="flex gap-1.5">
                <button type="button" disabled={locked || total === null} onClick={() => total !== null && setV((x) => ({ ...x, vat: pounds(vatInGross(total, 2000)) }))} className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] text-ink-2 hover:bg-muted disabled:opacity-50">
                  20% VAT
                </button>
                <button type="button" disabled={locked} onClick={() => setV((x) => ({ ...x, vat: "0.00" }))} className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] text-ink-2 hover:bg-muted disabled:opacity-50">
                  No VAT
                </button>
              </span>
            </Field>
          </div>

          {cisOn && (
            <div className="flex flex-col gap-3 rounded-[10px] bg-surface px-3.5 py-3">
              <div>
                <div className="font-medium">CIS</div>
                <p className="text-[12.5px] text-ink-2">Choose the subcontractor and the materials on their invoice. The deduction is worked out from their status; you pay them the rest and pay the deduction to HMRC.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Subcontractor">
                  <select value={cis.workerId} onChange={(e) => setCis((x) => ({ ...x, workerId: e.target.value }))} disabled={locked} className={control}>
                    <option value="">Not a CIS payment</option>
                    {cisList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.rateBps / 100}%)
                      </option>
                    ))}
                  </select>
                </Field>
                {cisSub && (
                  <Field label="Materials (before VAT)" hint="Not taxed under CIS.">
                    <Money value={cis.materials} onChange={(e) => setCis((x) => ({ ...x, materials: e.target.value }))} disabled={locked} />
                  </Field>
                )}
              </div>
              {cisSub && deduction !== null && net !== null && total !== null && (
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[12.5px] tabular">
                  <dt className="text-ink-2">Labour (before VAT, less materials)</dt>
                  <dd className="text-right">{formatGBP(Math.max(0, net - (materials ?? 0)))}</dd>
                  <dt className="text-ink-2">Deduction at {(cisRate ?? 0) / 100}%</dt>
                  <dd className="text-right">−{formatGBP(deduction)}</dd>
                  <dt className="font-medium">Pay {cisSub.name}</dt>
                  <dd className="text-right font-medium">{formatGBP(total - deduction)}</dd>
                </dl>
              )}
            </div>
          )}

          <div className={cn("rounded-[10px] px-3.5 py-3", v.rechargeable ? "bg-warning-soft/60" : "bg-surface")}>
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={v.rechargeable} disabled={locked} onChange={(e) => setV((x) => ({ ...x, rechargeable: e.target.checked }))} className="mt-0.5" />
              <span>
                <span className="font-medium">Bought for the client</span>
                <span className="block text-[12.5px] text-ink-2">On their behalf, to be paid back: it&apos;s billed to them instead of counting as your cost.</span>
              </span>
            </label>
            {v.rechargeable && (
              <div className="mt-2.5 flex items-center gap-2 pl-6 text-[12.5px]">
                <span>Add a handling charge of</span>
                <input value={v.markup} onChange={set("markup")} disabled={locked} inputMode="decimal" className={cn(control, "w-16 text-right tabular")} aria-label="Handling charge percent" />
                <span>%</span>
                {expense?.rechargeable && !locked && (
                  <button type="button" onClick={recovered} disabled={pending} className="ml-auto text-ink-2 underline underline-offset-2 hover:text-ink">
                    {expense.recoveredOn ? "Not paid back after all" : "Mark as paid back"}
                  </button>
                )}
              </div>
            )}
            {v.rechargeable && !locked && (
              <p className="mt-1.5 pl-6 text-[12px] text-ink-2">
                {expense?.recoveredOn ? "Marked as paid back, so it won't be invoiced." : "Bill it from the quote's payment schedule: on its own, or added to the next payment's invoice."}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[12.5px] font-medium">Receipts</div>
            <div className="flex flex-wrap gap-2">
              {receipts.map((r) => (
                <ReceiptThumb key={r.key} url={r.url} pdf={r.contentType === "application/pdf"} onRemove={() => dropReceipt(r.key)} disabled={pending} />
              ))}
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex h-16 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[12px] text-ink-2">
                  <Paperclip className="size-3.5" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" aria-label="Remove" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-subtle hover:text-ink">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              {storageEnabled && room > 0 && (
                <label className="flex h-16 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-faint px-3 text-[12.5px] text-ink-2 hover:bg-surface">
                  <Paperclip className="size-3.5" />
                  Add photo or PDF
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const picked = [...(e.target.files ?? [])].slice(0, room);
                      if (!locked && picked[0] && files.length === 0 && receipts.length === 0) void reader.read(picked[0]);
                      setFiles((x) => [...x, ...picked]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {(reader.reading || reader.note) && <p className="mt-1 text-[12px] text-ink-2">{reader.reading ? "Reading the receipt…" : reader.note}</p>}
            {!storageEnabled && <p className="mt-1 text-[12px] text-subtle">File storage isn&apos;t set up, so receipts can&apos;t be attached yet.</p>}
          </div>

          {error && <p className="text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            {expense && !locked && (
              <Button type="button" variant="ghost" onClick={remove} disabled={pending}>
                <Trash2 />
                Delete
              </Button>
            )}
            <span className="flex-1 text-[12px] text-subtle">{progress}</span>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !v.description.trim() || !v.projectId}>
              {pending ? "Saving…" : expense ? "Save" : `Add${total ? ` ${formatGBP(total)}` : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Money({ value, onChange, disabled }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; disabled?: boolean }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle">£</span>
      <input value={value} onChange={onChange} disabled={disabled} inputMode="decimal" className={cn(control, "pl-6 tabular")} />
    </span>
  );
}

export function ReceiptThumb({ url, pdf, onRemove, disabled }: { url: string; pdf: boolean; onRemove?: () => void; disabled?: boolean }) {
  return (
    <span className="group relative">
      <a href={url} target="_blank" rel="noreferrer" className="flex size-16 items-center justify-center overflow-hidden rounded-lg bg-surface shadow-ring" title="Open receipt">
        {pdf ? (
          <FileText className="size-6 text-subtle" />
        ) : (
          <StoredImage src={url} alt="Receipt" className="size-full object-cover" />
        )}
      </a>
      {onRemove && (
        <button type="button" onClick={onRemove} disabled={disabled} aria-label="Remove receipt" className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full bg-ink text-white group-hover:flex">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
