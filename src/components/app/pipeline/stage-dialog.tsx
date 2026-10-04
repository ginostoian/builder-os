"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { setStageAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LOST_REASONS, LOST_REASON_LABEL, type LeadStage, type LostReason } from "@/core/pipeline";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";

/** A local "YYYY-MM-DDTHH:mm" for a datetime input, from an ISO instant. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * The two stage moves that need a detail: booking the site visit (when) and losing a lead (why). Knowing
 * why leads are lost is how you win more of them.
 */
export function StageDialog({ leadId, name, target, visitAt, onClose }: { leadId: string; name: string; target: Extract<LeadStage, "lost" | "site_visit">; visitAt?: string | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = React.useState<LostReason | "">("");
  const [note, setNote] = React.useState("");
  const [when, setWhen] = React.useState(toLocalInput(visitAt ?? null));
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const lost = target === "lost";

  const save = () =>
    startTransition(async () => {
      const r = await setStageAction(
        leadId,
        lost ? { stage: "lost", lostReason: reason || undefined, lostNote: note.trim() || undefined } : { stage: "site_visit", visitAt: when ? new Date(when).toISOString() : undefined },
      );
      if (!r.ok) return setError(r.message);
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogTitle>{lost ? `Lost ${name}?` : `Site visit with ${name}`}</DialogTitle>
        <DialogDescription>{lost ? "Say why. Over time the reasons show what to change." : "When you're going. A confirmation email can go out automatically with the date and time."}</DialogDescription>
        <div className="mt-4 flex flex-col gap-3">
          {lost ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {LOST_REASONS.filter((r) => r !== "declined_quote").map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-lg px-3 py-2 text-left text-[13px] shadow-ring", reason === r ? "bg-ink text-white" : "bg-white hover:bg-surface")}>
                    {LOST_REASON_LABEL[r]}
                  </button>
                ))}
              </div>
              <Field label="Anything to remember">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className={cn(control, "h-auto resize-y py-2")} placeholder="e.g. went with a firm £4k cheaper" />
              </Field>
            </>
          ) : (
            <Field label="Date and time">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={control} />
            </Field>
          )}
          {error && <p className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || (lost && !reason)} variant={lost ? "destructive" : "primary"}>
              {pending ? "Saving…" : lost ? "Mark as lost" : when ? "Book the visit" : "Move without a date"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
