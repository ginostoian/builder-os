"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { saveCompanySettings, type SaveSettingsState } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { VAT_RATE_OPTIONS, type SettingsField } from "@/core/company-settings";
import { TEXT } from "@/core/limits";
import { formatBps } from "@/core/money";
import { cn } from "@/lib/utils";
import { Panel } from "../app-shell";
import { Field, SectionHeading, control } from "../form-fields";
import { LogoUpload } from "./logo-upload";
import { StorageCheckButton } from "./storage-check";

export type CompanySettingsValues = {
  name: string;
  tradingName: string | null;
  vatNumber: string | null;
  logoUrl: string | null;
  brandColour: string | null;
  defaultMarkupBps: number;
  defaultVatRateBps: number;
  quoteTerms: string | null;
};

const bpsToPercentText = (bps: number) => String(Number((bps / 100).toFixed(2)));

/** Form field names. `defaultMarkup` and `defaultVatRate` are percentages, parsed to basis points on the server. */
type FormValues = {
  name: string;
  tradingName: string;
  vatNumber: string;
  logoUrl: string;
  brandColour: string;
  defaultMarkup: string;
  defaultVatRate: string;
  quoteTerms: string;
};

const toForm = (v: CompanySettingsValues): FormValues => ({
  name: v.name,
  tradingName: v.tradingName ?? "",
  vatNumber: v.vatNumber ?? "",
  logoUrl: v.logoUrl ?? "",
  brandColour: v.brandColour ?? "",
  defaultMarkup: bpsToPercentText(v.defaultMarkupBps),
  defaultVatRate: bpsToPercentText(v.defaultVatRateBps),
  quoteTerms: v.quoteTerms ?? "",
});

export function CompanySettingsForm({ initial, canEdit, storageEnabled }: { initial: CompanySettingsValues | undefined; canEdit: boolean; storageEnabled: boolean }) {
  const [state, setState] = React.useState<SaveSettingsState>({ status: "idle" });
  const [pending, startTransition] = React.useTransition();
  // Submitted from onSubmit rather than <form action>: React resets a form after an action, which would
  // wipe what the user typed on an error and show stale values in the selects after a save.
  const [values, setValues] = React.useState<FormValues>(() =>
    toForm(initial ?? { name: "", tradingName: null, vatNumber: null, logoUrl: null, brandColour: null, defaultMarkupBps: 0, defaultVatRateBps: 2000, quoteTerms: null }),
  );
  const set = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveCompanySettings(form);
      setState(result);
      if (result.saved) {
        const v = result.saved;
        setValues(
          toForm({
            name: v.name,
            tradingName: v.tradingName ?? null,
            vatNumber: v.vatNumber ?? null,
            logoUrl: v.logoUrl ?? null,
            brandColour: v.brandColour ?? null,
            defaultMarkupBps: v.defaultMarkupBps,
            defaultVatRateBps: v.defaultVatRateBps,
            quoteTerms: v.quoteTerms ?? null,
          }),
        );
      }
    });
  };
  const error = (field: SettingsField) => (state.status === "error" ? state.errors?.[field] : undefined);

  const vatOptions: number[] = [...VAT_RATE_OPTIONS];
  const currentVat = initial?.defaultVatRateBps;
  if (currentVat !== undefined && !vatOptions.includes(currentVat)) vatOptions.push(currentVat);

  return (
    <form onSubmit={submit} className="flex max-w-[720px] flex-col gap-4" noValidate>
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-ink-2 shadow-ring">
          <Lock className="size-3.5" />
          Only an Admin can change company settings.
        </div>
      )}
      <fieldset disabled={!canEdit || pending} className="contents">
        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Company" hint="Shown at the top of every quote and invoice." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company name" error={error("name")} required>
              <input name="name" value={values.name} onChange={set("name")} maxLength={TEXT.name} autoComplete="organization" className={control} />
            </Field>
            <Field label="Trading name" hint="If you trade under a different name." error={error("tradingName")}>
              <input name="tradingName" value={values.tradingName} onChange={set("tradingName")} maxLength={TEXT.name} className={control} />
            </Field>
            <Field label="VAT number" hint="Leave blank if you're not VAT registered." error={error("vatNumber")}>
              <input name="vatNumber" value={values.vatNumber} onChange={set("vatNumber")} placeholder="GB 123 4567 89" className={cn(control, "font-mono")} />
            </Field>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Branding" hint="Used on quotes, invoices and the client portal." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {storageEnabled ? (
              <>
                {/* Uploads save on their own; this keeps the current logo when the rest of the form is saved. */}
                <input type="hidden" name="logoUrl" value={values.logoUrl} />
                <LogoUpload logoUrl={values.logoUrl} onChange={(logoUrl) => setValues((v) => ({ ...v, logoUrl }))} disabled={!canEdit} />
              </>
            ) : (
              <Field label="Logo link" hint="A link to your logo, starting with https://." error={error("logoUrl")}>
                <input name="logoUrl" type="url" value={values.logoUrl} onChange={set("logoUrl")} placeholder="https://" className={control} />
              </Field>
            )}
            <Field label="Brand colour" hint="Hex colour for accents on your documents." error={error("brandColour")}>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-8 flex-none rounded-md shadow-ring"
                  style={{ background: /^#[0-9a-fA-F]{6}$/.test(values.brandColour) ? values.brandColour : undefined }}
                />
                <input name="brandColour" value={values.brandColour} onChange={set("brandColour")} placeholder="#E8590C" maxLength={7} className={cn(control, "font-mono")} />
              </div>
            </Field>
          </div>
                  {storageEnabled && canEdit && <StorageCheckButton />}
        </Panel>

        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Quote defaults" hint="New quotes start with these. You can change them on each quote and line." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Default markup" error={error("defaultMarkupBps")}>
              <div className="relative">
                <input name="defaultMarkup" inputMode="decimal" value={values.defaultMarkup} onChange={set("defaultMarkup")} className={cn(control, "pr-7 tabular")} />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle">%</span>
              </div>
            </Field>
            <Field label="Default VAT rate" error={error("defaultVatRateBps")}>
              <select name="defaultVatRate" value={values.defaultVatRate} onChange={set("defaultVatRate")} className={control}>
                {vatOptions.map((bps) => (
                  <option key={bps} value={bpsToPercentText(bps)}>
                    {formatBps(bps)}
                    {bps === 2000 ? " (standard)" : bps === 500 ? " (reduced)" : bps === 0 ? " (zero-rated)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Quote terms" hint="Printed at the end of every quote: payment terms, validity, exclusions." error={error("quoteTerms")}>
            <textarea
              name="quoteTerms"
              value={values.quoteTerms}
              onChange={set("quoteTerms")}
              maxLength={TEXT.terms}
              rows={7}
              className={cn(control, "h-auto resize-y py-2 leading-normal")}
            />
          </Field>
        </Panel>
      </fieldset>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <p role="status" aria-live="polite" className={cn("flex items-center gap-1.5", state.status === "error" ? "text-danger" : "text-success")}>
            {state.status === "saved" && <Check className="size-3.5" />}
            {state.message}
          </p>
        </div>
      )}
    </form>
  );
}
