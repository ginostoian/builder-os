"use client";

import * as React from "react";
import { createWorkerAction, updateWorkerAction } from "@/app/app/team/actions";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { parsePence } from "@/core/money";
import { WORKER_KINDS, WORKER_KIND_LABEL, type WorkerKind } from "@/core/team";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";

export type WorkerFormValues = {
  name: string;
  kind: WorkerKind;
  trade: string | null;
  phone: string | null;
  email: string | null;
  dayRatePence: number | null;
  startedOn: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  notes: string | null;
};

const EMPTY_WORKER: WorkerFormValues = { name: "", kind: "employee", trade: null, phone: null, email: null, dayRatePence: null, startedOn: null, emergencyName: null, emergencyPhone: null, notes: null };

/** Someone's details. Only the name is needed to start; the rest can be filled in over time. */
export function WorkerForm({ workerId, initial = EMPTY_WORKER, canSeeCosts, onSaved }: { workerId?: string; initial?: WorkerFormValues; canSeeCosts: boolean; onSaved?: () => void }) {
  const [v, setV] = React.useState({
    ...Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, x ?? ""])),
    dayRate: initial.dayRatePence != null ? (initial.dayRatePence / 100).toFixed(2) : "",
  } as Record<string, string>);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const opt = (k: string) => (v[k]?.trim() ? v[k].trim() : undefined);

  const submit = () =>
    startTransition(async () => {
      const rate = v.dayRate.trim() ? parsePence(v.dayRate) : null;
      if (v.dayRate.trim() && (rate === null || rate < 0)) return setMessage({ ok: false, text: "Check the day rate." });
      const input = {
        name: v.name.trim(),
        kind: v.kind as WorkerKind,
        trade: opt("trade"),
        phone: opt("phone"),
        email: opt("email")?.toLowerCase(),
        dayRatePence: canSeeCosts && rate !== null ? rate : undefined,
        startedOn: opt("startedOn"),
        emergencyName: opt("emergencyName"),
        emergencyPhone: opt("emergencyPhone"),
        notes: opt("notes"),
      };
      const r = workerId ? await updateWorkerAction(workerId, input) : await createWorkerAction(input);
      if (r && !r.ok) return setMessage({ ok: false, text: r.message });
      setMessage({ ok: true, text: "Saved" });
      onSaved?.();
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Name" required>
          <input value={v.name} onChange={set("name")} maxLength={TEXT.name} required className={control} />
        </Field>
        <Field label="Works as">
          <select value={v.kind} onChange={set("kind")} className={control}>
            {WORKER_KINDS.map((k) => (
              <option key={k} value={k}>
                {WORKER_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trade" hint="e.g. Carpenter, Electrician, Labourer">
          <input value={v.trade} onChange={set("trade")} maxLength={TEXT.short} className={control} />
        </Field>
        <Field label="Started">
          <input type="date" value={v.startedOn} onChange={set("startedOn")} className={control} />
        </Field>
        <Field label="Mobile">
          <input value={v.phone} onChange={set("phone")} maxLength={TEXT.phone} inputMode="tel" autoComplete="off" className={control} />
        </Field>
        <Field label="Email" hint="Use the same email when you invite them, and their login links to this person.">
          <input value={v.email} onChange={set("email")} maxLength={TEXT.email} inputMode="email" autoComplete="off" className={control} />
        </Field>
        {canSeeCosts && (
          <Field label="Day rate (cost)" hint="What they cost you per day. Only people who see costs see this.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle">£</span>
              <input value={v.dayRate} onChange={set("dayRate")} inputMode="decimal" className={cn(control, "pl-6 tabular")} />
            </div>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Emergency contact">
          <input value={v.emergencyName} onChange={set("emergencyName")} maxLength={TEXT.name} className={control} />
        </Field>
        <Field label="Emergency phone">
          <input value={v.emergencyPhone} onChange={set("emergencyPhone")} maxLength={TEXT.phone} inputMode="tel" className={control} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea value={v.notes} onChange={set("notes")} maxLength={TEXT.note} rows={3} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !v.name.trim()}>
          {pending ? "Saving…" : workerId ? "Save changes" : "Add to the team"}
        </Button>
        {message && <span className={cn("text-[12.5px]", message.ok ? "text-success" : "text-danger")}>{message.text}</span>}
      </div>
    </form>
  );
}
