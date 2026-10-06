"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { saveClient, type ClientFormState } from "@/app/app/clients/actions";
import { Button } from "@/components/ui/button";
import { CLIENT_SOURCES, type ClientField } from "@/core/clients";
import { TEXT } from "@/core/limits";
import type { Address } from "@/core/schemas";
import { cn } from "@/lib/utils";
import { Panel } from "../app-shell";
import { Field, SectionHeading, control } from "../form-fields";

export type ClientValues = {
  name: string;
  email: string | null;
  phone: string | null;
  address: Address | null;
  source: string | null;
  notes: string | null;
};

type FormValues = Record<ClientField, string>;

const toForm = (v: ClientValues | undefined): FormValues => ({
  name: v?.name ?? "",
  email: v?.email ?? "",
  phone: v?.phone ?? "",
  line1: v?.address?.line1 ?? "",
  line2: v?.address?.line2 ?? "",
  town: v?.address?.town ?? "",
  postcode: v?.address?.postcode ?? "",
  source: v?.source ?? "",
  notes: v?.notes ?? "",
});

/** Add (no `clientId`) or edit a client. Read-only for roles that can't manage clients. */
export function ClientForm({ clientId, initial, canEdit }: { clientId?: string; initial?: ClientValues; canEdit: boolean }) {
  const [state, setState] = React.useState<ClientFormState>({ status: "idle" });
  const [pending, startTransition] = React.useTransition();
  // Controlled and submitted from onSubmit, like the settings form: a <form action> reset would wipe what
  // the user typed when the server sends back an error.
  const [values, setValues] = React.useState<FormValues>(() => toForm(initial));
  const set = (key: ClientField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (state.status === "saved") setState({ status: "idle" });
  };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveClient(clientId ?? null, form);
      setState(result);
      const v = result.saved;
      if (v) setValues(toForm({ name: v.name, email: v.email ?? null, phone: v.phone ?? null, address: v.address ?? null, source: v.source ?? null, notes: v.notes ?? null }));
    });
  };
  const error = (field: ClientField) => (state.status === "error" ? state.errors?.[field] : undefined);
  const isNew = clientId === undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-ink-2 shadow-ring">
          <Lock className="size-3.5" />
          Your role can view clients but not change them.
        </div>
      )}
      <fieldset disabled={!canEdit || pending} className="contents">
        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Contact" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" hint="A person or a company." error={error("name")} required className="sm:col-span-2">
              <input name="name" value={values.name} onChange={set("name")} maxLength={TEXT.name} autoFocus={isNew} autoComplete="off" className={control} />
            </Field>
            <Field label="Email" error={error("email")}>
              <input name="email" type="email" value={values.email} onChange={set("email")} maxLength={TEXT.email} autoComplete="off" className={control} />
            </Field>
            <Field label="Phone" error={error("phone")}>
              <input name="phone" type="tel" value={values.phone} onChange={set("phone")} maxLength={TEXT.phone} autoComplete="off" className={cn(control, "tabular")} />
            </Field>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="Address" hint="Where they live. Each quote can have its own site address." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Address line 1" error={error("line1")}>
              <input name="line1" value={values.line1} onChange={set("line1")} maxLength={TEXT.name} autoComplete="off" className={control} />
            </Field>
            <Field label="Address line 2" error={error("line2")}>
              <input name="line2" value={values.line2} onChange={set("line2")} maxLength={TEXT.name} autoComplete="off" className={control} />
            </Field>
            <Field label="Town or city" error={error("town")}>
              <input name="town" value={values.town} onChange={set("town")} maxLength={TEXT.short} autoComplete="off" className={control} />
            </Field>
            <Field label="Postcode" error={error("postcode")}>
              <input name="postcode" value={values.postcode} onChange={set("postcode")} maxLength={8} autoComplete="off" className={cn(control, "uppercase")} />
            </Field>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="More" />
          <Field label="How did they find you?" hint="Pick one or type your own." error={error("source")}>
            <input name="source" list="client-sources" value={values.source} onChange={set("source")} maxLength={TEXT.short} autoComplete="off" className={cn(control, "max-w-[320px]")} />
            <datalist id="client-sources">
              {CLIENT_SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Notes" hint="Only your team sees these." error={error("notes")}>
            <textarea name="notes" value={values.notes} onChange={set("notes")} maxLength={TEXT.note} rows={4} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
          </Field>
        </Panel>
      </fieldset>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : isNew ? "Add client" : "Save changes"}
          </Button>
          {isNew && (
            <Button variant="ghost" asChild>
              <Link href="/app/clients">Cancel</Link>
            </Button>
          )}
          <p role="status" aria-live="polite" className={cn("flex items-center gap-1.5", state.status === "error" ? "text-danger" : "text-success")}>
            {state.status === "saved" && <Check className="size-3.5" />}
            {state.message}
          </p>
        </div>
      )}
    </form>
  );
}
