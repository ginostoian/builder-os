"use client";

import * as React from "react";
import { createProjectAction, updateProjectAction } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/core/projects";
import { address as addressSchema, type Address } from "@/core/schemas";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import type { Member } from "./types";

export type ProjectFormValues = {
  name: string;
  clientId: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  managerMemberId: string | null;
  siteAddress: Address | null;
  shareProgress: boolean;
};

/** A project's details: name, client, where, when, who runs it, and whether the client sees progress. */
export function ProjectForm({
  projectId,
  initial,
  clients,
  members,
  onDone,
  onCancel,
}: {
  /** Set when editing; absent for a new project. */
  projectId?: string;
  initial: ProjectFormValues;
  clients: { id: string; name: string; address: Address | null }[];
  members: Member[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [v, setV] = React.useState(initial);
  const [site, setSite] = React.useState({ line1: initial.siteAddress?.line1 ?? "", line2: initial.siteAddress?.line2 ?? "", town: initial.siteAddress?.town ?? "", postcode: initial.siteAddress?.postcode ?? "" });
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const client = clients.find((c) => c.id === v.clientId);

  const submit = () =>
    startTransition(async () => {
      const filled = Object.values(site).some((x) => x.trim());
      let siteAddress: Address | undefined;
      if (filled) {
        const a = addressSchema.safeParse({ line1: site.line1, line2: site.line2.trim() || undefined, town: site.town, postcode: site.postcode });
        if (!a.success) return setError("Fill in the first line, town and a UK postcode for the site, or clear all four.");
        siteAddress = a.data;
      }
      const input = {
        name: v.name.trim(),
        clientId: v.clientId,
        status: v.status,
        startDate: v.startDate || undefined,
        endDate: v.endDate || undefined,
        managerMemberId: v.managerMemberId || undefined,
        siteAddress,
        shareProgress: v.shareProgress,
      };
      const r = projectId ? await updateProjectAction(projectId, input) : await createProjectAction(input);
      if (r && !r.ok) return setError(r.message);
      onDone?.();
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
        <Field label="Project name" className="col-span-2" hint="e.g. Kitchen extension, 14 Elm Road">
          <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={TEXT.name} required className={control} />
        </Field>
        <Field label="Client">
          <select value={v.clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })} required className={control}>
            <option value="" disabled>
              Choose a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ProjectStatus })} className={control}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start on site">
          <input type="date" value={v.startDate ?? ""} onChange={(e) => setV({ ...v, startDate: e.target.value || null })} className={control} />
        </Field>
        <Field label="Planned finish" error={v.startDate && v.endDate && v.endDate < v.startDate ? "Before the start date" : undefined}>
          <input type="date" value={v.endDate ?? ""} min={v.startDate ?? undefined} onChange={(e) => setV({ ...v, endDate: e.target.value || null })} className={control} />
        </Field>
        <Field label="Runs the job" className="col-span-2" hint="Usually the site lead. They see the job on their dashboard.">
          <select value={v.managerMemberId ?? ""} onChange={(e) => setV({ ...v, managerMemberId: e.target.value || null })} className={control}>
            <option value="">Nobody yet</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] font-medium">Site address</span>
          {client?.address && (
            <button
              type="button"
              className="text-[12.5px] text-ink-2 underline underline-offset-2 hover:text-ink"
              onClick={() => setSite({ line1: client.address!.line1, line2: client.address!.line2 ?? "", town: client.address!.town, postcode: client.address!.postcode })}
            >
              Use {client.name}&apos;s address
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(["line1", "line2", "town", "postcode"] as const).map((f) => (
            <input
              key={f}
              aria-label={{ line1: "Address line 1", line2: "Address line 2", town: "Town or city", postcode: "Postcode" }[f]}
              placeholder={{ line1: "Address line 1", line2: "Address line 2", town: "Town or city", postcode: "Postcode" }[f]}
              value={site[f]}
              maxLength={f === "postcode" ? 8 : TEXT.name}
              onChange={(e) => setSite((s) => ({ ...s, [f]: e.target.value }))}
              className={cn(control, f === "postcode" && "uppercase")}
            />
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2.5">
        <input type="checkbox" checked={v.shareProgress} onChange={(e) => setV({ ...v, shareProgress: e.target.checked })} className="mt-0.5" />
        <span>
          <span className="font-medium">Show progress in the client&apos;s portal</span>
          <span className="block text-subtle">They see how far each stage is, plus any diary updates and files you choose to share. Never the task list or your notes.</span>
        </span>
      </label>

      {error && <p className="text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending || !v.name.trim() || !v.clientId}>
          {pending ? "Saving…" : projectId ? "Save details" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
