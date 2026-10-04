"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { addCertificateAction, deleteCertificateAction, updateCertificateAction } from "@/app/app/team/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { longDate } from "@/core/quote-snapshot";
import { CERTIFICATE_SUGGESTIONS, certState } from "@/core/team";
import { cn } from "@/lib/utils";
import { control } from "../form-fields";

type Cert = { id: string; name: string; reference: string | null; expiresOn: string | null };

const STATE = {
  expired: { label: "Expired", tone: "red" as const },
  expiring: { label: "Expires soon", tone: "amber" as const },
  ok: { label: "Valid", tone: "green" as const },
  no_expiry: { label: "No expiry", tone: "grey" as const },
};

/** Cards, tickets and registrations with expiry dates. The office is emailed 30 days before one expires. */
export function Certificates({ workerId, certificates, today, canEdit }: { workerId: string; certificates: Cert[]; today: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const [error, setError] = React.useState<string>();
  const done = () => {
    setEditing(null);
    setError(undefined);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      {certificates.length === 0 && editing !== "new" && <p className="text-subtle">No certificates yet. Add CSCS cards, Gas Safe, first aid and the like, with expiry dates, and you&apos;ll be reminded before they run out.</p>}
      {certificates.length > 0 && (
        <ul className="overflow-hidden rounded-[10px] shadow-ring">
          {certificates.map((c) =>
            editing === c.id ? (
              <li key={c.id} className="border-b border-hairline p-3 last:border-0">
                <CertForm initial={c} onCancel={() => setEditing(null)} onSave={(input) => updateCertificateAction(workerId, c.id, input)} onDone={done} onError={setError} />
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-3 border-b border-hairline px-3.5 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-[12px] text-subtle">
                    {c.reference && `${c.reference} · `}
                    {c.expiresOn ? `Expires ${longDate(c.expiresOn)}` : "No expiry date"}
                  </div>
                </div>
                <Badge tone={STATE[certState(c.expiresOn, today)].tone}>{STATE[certState(c.expiresOn, today)].label}</Badge>
                {canEdit && (
                  <>
                    <button type="button" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c.id)} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-muted hover:text-ink">
                      <Pencil className="size-3.5" />
                    </button>
                    <DeleteButton label={c.name} onDelete={async () => (await deleteCertificateAction(workerId, c.id), router.refresh())} />
                  </>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {canEdit &&
        (editing === "new" ? (
          <div className="rounded-[10px] p-3 shadow-ring">
            <CertForm initial={{ name: "", reference: null, expiresOn: null }} onCancel={() => setEditing(null)} onSave={(input) => addCertificateAction(workerId, input)} onDone={done} onError={setError} />
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setEditing("new")}>
              <Plus />
              Add certificate
            </Button>
          </div>
        ))}
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

function CertForm({
  initial,
  onSave,
  onCancel,
  onDone,
  onError,
}: {
  initial: { name: string; reference: string | null; expiresOn: string | null };
  onSave: (input: { name: string; reference?: string; expiresOn?: string }) => Promise<{ ok: boolean; message?: string }>;
  onCancel: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = React.useState(initial.name);
  const [reference, setReference] = React.useState(initial.reference ?? "");
  const [expiresOn, setExpiresOn] = React.useState(initial.expiresOn ?? "");
  const [pending, startTransition] = React.useTransition();
  const listId = React.useId();
  return (
    <form
      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_auto] items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await onSave({ name: name.trim(), reference: reference.trim() || undefined, expiresOn: expiresOn || undefined });
          if (r.ok) onDone();
          else onError(r.message ?? "Couldn't save.");
        });
      }}
    >
      <input aria-label="Certificate" list={listId} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSCS card" maxLength={TEXT.name} required autoFocus className={control} />
      <datalist id={listId}>
        {CERTIFICATE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <input aria-label="Card or registration number" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Number (optional)" maxLength={TEXT.short} className={control} />
      <input aria-label="Expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={control} />
      <div className="flex gap-1.5">
        <Button type="submit" disabled={pending || !name.trim()}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => Promise<unknown> }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      title={confirm ? "Click again to delete" : "Delete"}
      onBlur={() => setConfirm(false)}
      onClick={() => (confirm ? void onDelete() : setConfirm(true))}
      className={cn("grid size-7 place-items-center rounded-md hover:bg-muted", confirm ? "text-danger" : "text-subtle")}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
