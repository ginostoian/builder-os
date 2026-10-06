"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveWorkerCisAction } from "@/app/app/settings/cis-actions";
import { Field, control } from "@/components/app/form-fields";
import { Button } from "@/components/ui/button";
import { CIS_STATUSES, CIS_STATUS_LABEL, type CisStatus } from "@/core/cis";

type Initial = { status: CisStatus | null; utr: string | null; verificationRef: string | null; verifiedOn: string | null };

/**
 * A subcontractor's CIS details. Verify them with HMRC (online or by phone) using their UTR, then record
 * the status HMRC gives. Until then payments are deducted at the higher rate, as HMRC requires.
 */
export function WorkerCis({ workerId, initial, canEdit }: { workerId: string; initial: Initial; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = React.useState({ status: initial.status ?? "", utr: initial.utr ?? "", verificationRef: initial.verificationRef ?? "", verifiedOn: initial.verifiedOn ?? "" });
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const save = () =>
    startTransition(async () => {
      const r = await saveWorkerCisAction(workerId, {
        status: v.status || undefined,
        utr: v.utr.trim() || undefined,
        verificationRef: v.verificationRef.trim() || undefined,
        verifiedOn: v.verifiedOn || undefined,
      });
      setMessage(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {!initial.status && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning">Not verified yet: payments to them are deducted at 30% until you add their status.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Status from HMRC">
          <select value={v.status} onChange={set("status")} disabled={!canEdit} className={control}>
            <option value="">Not verified (30%)</option>
            {CIS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CIS_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="UTR" hint="Their 10-digit Unique Taxpayer Reference.">
          <input value={v.utr} onChange={set("utr")} disabled={!canEdit} inputMode="numeric" maxLength={14} className={control} />
        </Field>
        <Field label="Verification number" hint="From HMRC, e.g. V1234567890.">
          <input value={v.verificationRef} onChange={set("verificationRef")} disabled={!canEdit} maxLength={15} className={`${control} uppercase`} />
        </Field>
        <Field label="Verified on">
          <input type="date" value={v.verifiedOn} onChange={set("verifiedOn")} disabled={!canEdit} className={control} />
        </Field>
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save CIS details"}
          </Button>
          {message && <span className={message.ok ? "text-[12.5px] text-success" : "text-[12.5px] text-danger"}>{message.text}</span>}
        </div>
      )}
    </form>
  );
}
