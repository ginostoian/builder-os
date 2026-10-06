"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil } from "lucide-react";
import { editVisitAction } from "@/app/app/team/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { londonDay, londonTime, mapLink } from "@/core/team";
import { cn } from "@/lib/utils";

export type VisitRow = {
  id: string;
  workerId: string;
  workerName: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  inLat: string | null;
  inLng: string | null;
  outLat: string | null;
  outLng: string | null;
  editedAt: Date | null;
  editedByName: string | null;
  recordedOffline: boolean;
};

const stamp = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(at);

/**
 * A visit's arrival and leaving times, marked "edited" if the office corrected them, with a pencil to
 * correct them (for those who can edit the team).
 */
export function VisitTimes({ visit, canEdit }: { visit: VisitRow; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="flex items-center gap-1.5 tabular text-ink-2">
      <span>
        {londonTime(visit.checkedInAt)} – {visit.checkedOutAt ? londonTime(visit.checkedOutAt) : <span className="text-success">now</span>}
      </span>
      {visit.recordedOffline && !visit.editedAt && (
        <span title="Recorded on their phone with no signal and sent later. The times are from the phone." className="rounded-full bg-surface px-1.5 py-px text-[10.5px] font-medium text-subtle">
          no signal
        </span>
      )}
      {visit.editedAt && (
        <span title={`Corrected${visit.editedByName ? ` by ${visit.editedByName}` : ""} on ${stamp(visit.editedAt)}`} className="rounded-full bg-surface px-1.5 py-px text-[10.5px] font-medium text-subtle">
          edited
        </span>
      )}
      {canEdit && (
        <>
          <button type="button" aria-label={`Correct ${visit.workerName}'s times`} onClick={() => setOpen(true)} className="grid size-6 place-items-center rounded-md text-subtle hover:bg-muted hover:text-ink">
            <Pencil className="size-3" />
          </button>
          {open && <EditVisit visit={visit} onClose={() => setOpen(false)} />}
        </>
      )}
    </span>
  );
}

function EditVisit({ visit, onClose }: { visit: VisitRow; onClose: () => void }) {
  const router = useRouter();
  const [day, setDay] = React.useState(londonDay(visit.checkedInAt));
  const [start, setStart] = React.useState(londonTime(visit.checkedInAt));
  const [end, setEnd] = React.useState(visit.checkedOutAt ? londonTime(visit.checkedOutAt) : "");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const r = await editVisitAction(visit.workerId, visit.id, { day, start, end: end || undefined });
      if (!r.ok) return setError(r.message);
      onClose();
      router.refresh();
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Correct the times</DialogTitle>
        <DialogDescription>
          {visit.workerName}&apos;s visit, in UK time. If they left after midnight, enter the leaving time and it counts as the next morning.
        </DialogDescription>
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visit-day">Day they arrived</Label>
            <Input id="visit-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-start">Arrived</Label>
              <Input id="visit-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-end">Left</Label>
              <Input id="visit-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required={Boolean(visit.checkedOutAt)} />
            </div>
          </div>
          {!visit.checkedOutAt && <p className="text-[12.5px] text-subtle">They&apos;re still checked in. Leave &quot;Left&quot; empty to keep them on site, or enter a time to check them out.</p>}
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save times"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Pins that open where they checked in and out, when their phone shared it. */
export function VisitPlaces({ visit, className }: { visit: Pick<VisitRow, "inLat" | "inLng" | "outLat" | "outLng">; className?: string }) {
  const places = [
    visit.inLat && visit.inLng ? { label: "In", href: mapLink(visit.inLat, visit.inLng) } : null,
    visit.outLat && visit.outLng ? { label: "Out", href: mapLink(visit.outLat, visit.outLng) } : null,
  ].filter((p) => p !== null);
  if (places.length === 0) return <span className={cn("text-[11.5px] text-faint-2", className)}>No location</span>;
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {places.map((p) => (
        <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer" title={`Where they checked ${p.label.toLowerCase()}, on a map`} className="inline-flex items-center gap-0.5 text-[12px] text-ink-2 hover:text-ink hover:underline">
          <MapPin className="size-3" />
          {p.label}
        </a>
      ))}
    </span>
  );
}
