"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveLeadAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { parsePence } from "@/core/money";
import { BUDGETS, LEAD_SOURCES, LEAD_SOURCE_LABEL, PROJECT_TYPES, type LeadSource } from "@/core/pipeline";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import { EMPTY_LEAD, type LeadValues, type Owner } from "./types";

/** Add a lead (a phone call, a referral, a message on Facebook) or change one's details. */
export function LeadDialog({ open, onOpenChange, leadId, initial = EMPTY_LEAD, owners, meId }: { open: boolean; onOpenChange: (o: boolean) => void; leadId?: string; initial?: LeadValues; owners: Owner[]; meId?: string }) {
  const router = useRouter();
  const [v, setV] = React.useState(() => ({
    ...Object.fromEntries(Object.entries(initial).filter(([, x]) => typeof x !== "object").map(([k, x]) => [k, x ?? ""])),
    value: initial.valuePence != null ? String(initial.valuePence / 100) : "",
    ownerMemberId: initial.ownerMemberId ?? (leadId ? "" : (meId ?? "")),
  }) as Record<string, string>);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const opt = (k: string) => v[k]?.trim() || undefined;

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const value = v.value.trim() ? parsePence(v.value) : null;
      if (v.value.trim() && value === null) return setError("Check the value.");
      const r = await saveLeadAction(leadId ?? null, {
        name: v.name.trim(),
        email: opt("email")?.toLowerCase(),
        phone: opt("phone"),
        postcode: opt("postcode")?.toUpperCase(),
        ...(initial.address ? { address: initial.address } : {}),
        source: v.source as LeadSource,
        sourceDetail: opt("sourceDetail"),
        projectType: opt("projectType"),
        description: opt("description"),
        budget: opt("budget"),
        valuePence: value ?? undefined,
        ownerMemberId: opt("ownerMemberId"),
      });
      if (!r.ok) return setError(r.message);
      onOpenChange(false);
      if (!leadId && r.id) router.push(`/app/pipeline/${r.id}`);
      else router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px]">
        <DialogTitle>{leadId ? "Lead details" : "Add a lead"}</DialogTitle>
        <DialogDescription>{leadId ? "Who they are and what they want." : "Someone who's asked about work. Just a name and a number is enough to start."}</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Name" required>
              <input value={v.name} onChange={set("name")} maxLength={TEXT.name} required autoFocus={!leadId} className={control} />
            </Field>
            <Field label="Phone">
              <input value={v.phone} onChange={set("phone")} maxLength={TEXT.phone} inputMode="tel" className={control} />
            </Field>
            <Field label="Email" hint="Needed for automatic follow-up emails.">
              <input value={v.email} onChange={set("email")} maxLength={TEXT.email} inputMode="email" className={control} />
            </Field>
            <Field label="Postcode">
              <input value={v.postcode} onChange={set("postcode")} maxLength={10} className={cn(control, "uppercase")} />
            </Field>
            <Field label="The work">
              <input value={v.projectType} onChange={set("projectType")} list="project-types" maxLength={TEXT.short} placeholder="e.g. Kitchen extension" className={control} />
              <datalist id="project-types">
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Rough value" hint="What the job's likely worth, for the pipeline total.">
              <span className="relative block">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle">£</span>
                <input value={v.value} onChange={set("value")} inputMode="decimal" className={cn(control, "pl-6 tabular")} />
              </span>
            </Field>
            <Field label="Details" className="sm:col-span-2">
              <textarea value={v.description} onChange={set("description")} maxLength={TEXT.note} rows={3} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
            </Field>
            <Field label="Where they came from">
              <select value={v.source} onChange={set("source")} className={control}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source detail" hint="e.g. who referred them.">
              <input value={v.sourceDetail} onChange={set("sourceDetail")} maxLength={TEXT.name} className={control} />
            </Field>
            <Field label="Budget">
              <input value={v.budget} onChange={set("budget")} list="budgets" maxLength={TEXT.short} className={control} />
              <datalist id="budgets">
                {BUDGETS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
            <Field label="Owner" hint="Who's chasing it. Automated emails sign off with their name.">
              <select value={v.ownerMemberId} onChange={set("ownerMemberId")} className={control}>
                <option value="">Nobody yet</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {error && <p className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !v.name.trim()}>
              {pending ? "Saving…" : leadId ? "Save" : "Add lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
