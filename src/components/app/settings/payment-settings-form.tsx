"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { savePaymentDetails, type PaymentSettingsState } from "@/app/app/payments/actions";
import { Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { formatSortCode } from "@/core/payment-plan";
import { cn } from "@/lib/utils";
import { Field, SectionHeading, control } from "../form-fields";

type Values = { bankAccountName: string | null; bankSortCode: string | null; bankAccountNumber: string | null; paymentTermsDays: number; remindersEnabled: boolean };

/** Bank details for invoices, payment terms and automatic reminders. */
export function PaymentSettingsForm({ initial, canEdit, emailEnabled }: { initial: Values; canEdit: boolean; emailEnabled: boolean }) {
  const [state, setState] = React.useState<PaymentSettingsState>({ status: "idle" });
  const [pending, startTransition] = React.useTransition();
  const [values, setValues] = React.useState({
    bankAccountName: initial.bankAccountName ?? "",
    bankSortCode: initial.bankSortCode ? formatSortCode(initial.bankSortCode) : "",
    bankAccountNumber: initial.bankAccountNumber ?? "",
    paymentTermsDays: String(initial.paymentTermsDays),
    remindersEnabled: initial.remindersEnabled,
  });
  const set = (key: "bankAccountName" | "bankSortCode" | "bankAccountNumber" | "paymentTermsDays") => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const error = (k: keyof NonNullable<PaymentSettingsState["errors"]>) => (state.status === "error" ? state.errors?.[k] : undefined);

  return (
    <form
      noValidate
      className="flex max-w-[720px] flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => setState(await savePaymentDetails(form)));
      }}
    >
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-ink-2 shadow-ring">
          <Lock className="size-3.5" />
          Only an Admin can change payment details.
        </div>
      )}
      <fieldset disabled={!canEdit || pending} className="contents">
        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Bank details" hint="Printed on every invoice so clients can pay by bank transfer. Invoices keep the details they were raised with." />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account name" error={error("bankAccountName")} className="col-span-2">
              <input name="bankAccountName" value={values.bankAccountName} onChange={set("bankAccountName")} maxLength={TEXT.name} autoComplete="off" className={control} />
            </Field>
            <Field label="Sort code" error={error("bankSortCode")} hint="e.g. 12-34-56">
              <input name="bankSortCode" value={values.bankSortCode} onChange={set("bankSortCode")} inputMode="numeric" maxLength={8} autoComplete="off" className={cn(control, "font-mono")} />
            </Field>
            <Field label="Account number" error={error("bankAccountNumber")} hint="8 digits">
              <input name="bankAccountNumber" value={values.bankAccountNumber} onChange={set("bankAccountNumber")} inputMode="numeric" maxLength={10} autoComplete="off" className={cn(control, "font-mono")} />
            </Field>
          </div>
        </Panel>
        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Invoices" hint="How long clients have to pay, and whether they get reminders." />
          <Field label="Payment terms" error={error("paymentTermsDays")} hint="Invoices are due this many days after they're raised, unless the payment plan gives a date. 0 means due on receipt." className="max-w-[320px]">
            <div className="relative">
              <input name="paymentTermsDays" value={values.paymentTermsDays} onChange={set("paymentTermsDays")} inputMode="numeric" maxLength={3} className={cn(control, "pr-12 tabular")} />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle">days</span>
            </div>
          </Field>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="remindersEnabled" checked={values.remindersEnabled} onChange={(e) => setValues((v) => ({ ...v, remindersEnabled: e.target.checked }))} className="mt-0.5" />
            <span>
              <span className="font-medium">Email clients automatic reminders</span>
              <span className="block text-subtle">3 days before an invoice is due, on the day, then 3 and 7 days late. They stop as soon as you mark it paid.</span>
              {!emailEnabled && <span className="mt-1 block text-warning">Email isn&apos;t set up yet, so no reminders go out until it is.</span>}
            </span>
          </label>
        </Panel>
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <p role="status" aria-live="polite" className={cn("flex items-center gap-1.5", state.status === "error" ? "text-danger" : "text-success")}>
            {state.status === "saved" && <Check className="size-3.5" />}
            {state.status === "saved" ? "Saved" : state.message}
          </p>
        </div>
      )}
    </form>
  );
}
