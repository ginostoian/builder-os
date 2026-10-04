"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Copy, Link2, Loader2 } from "lucide-react";
import { setStageAction } from "@/app/app/pipeline/actions";
import { bookSurveyAction, bookingLinkAction, cancelSurveyAction, surveyOptionsAction } from "@/app/app/pipeline/survey-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { londonParts, londonToUtc, minuteLabel } from "@/core/surveys";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";

type Options = NonNullable<Awaited<ReturnType<typeof surveyOptionsAction>>>;

const TIMES = Array.from({ length: (21 - 7) * 4 + 1 }, (_, i) => 7 * 60 + i * 15);

/**
 * Book or move a lead's survey: one of the next free times (from the surveyors' hours), or any date and
 * time you like. The office can book outside the online hours; the only rule is one place at a time.
 */
export function SurveyDialog({ leadId, name, onClose, stageMove = false }: { leadId: string; name: string; onClose: () => void; stageMove?: boolean }) {
  const router = useRouter();
  const [opts, setOpts] = React.useState<Options | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [day, setDay] = React.useState("");
  const [minute, setMinute] = React.useState(10 * 60);
  const [memberId, setMemberId] = React.useState<string>("");
  const [emailClient, setEmailClient] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let live = true;
    surveyOptionsAction(leadId)
      .then((o) => {
        if (!live) return;
        if (!o) return setFailed(true);
        setOpts(o);
        setMemberId(o.defaultMemberId ?? "");
        setEmailClient(o.hasEmail);
        if (o.current) {
          const p = londonParts(new Date(o.current.iso));
          setDay(p.day);
          setMinute(p.minute);
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [leadId]);

  const pick = (iso: string, who: string) => {
    const p = londonParts(new Date(iso));
    setDay(p.day);
    setMinute(p.minute);
    setMemberId(who);
  };

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      if (!day) return setError("Choose a date.");
      const r = await bookSurveyAction(leadId, { startsAt: londonToUtc(day, minute).toISOString(), memberId: memberId || null, emailClient });
      if (!r.ok) return setError(r.message);
      router.refresh();
      onClose();
    });

  const moveOnly = () =>
    startTransition(async () => {
      const r = await setStageAction(leadId, { stage: "site_visit" });
      if (!r.ok) return setError(r.message);
      router.refresh();
      onClose();
    });

  const chosenIso = day ? londonToUtc(day, minute).toISOString() : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle>{opts?.current ? `Move ${name}'s survey` : `Book a survey with ${name}`}</DialogTitle>
        <DialogDescription>Pick a free time, or any date and time. Times are UK time.</DialogDescription>
        {!opts ? (
          <div className="flex items-center gap-2 py-8 text-subtle">{failed ? "Couldn't load the diary. Close and try again." : <><Loader2 className="size-4 animate-spin" /> Checking the diary…</>}</div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {opts.free.length > 0 && (
              <div>
                <div className="mb-1.5 text-[12.5px] font-medium">Next free times</div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {opts.free.map((f) => (
                    <button
                      key={`${f.iso}-${f.memberId}`}
                      type="button"
                      onClick={() => pick(f.iso, f.memberId)}
                      className={cn("rounded-lg px-2.5 py-1.5 text-left text-[12.5px] shadow-ring", chosenIso === f.iso && memberId === f.memberId ? "bg-ink text-white" : "bg-white hover:bg-surface")}
                    >
                      <span className="block font-medium">
                        {f.dayShort}, {f.time}
                      </span>
                      <span className={cn("block truncate text-[11.5px]", chosenIso === f.iso && memberId === f.memberId ? "text-white/70" : "text-subtle")}>{f.memberName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={control} />
              </Field>
              <Field label="Time">
                <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className={control}>
                  {TIMES.map((m) => (
                    <option key={m} value={m}>
                      {minuteLabel(m)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Who's going">
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={control}>
                <option value="">Not decided</option>
                {opts.surveyors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className={cn("flex items-center gap-2 text-[13px]", !opts.hasEmail && "text-subtle")}>
              <input type="checkbox" checked={emailClient} disabled={!opts.hasEmail} onChange={(e) => setEmailClient(e.target.checked)} className="size-4" />
              {opts.hasEmail ? "Email them a confirmation with a calendar invite" : "No email address, so no confirmation email"}
            </label>
            {error && <p className="text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {stageMove && !opts.current && (
                <Button variant="secondary" onClick={moveOnly} disabled={pending}>
                  Move without a date
                </Button>
              )}
              <Button onClick={save} disabled={pending || !day}>
                {pending ? "Saving…" : opts.current ? "Move the visit" : "Book the visit"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The lead page's visit card: when, who, how it was booked; book, move, cancel, or send the booking link. */
export function SurveyCard({
  leadId,
  name,
  visit,
  canEdit,
  hasEmail,
}: {
  leadId: string;
  name: string;
  visit: { when: string; who: string | null; online: boolean; past: boolean } | null;
  canEdit: boolean;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  const cancel = () =>
    startTransition(async () => {
      if (!window.confirm(hasEmail && !visit?.past ? "Cancel this visit? They'll get an email saying so." : "Cancel this visit?")) return;
      const r = await cancelSurveyAction(leadId, hasEmail);
      if (!r.ok) setError(r.message);
      router.refresh();
    });

  const copy = () =>
    startTransition(async () => {
      const r = await bookingLinkAction(leadId);
      if (!r.ok) return setError(r.message);
      await navigator.clipboard.writeText(r.link).catch(() => window.prompt("Copy the booking link", r.link));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });

  return (
    <section className="rounded-[12px] bg-white p-4 shadow-ring">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <CalendarCheck2 className="size-4 text-ink-2" />
        Survey visit
      </h2>
      {visit ? (
        <p className="text-[13px]">
          <span className="font-medium">{visit.when}</span>
          <span className="block text-ink-2">
            {[visit.who ?? "Nobody assigned", visit.online ? "booked online" : null].filter(Boolean).join(" · ")}
          </span>
        </p>
      ) : (
        <p className="text-[13px] text-ink-2">Not booked.</p>
      )}
      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button onClick={() => setOpen(true)} disabled={pending}>
            {visit && !visit.past ? "Move" : "Book a visit"}
          </Button>
          {visit && !visit.past && (
            <Button variant="ghost" onClick={cancel} disabled={pending}>
              Cancel it
            </Button>
          )}
          <Button variant="secondary" onClick={copy} disabled={pending} title="So they can pick a time themselves">
            {copied ? <Copy /> : <Link2 />}
            {copied ? "Copied" : "Booking link"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      {open && <SurveyDialog leadId={leadId} name={name} onClose={() => setOpen(false)} />}
    </section>
  );
}
