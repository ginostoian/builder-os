"use client";

import * as React from "react";
import Link from "next/link";
import { startQuote, type NewQuoteState } from "@/app/app/quotes/actions";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { Panel } from "../app-shell";
import { Field, control } from "../form-fields";

export function NewQuoteForm({ clients, initialClientId }: { clients: { id: string; name: string }[]; initialClientId?: string }) {
  const [state, setState] = React.useState<NewQuoteState>({ status: "idle" });
  const [pending, startTransition] = React.useTransition();
  const [clientId, setClientId] = React.useState(initialClientId ?? "");
  const [title, setTitle] = React.useState("");

  if (clients.length === 0) {
    return (
      <Panel className="flex flex-col items-start gap-3 p-5">
        <p>Quotes are for a client, so add one first.</p>
        <Button asChild>
          <Link href="/app/clients/new">Add a client</Link>
        </Button>
      </Panel>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => setState(await startQuote(form)));
      }}
      className="flex flex-col gap-4"
    >
      <Panel className="flex flex-col gap-4 p-5">
        <Field label="Client" required error={state.errors?.clientId}>
          <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className={control} autoFocus={!initialClientId}>
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="-mt-2 text-[12px] text-subtle">
          Not listed?{" "}
          <Link href="/app/clients/new" className="underline underline-offset-2">
            Add a client
          </Link>
          , then come back.
        </p>
        <Field label="Title" required error={state.errors?.title} hint="What the client sees at the top, e.g. Kitchen extension.">
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TEXT.name} autoFocus={Boolean(initialClientId)} className={control} />
        </Field>
      </Panel>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create quote"}
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/app/quotes">Cancel</Link>
        </Button>
        {state.status === "error" && !state.errors && <p className="text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
