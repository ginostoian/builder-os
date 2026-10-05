"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveCisSettingsAction } from "@/app/app/settings/cis-actions";
import { Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Field, control } from "../form-fields";

type Initial = { enabled: boolean; contractorUtr: string | null; employerRef: string | null; accountsOfficeRef: string | null };

/** CIS on or off, and the references that go on the monthly return. */
export function CisSettingsForm({ initial, canEdit }: { initial: Initial; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = React.useState({ enabled: initial.enabled, contractorUtr: initial.contractorUtr ?? "", employerRef: initial.employerRef ?? "", accountsOfficeRef: initial.accountsOfficeRef ?? "" });
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const set = (k: "contractorUtr" | "employerRef" | "accountsOfficeRef") => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const save = () =>
    startTransition(async () => {
      const r = await saveCisSettingsAction({
        enabled: v.enabled,
        contractorUtr: v.contractorUtr.trim() || undefined,
        employerRef: v.employerRef.trim() || undefined,
        accountsOfficeRef: v.accountsOfficeRef.trim() || undefined,
      });
      setMessage(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });

  return (
    <Panel className="p-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="flex items-start gap-2.5">
          <input type="checkbox" checked={v.enabled} disabled={!canEdit} onChange={(e) => setV((x) => ({ ...x, enabled: e.target.checked }))} className="mt-1" />
          <span>
            <span className="font-medium">We pay subcontractors under CIS</span>
            <span className="block text-[12.5px] text-ink-2">
              Adds CIS to subcontractor payments: their verified status, the materials part and the deduction. You get a monthly summary for your CIS300 return and a statement for each subcontractor.
            </span>
          </span>
        </label>
        {v.enabled && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Your UTR" hint="10 digits. Optional.">
              <input value={v.contractorUtr} onChange={set("contractorUtr")} disabled={!canEdit} inputMode="numeric" maxLength={14} className={control} />
            </Field>
            <Field label="Employer reference" hint="e.g. 123/AB45678">
              <input value={v.employerRef} onChange={set("employerRef")} disabled={!canEdit} maxLength={14} className={`${control} uppercase`} />
            </Field>
            <Field label="Accounts Office reference" hint="e.g. 123PA00012345">
              <input value={v.accountsOfficeRef} onChange={set("accountsOfficeRef")} disabled={!canEdit} maxLength={13} className={`${control} uppercase`} />
            </Field>
          </div>
        )}
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            {message && <span className={message.ok ? "text-[12.5px] text-success" : "text-[12.5px] text-danger"}>{message.text}</span>}
          </div>
        )}
      </form>
    </Panel>
  );
}
