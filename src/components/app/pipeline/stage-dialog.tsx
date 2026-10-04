"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { setStageAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LOST_REASONS, LOST_REASON_LABEL, type LeadStage, type LostReason } from "@/core/pipeline";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import { SurveyDialog } from "./survey-dialog";

/**
 * The two stage moves that need a detail: booking the site visit (when, and who goes) and losing a lead
 * (why). Knowing why leads are lost is how you win more of them.
 */
export function StageDialog(props: { leadId: string; name: string; target: Extract<LeadStage, "lost" | "site_visit">; visitAt?: string | null; onClose: () => void }) {
  // Booking a visit goes through the survey diary (who's going, clashes, the client's confirmation).
  if (props.target === "site_visit") return <SurveyDialog leadId={props.leadId} name={props.name} onClose={props.onClose} stageMove />;
  return <LostDialog leadId={props.leadId} name={props.name} onClose={props.onClose} />;
}

function LostDialog({ leadId, name, onClose }: { leadId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = React.useState<LostReason | "">("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  const save = () =>
    startTransition(async () => {
      const r = await setStageAction(leadId, { stage: "lost", lostReason: reason || undefined, lostNote: note.trim() || undefined });
      if (!r.ok) return setError(r.message);
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogTitle>Lost {name}?</DialogTitle>
        <DialogDescription>Say why. Over time the reasons show what to change.</DialogDescription>
        <div className="mt-4 flex flex-col gap-3">
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
          {error && <p className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !reason} variant="destructive">
              {pending ? "Saving…" : "Mark as lost"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
