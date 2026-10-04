"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Plus, Printer, Receipt, Trash2, X } from "lucide-react";
import { deletePurchaseOrderAction, emailPurchaseOrderAction, savePurchaseOrderAction, setPurchaseOrderStatusAction } from "@/app/app/purchases/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PO_STATUS_LABEL, poLineTotal, poRef, poTotals, type PoLine, type PoStatus } from "@/core/costs";
import { TEXT } from "@/core/limits";
import { formatGBP, parsePence } from "@/core/money";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import { shortDay } from "../projects/types";
import { ExpenseDialog } from "./expense-dialog";
import { PO_TONE, type PoOption, type ProjectOption } from "./types";

type Row = { id: string; description: string; qty: string; unit: string; price: string };

const toRow = (l: PoLine): Row => ({ id: l.id, description: l.description, qty: String(l.qty), unit: l.unit, price: (l.unitPricePence / 100).toFixed(2) });
const blank = (): Row => ({ id: crypto.randomUUID(), description: "", qty: "1", unit: "item", price: "" });

export type PoEditorValues = {
  id: string | null;
  number: number | null;
  status: PoStatus;
  projectId: string;
  supplierName: string;
  supplierEmail: string | null;
  neededBy: string | null;
  deliveryNotes: string | null;
  vatRateBps: number;
  lines: PoLine[];
  orderedOn: string | null;
};

/**
 * A purchase order: who from, what, how many, at what price, where and when to deliver. Save it as a draft,
 * email it to the supplier (or print it), track it to delivered, and record the supplier's bill against it.
 */
export function PoEditor({
  initial,
  projects,
  canEdit,
  emailEnabled,
  storageEnabled,
  bills,
}: {
  initial: PoEditorValues;
  projects: ProjectOption[];
  canEdit: boolean;
  emailEnabled: boolean;
  storageEnabled: boolean;
  bills: { id: string; description: string; spentOn: string; totalPence: number }[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState({
    projectId: initial.projectId,
    supplierName: initial.supplierName,
    supplierEmail: initial.supplierEmail ?? "",
    neededBy: initial.neededBy ?? "",
    deliveryNotes: initial.deliveryNotes ?? "",
    vatRateBps: initial.vatRateBps,
  });
  const [rows, setRows] = React.useState<Row[]>(() => (initial.lines.length ? initial.lines.map(toRow) : [blank()]));
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [billOpen, setBillOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const editable = canEdit && initial.status !== "cancelled";
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: k === "vatRateBps" ? Number(e.target.value) : e.target.value }));
  const setRow = (i: number, k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));

  const parsed = rows
    .filter((r) => r.description.trim())
    .map((r) => ({ id: r.id, description: r.description.trim(), qty: Number(r.qty), unit: r.unit.trim() || "item", unitPricePence: r.price.trim() ? (parsePence(r.price) ?? -1) : 0 }));
  const totals = poTotals(parsed.filter((l) => l.unitPricePence >= 0 && l.qty > 0), v.vatRateBps);
  const ref = initial.number ? poRef(initial.number) : "New purchase order";

  const save = (after?: (id: string) => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setMessage(undefined);
      if (parsed.some((l) => !(l.qty > 0) || l.unitPricePence < 0)) return setMessage({ ok: false, text: "Check the quantities and prices." });
      const r = await savePurchaseOrderAction(initial.id, {
        projectId: v.projectId,
        supplierName: v.supplierName.trim(),
        supplierEmail: v.supplierEmail.trim().toLowerCase() || undefined,
        neededBy: v.neededBy || undefined,
        deliveryNotes: v.deliveryNotes.trim() || undefined,
        vatRateBps: v.vatRateBps,
        lines: parsed,
      });
      if (!r.ok || !r.id) return setMessage({ ok: false, text: r.ok ? "Couldn't save." : r.message });
      if (after) {
        const a = await after(r.id);
        if (!a.ok) {
          setMessage({ ok: false, text: a.message ?? "That didn't work." });
          return initial.id ? router.refresh() : router.replace(`/app/purchases/orders/${r.id}`);
        }
      }
      if (!initial.id) return router.replace(`/app/purchases/orders/${r.id}`);
      setMessage({ ok: true, text: "Saved" });
      router.refresh();
    });

  const status = (s: PoStatus) =>
    startTransition(async () => {
      const r = await setPurchaseOrderStatusAction(initial.id!, s);
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!window.confirm("Delete this draft order?")) return;
      const r = await deletePurchaseOrderAction(initial.id!);
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      router.push(`/app/projects/${initial.projectId}?view=costs`);
    });

  const order: PoOption | null = initial.id && initial.number ? { id: initial.id, number: initial.number, projectId: initial.projectId, supplierName: initial.supplierName, netPence: totals.net, vatRateBps: v.vatRateBps } : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{ref}</h1>
        {initial.id && <Badge tone={PO_TONE[initial.status]}>{PO_STATUS_LABEL[initial.status]}</Badge>}
        {initial.orderedOn && <span className="text-[12.5px] text-subtle">Ordered {shortDay(initial.orderedOn)}</span>}
        <span className="flex-1" />
        {initial.id && (
          <Button asChild variant="ghost">
            <Link href={`/app/purchases/orders/${initial.id}/print`} target="_blank">
              <Printer />
              Print
            </Link>
          </Button>
        )}
        {editable && initial.id && initial.status === "draft" && (
          <Button variant="ghost" onClick={remove} disabled={pending}>
            <Trash2 />
            Delete
          </Button>
        )}
        {editable && initial.id && initial.status !== "draft" && (
          <Button variant="ghost" onClick={() => window.confirm("Cancel this order? It stays on record.") && status("cancelled")} disabled={pending}>
            Cancel order
          </Button>
        )}
        {canEdit && initial.status === "cancelled" && (
          <Button variant="secondary" onClick={() => status("draft")} disabled={pending}>
            Back to draft
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <section className="rounded-[12px] bg-white p-5 shadow-ring">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Supplier" required>
                <input value={v.supplierName} onChange={set("supplierName")} maxLength={TEXT.name} disabled={!editable} placeholder="e.g. Travis Perkins, Leyton" className={control} />
              </Field>
              <Field label="Supplier's email" hint="To email them the order.">
                <input value={v.supplierEmail} onChange={set("supplierEmail")} maxLength={TEXT.email} disabled={!editable} inputMode="email" className={control} />
              </Field>
              <Field label="Project">
                <select value={v.projectId} onChange={set("projectId")} disabled={!editable || Boolean(initial.id)} className={control}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Needed by">
                <input type="date" value={v.neededBy} onChange={set("neededBy")} disabled={!editable} className={control} />
              </Field>
              <Field label="Delivery notes" className="col-span-2" hint="Goes on the order with the site address, e.g. access, timing, who to call.">
                <textarea value={v.deliveryNotes} onChange={set("deliveryNotes")} maxLength={TEXT.note} rows={2} disabled={!editable} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
              </Field>
            </div>
          </section>

          <section className="overflow-hidden rounded-[12px] bg-white shadow-ring">
            <table className="w-full">
              <thead className="border-b border-hairline text-left text-[12px] text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="w-[80px] px-2 py-2 text-right font-medium">Qty</th>
                  <th className="w-[90px] px-2 py-2 font-medium">Unit</th>
                  <th className="w-[110px] px-2 py-2 text-right font-medium">Unit price</th>
                  <th className="w-[100px] px-2 py-2 text-right font-medium">Total</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = r.price.trim() ? parsePence(r.price) : 0;
                  const q = Number(r.qty);
                  return (
                    <tr key={r.id} className="border-b border-muted">
                      <td className="px-3 py-1.5">
                        <input value={r.description} onChange={setRow(i, "description")} disabled={!editable} maxLength={TEXT.line} placeholder="e.g. 12.5mm plasterboard 2400×1200" aria-label="Item" className={control} />
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={r.qty} onChange={setRow(i, "qty")} disabled={!editable} inputMode="decimal" aria-label="Quantity" className={cn(control, "text-right tabular")} />
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={r.unit} onChange={setRow(i, "unit")} disabled={!editable} maxLength={TEXT.short} aria-label="Unit" className={control} />
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={r.price} onChange={setRow(i, "price")} disabled={!editable} inputMode="decimal" placeholder="0.00" aria-label="Unit price" className={cn(control, "text-right tabular")} />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular">{p !== null && q > 0 ? formatGBP(poLineTotal({ qty: q, unitPricePence: p })) : "–"}</td>
                      <td className="pr-2">
                        {editable && rows.length > 1 && (
                          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Remove line" className="rounded p-1 text-subtle hover:bg-accent hover:text-ink">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {editable && (
              <button type="button" onClick={() => setRows((x) => [...x, blank()])} className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-ink-2 hover:bg-surface-2 hover:text-ink">
                <Plus className="size-3.5" />
                Add a line
              </button>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-[12px] bg-white p-5 shadow-ring">
            <dl className="flex flex-col gap-1.5 tabular">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd>{formatGBP(totals.net)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">
                  VAT{" "}
                  <select value={v.vatRateBps} onChange={set("vatRateBps")} disabled={!editable} aria-label="VAT rate" className="ml-1 rounded bg-surface px-1 text-[12px]">
                    <option value={2000}>20%</option>
                    <option value={500}>5%</option>
                    <option value={0}>None</option>
                  </select>
                </dt>
                <dd>{formatGBP(totals.vat)}</dd>
              </div>
              <div className="my-1 h-px bg-hairline" />
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd>{formatGBP(totals.total)}</dd>
              </div>
            </dl>
            {editable && (
              <div className="mt-4 flex flex-col gap-2">
                <Button onClick={() => save()} disabled={pending || !v.supplierName.trim()}>
                  {pending ? "Saving…" : initial.id ? "Save changes" : "Save as draft"}
                </Button>
                {initial.status === "draft" && (
                  <>
                    <Button variant="secondary" onClick={() => save((id) => emailPurchaseOrderAction(id))} disabled={pending || !emailEnabled || !v.supplierEmail.trim() || parsed.length === 0 || !v.supplierName.trim()}>
                      <Mail />
                      Email to supplier
                    </Button>
                    <Button variant="ghost" onClick={() => save((id) => setPurchaseOrderStatusAction(id, "ordered"))} disabled={pending || !v.supplierName.trim()}>
                      Ordered another way
                    </Button>
                    {!emailEnabled && <p className="text-[12px] text-subtle">Email isn&apos;t set up, so print the order or phone it through.</p>}
                  </>
                )}
                {initial.status === "ordered" && (
                  <Button variant="secondary" onClick={() => status("delivered")} disabled={pending}>
                    Mark as delivered
                  </Button>
                )}
              </div>
            )}
            {message && <p className={cn("mt-2 text-[12.5px]", message.ok ? "text-success" : "text-danger")}>{message.text}</p>}
          </section>

          {initial.id && initial.status !== "draft" && (
            <section className="rounded-[12px] bg-white p-5 shadow-ring">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <Receipt className="size-4 text-ink-2" />
                Supplier&apos;s bill
              </h2>
              {bills.length === 0 ? (
                <p className="text-[12.5px] text-subtle">When their invoice comes in, record it here. It goes into the job&apos;s costs.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-[12.5px]">
                  {bills.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {shortDay(b.spentOn)} · {b.description}
                      </span>
                      <span className="tabular">{formatGBP(b.totalPence)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && order && (
                <Button variant="secondary" className="mt-3 w-full" onClick={() => setBillOpen(true)}>
                  Record the bill
                </Button>
              )}
            </section>
          )}
        </aside>
      </div>
      {billOpen && order && (
        <ExpenseDialog
          open
          onOpenChange={setBillOpen}
          draft={{ projectId: initial.projectId, purchaseOrderId: initial.id!, supplier: initial.supplierName, description: `${ref}: ${initial.lines.map((l) => l.description).slice(0, 2).join(", ")}${initial.lines.length > 2 ? "…" : ""}`.slice(0, 300), totalPence: totals.total, vatPence: totals.vat, category: "materials" }}
          projects={projects}
          orders={[order]}
          fixedProject={initial.projectId}
          storageEnabled={storageEnabled}
        />
      )}
    </div>
  );
}
