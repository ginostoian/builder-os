"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Lock, Plus, X } from "lucide-react";
import { saveBundle, saveService, type ServiceFormState } from "@/app/app/library/actions";
import { Button } from "@/components/ui/button";
import { MAX_BUNDLE_ITEMS, TEXT } from "@/core/limits";
import { formatBps, formatGBP, parsePence, parsePercentToBps } from "@/core/money";
import { lineTotal } from "@/core/quote";
import { DEFAULT_CATEGORIES, UNIT_SUGGESTIONS, bundleRate, type ServiceField } from "@/core/services";
import { cn } from "@/lib/utils";
import { Panel } from "../app-shell";
import { Field, SectionHeading, control } from "../form-fields";

type Common = { category: string; name: string; description: string; unit: string; markup: string };

export type ServiceValues = { category: string; name: string; description: string | null; unit: string; ratePence: number; defaultMarkupBps: number | null };
export type BundleValues = Omit<ServiceValues, "ratePence"> & { items: { serviceId: string; qty: number }[] };
export type BundleCandidate = { id: string; category: string; name: string; unit: string; ratePence: number };

/** React keys for bundle rows. Only needs to be unique within the page. */
let nextRowKey = 0;
const row = (serviceId = "", qty = "1") => ({ key: nextRowKey++, serviceId, qty });

const bpsText = (bps: number | null | undefined) => (bps === null || bps === undefined ? "" : String(Number((bps / 100).toFixed(2))));
const penceText = (pence: number) => (pence / 100).toFixed(2);

const toCommon = (v: Omit<ServiceValues, "ratePence"> | undefined, fallbackUnit = ""): Common => ({
  category: v?.category ?? "",
  name: v?.name ?? "",
  description: v?.description ?? "",
  unit: v?.unit ?? fallbackUnit,
  markup: bpsText(v?.defaultMarkupBps),
});

/** Shared submit plumbing: controlled values, onSubmit (so an error doesn't reset the form), status line. */
function useSave(save: (form: FormData) => Promise<ServiceFormState>) {
  const [state, setState] = React.useState<ServiceFormState>({ status: "idle" });
  const [pending, startTransition] = React.useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => setState(await save(form)));
  };
  const error = (field: ServiceField) => (state.status === "error" ? state.errors?.[field] : undefined);
  const touched = () => state.status === "saved" && setState({ status: "idle" });
  return { state, pending, submit, error, touched };
}

/** A service: one priced line, e.g. "Plaster skim, walls — £14.50 / m²". */
export function ServiceForm({
  serviceId,
  initial,
  canEdit,
  categories,
  companyMarkupBps,
}: {
  serviceId?: string;
  initial?: ServiceValues;
  canEdit: boolean;
  categories: string[];
  companyMarkupBps: number;
}) {
  const { state, pending, submit, error, touched } = useSave((form) => saveService(serviceId ?? null, form));
  const [common, setCommon] = React.useState(() => toCommon(initial));
  const [rate, setRate] = React.useState(serviceId && initial ? penceText(initial.ratePence) : "");
  const ratePence = parsePence(rate);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <ReadOnlyNote show={!canEdit} />
      <fieldset disabled={!canEdit || pending} className="contents">
        <CommonFields values={common} onChange={(v) => (setCommon(v), touched())} error={error} categories={categories} isNew={!serviceId} companyMarkupBps={companyMarkupBps}>
          <Field label="Rate" hint="Your price per unit before markup." error={error("rate")} required>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle">£</span>
              <input name="rate" inputMode="decimal" value={rate} onChange={(e) => (setRate(e.target.value), touched())} className={cn(control, "pl-6 tabular")} />
            </div>
          </Field>
        </CommonFields>
        <QuotesAt ratePence={ratePence} markup={common.markup} unit={common.unit} companyMarkupBps={companyMarkupBps} />
      </fieldset>
      <Actions canEdit={canEdit} pending={pending} state={state} isNew={!serviceId} newLabel="Add service" />
    </form>
  );
}

/** A bundle: several services added to a quote together. Its price is the sum of its items. */
export function BundleForm({
  bundleId,
  initial,
  canEdit,
  categories,
  candidates,
  companyMarkupBps,
}: {
  bundleId?: string;
  initial?: BundleValues;
  canEdit: boolean;
  categories: string[];
  candidates: BundleCandidate[];
  companyMarkupBps: number;
}) {
  const { state, pending, submit, error, touched } = useSave((form) => saveBundle(bundleId ?? null, form));
  const [common, setCommon] = React.useState(() => toCommon(initial, "job"));
  const [rows, setRows] = React.useState(() => (initial?.items.length ? initial.items.map((i) => row(i.serviceId, String(i.qty))) : [row()]));
  const byId = React.useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const grouped = React.useMemo(() => {
    const groups = new Map<string, BundleCandidate[]>();
    for (const c of candidates) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
    return [...groups];
  }, [candidates]);

  const update = (key: number, patch: Partial<{ serviceId: string; qty: string }>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touched();
  };
  const priced = rows.flatMap((r) => {
    const c = byId.get(r.serviceId);
    const qty = Number(r.qty);
    return c && qty > 0 ? [{ qty, ratePence: c.ratePence }] : [];
  });
  const total = bundleRate(priced);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <ReadOnlyNote show={!canEdit} />
      <fieldset disabled={!canEdit || pending} className="contents">
        <CommonFields values={common} onChange={(v) => (setCommon(v), touched())} error={error} categories={categories} isNew={!bundleId} companyMarkupBps={companyMarkupBps} />

        <Panel className="flex flex-col gap-3 p-5">
          <SectionHeading title="Services in this bundle" hint="Added to a quote together. Change the quantities on the quote if a job is bigger or smaller." />
          {candidates.length === 0 ? (
            <p className="text-ink-2">
              Add some services first, then group them into a bundle.{" "}
              <Link href="/app/library/new" className="underline underline-offset-2">
                Add a service
              </Link>
            </p>
          ) : (
            <>
              <table className="w-full table-fixed text-left">
                <thead className="text-[12px] text-subtle">
                  <tr>
                    <th className="pb-1.5 font-medium">Service</th>
                    <th className="w-[110px] pb-1.5 font-medium">Quantity</th>
                    <th className="w-[110px] pb-1.5 text-right font-medium">Cost</th>
                    <th className="w-9" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = byId.get(r.serviceId);
                    const qty = Number(r.qty);
                    return (
                      <tr key={r.key}>
                        <td className="py-1 pr-2">
                          <select
                            name="itemServiceId"
                            value={r.serviceId}
                            onChange={(e) => update(r.key, { serviceId: e.target.value })}
                            aria-label="Service"
                            className={control}
                          >
                            <option value="">Choose a service…</option>
                            {grouped.map(([category, list]) => (
                              <optgroup key={category} label={category}>
                                {list.map((s) => (
                                  <option key={s.id} value={s.id} disabled={s.id !== r.serviceId && rows.some((o) => o.serviceId === s.id)}>
                                    {s.name} · {formatGBP(s.ratePence)} / {s.unit}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <div className="relative">
                            <input
                              name="itemQty"
                              inputMode="decimal"
                              value={r.qty}
                              onChange={(e) => update(r.key, { qty: e.target.value })}
                              aria-label="Quantity"
                              className={cn(control, "tabular", c && "pr-10")}
                            />
                            {c && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 truncate text-[12px] text-subtle">{c.unit}</span>}
                          </div>
                        </td>
                        <td className="py-1 text-right tabular text-ink-2">{c && qty > 0 ? formatGBP(bundleRate([{ qty, ratePence: c.ratePence }])) : "–"}</td>
                        <td className="py-1 pl-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove service"
                            disabled={rows.length === 1}
                            onClick={() => (setRows((rs) => rs.filter((o) => o.key !== r.key)), touched())}
                          >
                            <X />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-hairline">
                    <td className="pt-2.5 font-medium" colSpan={2}>
                      Bundle price
                    </td>
                    <td className="pt-2.5 text-right font-semibold tabular">{formatGBP(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              {error("items") && <p className="text-[12px] text-danger">{error("items")}</p>}
              <div>
                <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, row()])} disabled={rows.length >= MAX_BUNDLE_ITEMS}>
                  <Plus />
                  Add service
                </Button>
              </div>
            </>
          )}
        </Panel>
        <QuotesAt ratePence={total} markup={common.markup} unit={common.unit} companyMarkupBps={companyMarkupBps} />
      </fieldset>
      <Actions canEdit={canEdit} pending={pending} state={state} isNew={!bundleId} newLabel="Add bundle" />
    </form>
  );
}

function CommonFields({
  values,
  onChange,
  error,
  categories,
  isNew,
  companyMarkupBps,
  children,
}: {
  values: Common;
  onChange: (v: Common) => void;
  error: (f: ServiceField) => string | undefined;
  categories: string[];
  isNew: boolean;
  companyMarkupBps: number;
  children?: React.ReactNode;
}) {
  const set = (key: keyof Common) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...values, [key]: e.target.value });
  const suggestions = [...new Set([...categories, ...DEFAULT_CATEGORIES])].sort((a, b) => a.localeCompare(b));
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" error={error("name")} required className="sm:col-span-2">
          <input name="name" value={values.name} onChange={set("name")} maxLength={TEXT.line} autoFocus={isNew} autoComplete="off" className={control} />
        </Field>
        <Field label="Category" hint="Pick one or type a new one." error={error("category")} required>
          <input name="category" list="library-categories" value={values.category} onChange={set("category")} maxLength={TEXT.short} autoComplete="off" className={control} />
          <datalist id="library-categories">
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Unit" hint="How it's measured, e.g. m², item or job." error={error("unit")} required>
          <input name="unit" list="library-units" value={values.unit} onChange={set("unit")} maxLength={TEXT.short} autoComplete="off" className={control} />
          <datalist id="library-units">
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        {children}
        <Field label="Markup" hint={`Leave blank to use your company default (${formatBps(companyMarkupBps)}).`} error={error("markup")}>
          <div className="relative">
            <input name="markup" inputMode="decimal" value={values.markup} onChange={set("markup")} placeholder={bpsText(companyMarkupBps)} className={cn(control, "pr-7 tabular")} />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle">%</span>
          </div>
        </Field>
        <Field label="Description" hint="Shown to the client under the line on a quote." error={error("description")} className="sm:col-span-2">
          <textarea name="description" value={values.description} onChange={set("description")} maxLength={TEXT.description} rows={3} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
        </Field>
      </div>
    </Panel>
  );
}

/** "On a quote: £16.68 / m² (14.5% markup)": what the client will see before VAT. */
function QuotesAt({ ratePence, markup, unit, companyMarkupBps }: { ratePence: number | null; markup: string; unit: string; companyMarkupBps: number }) {
  const bps = markup.trim() === "" ? companyMarkupBps : parsePercentToBps(markup, 50_000);
  if (ratePence === null || ratePence < 0 || bps === null) return null;
  return (
    <p className="text-ink-2">
      On a quote: <span className="font-medium text-ink tabular">{formatGBP(lineTotal({ qty: 1, rate: ratePence, markup: bps }))}</span>
      {unit.trim() && ` / ${unit.trim()}`} before VAT, with {formatBps(bps)} markup.
    </p>
  );
}

function ReadOnlyNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-ink-2 shadow-ring">
      <Lock className="size-3.5" />
      Only Admins and Estimators can change the service library.
    </div>
  );
}

function Actions({ canEdit, pending, state, isNew, newLabel }: { canEdit: boolean; pending: boolean; state: ServiceFormState; isNew: boolean; newLabel: string }) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : isNew ? newLabel : "Save changes"}
      </Button>
      {isNew && (
        <Button variant="ghost" asChild>
          <Link href="/app/library">Cancel</Link>
        </Button>
      )}
      <p role="status" aria-live="polite" className={cn("flex items-center gap-1.5", state.status === "error" ? "text-danger" : "text-success")}>
        {state.status === "saved" && <Check className="size-3.5" />}
        {state.message}
      </p>
    </div>
  );
}
