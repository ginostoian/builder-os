"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, FileSpreadsheet, Mail, MessageSquare, Pencil, Phone, StopCircle, Trash2, Trophy, X } from "lucide-react";
import { addNoteAction, deleteLeadAction, emailLeadAction, setFollowUpAction, setStageAction, startQuoteAction, stopRunAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { addDays } from "@/core/payment-plan";
import { FOLLOW_UP_PICKS, LEAD_STAGE_LABEL, MERGE_FIELDS, OPEN_STAGES, followUpState, shortDate, type LeadStage } from "@/core/pipeline";
import { cn } from "@/lib/utils";
import { control } from "../form-fields";
import { shortDay } from "../projects/types";
import { LeadDialog } from "./lead-dialog";
import { StageDialog } from "./stage-dialog";
import type { LeadValues, Owner } from "./types";

/** The stage track: click a stage to move there; Won and Lost close the lead. */
export function StageTrack({ leadId, name, stage, visitAt, canEdit }: { leadId: string; name: string; stage: LeadStage; visitAt: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"lost" | "site_visit" | null>(null);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const go = (s: LeadStage) => {
    if (!canEdit || s === stage) return;
    if (s === "lost" || s === "site_visit") return setDialog(s);
    startTransition(async () => {
      const r = await setStageAction(leadId, { stage: s });
      if (!r.ok) setError(r.message);
      router.refresh();
    });
  };
  const at = OPEN_STAGES.indexOf(stage as (typeof OPEN_STAGES)[number]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <ol className="flex overflow-hidden rounded-lg shadow-ring">
          {OPEN_STAGES.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={!canEdit || pending}
                onClick={() => go(s)}
                aria-current={s === stage ? "step" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 border-r border-hairline px-3 text-[12.5px] last:border-0",
                  s === stage ? "bg-ink font-medium text-white" : at >= 0 && i < at ? "bg-surface text-ink-2" : "bg-white text-subtle hover:text-ink",
                )}
              >
                {LEAD_STAGE_LABEL[s]}
              </button>
            </li>
          ))}
        </ol>
        {canEdit && (
          <>
            <Button variant={stage === "won" ? "primary" : "secondary"} onClick={() => go("won")} disabled={pending}>
              <Trophy />
              Won
            </Button>
            <Button variant={stage === "lost" ? "primary" : "ghost"} onClick={() => go("lost")} disabled={pending}>
              Lost
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      {dialog && <StageDialog leadId={leadId} name={name} target={dialog} visitAt={visitAt} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** What's next and when: one tap for the usual follow-ups. */
export function FollowUp({ leadId, on, action, today, canEdit }: { leadId: string; on: string | null; action: string | null; today: string; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = React.useState(action ?? "Call back");
  const [date, setDate] = React.useState(on ?? "");
  const [pending, startTransition] = React.useTransition();
  const state = followUpState(on, today);
  const save = (d: string | null) =>
    startTransition(async () => {
      await setFollowUpAction(leadId, { on: d, action: d ? text.trim() || undefined : undefined });
      setDate(d ?? "");
      router.refresh();
    });
  return (
    <section className="rounded-[12px] bg-white p-4 shadow-ring">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <CalendarClock className="size-4 text-ink-2" />
        Next step
      </h2>
      <p className={cn("text-[13px]", state === "overdue" ? "font-medium text-danger" : state === "today" ? "font-medium text-warning" : "text-ink-2")}>
        {on ? `${action ?? "Follow up"}: ${on === today ? "today" : state === "overdue" ? `overdue since ${shortDay(on)}` : shortDay(on)}` : "Nothing planned."}
      </p>
      {canEdit && (
        <div className="mt-3 flex flex-col gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="e.g. Call back, Chase the quote" aria-label="Next step" className={control} />
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_PICKS.map((p) => (
              <button key={p.label} type="button" disabled={pending} onClick={() => save(addDays(today, p.days))} className="rounded-full bg-surface px-2.5 py-1 text-[12px] text-ink-2 hover:bg-muted hover:text-ink">
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Follow-up date" className={control} />
            <Button variant="secondary" disabled={pending || !date} onClick={() => save(date)}>
              Set
            </Button>
            {on && (
              <Button variant="ghost" disabled={pending} onClick={() => save(null)} aria-label="Clear the follow-up">
                <X />
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Log a call, add a note, or email them (with merge fields). Everything lands in the timeline. */
export function Composer({ leadId, email, emailEnabled, canEdit }: { leadId: string; email: string | null; emailEnabled: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"note" | "call" | "email">("note");
  const [body, setBody] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const area = React.useRef<HTMLTextAreaElement>(null);
  if (!canEdit) return null;
  const canEmail = Boolean(email) && emailEnabled;
  const insert = (key: string) => {
    const el = area.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const at = el.selectionStart ?? body.length;
    setBody(body.slice(0, at) + token + body.slice(el.selectionEnd ?? at));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const submit = () =>
    startTransition(async () => {
      setMessage(undefined);
      const r = tab === "email" ? await emailLeadAction(leadId, { subject: subject.trim(), body }) : await addNoteAction(leadId, { kind: tab, body: body.trim() });
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      setBody("");
      setSubject("");
      setMessage({ ok: true, text: tab === "email" ? `Sent to ${email}.` : "Added." });
      router.refresh();
    });
  const tabs = [
    { key: "note" as const, label: "Note", icon: MessageSquare },
    { key: "call" as const, label: "Log a call", icon: Phone },
    { key: "email" as const, label: "Email", icon: Mail },
  ];
  return (
    <section className="rounded-[12px] bg-white shadow-ring">
      <div className="flex gap-1 border-b border-hairline px-2 pt-2">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[12.5px] font-medium", tab === t.key ? "border-ink text-ink" : "border-transparent text-subtle hover:text-ink-2")}>
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-col gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {tab === "email" && !canEmail ? (
          <p className="py-2 text-[12.5px] text-subtle">{!email ? "Add their email address to email them from here." : "Email isn't set up yet. Use your own email app for now, then log it as a note."}</p>
        ) : (
          <>
            {tab === "email" && <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="Subject" aria-label="Subject" className={control} />}
            <textarea
              ref={area}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={tab === "email" ? 6 : 3}
              maxLength={tab === "email" ? 4000 : 2000}
              placeholder={tab === "call" ? "What did you talk about?" : tab === "email" ? "Hi {{first_name}}, …" : "Anything worth remembering"}
              className={cn(control, "h-auto resize-y py-2 leading-normal")}
            />
            {tab === "email" && (
              <div className="flex flex-wrap gap-1">
                {MERGE_FIELDS.map((f) => (
                  <button key={f.key} type="button" onClick={() => insert(f.key)} title={f.label} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2 hover:bg-muted">
                    {`{{${f.key}}}`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={cn("flex-1 text-[12.5px]", message?.ok ? "text-success" : "text-danger")}>{message?.text}</span>
              <Button type="submit" disabled={pending || !body.trim() || (tab === "email" && !subject.trim())}>
                {pending ? "Saving…" : tab === "email" ? "Send email" : tab === "call" ? "Log call" : "Add note"}
              </Button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

export function QuoteCard({ leadId, quote, canQuote }: { leadId: string; quote: { id: string; ref: string; status: string; title: string } | null; canQuote: boolean }) {
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <section className="rounded-[12px] bg-white p-4 shadow-ring">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <FileSpreadsheet className="size-4 text-ink-2" />
        Quote
      </h2>
      {quote ? (
        <Link href={`/app/quotes/${quote.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 hover:bg-muted">
          <span className="min-w-0">
            <span className="block truncate font-medium">{quote.title}</span>
            <span className="font-mono text-[12px] text-subtle">{quote.ref}</span>
          </span>
          <span className="text-[12px] text-ink-2 capitalize">{quote.status}</span>
        </Link>
      ) : (
        <>
          <p className="text-[12.5px] text-subtle">Start the quote from here: it uses their details and moves the lead to Quoting. When you send it, follow-ups can start on their own.</p>
          {canQuote && (
            <Button
              className="mt-2 w-full"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await startQuoteAction(leadId);
                  if (r && !r.ok) setError(r.message);
                })
              }
            >
              {pending ? "Starting…" : "Start a quote"}
            </Button>
          )}
          {error && <p className="mt-1 text-[12.5px] text-danger">{error}</p>}
        </>
      )}
    </section>
  );
}

export type Run = { id: string; name: string; status: string; step: number; stepCount: number; nextAt: string | null; endedReason: string | null };

export function Automations({ leadId, runs, optedOut, hasEmail, canEdit }: { leadId: string; runs: Run[]; optedOut: boolean; hasEmail: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <section className="rounded-[12px] bg-white p-4 shadow-ring">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-semibold">Automatic emails</h2>
        <Link href="/app/pipeline/automations" className="text-[12px] text-ink-2 hover:text-ink">
          Set up
        </Link>
      </div>
      {optedOut ? (
        <p className="text-[12.5px] text-warning">They unsubscribed, so no automatic emails go to them.</p>
      ) : !hasEmail ? (
        <p className="text-[12.5px] text-subtle">No email address, so automatic emails can&apos;t go to them.</p>
      ) : runs.length === 0 ? (
        <p className="text-[12.5px] text-subtle">None running for this lead.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-[12.5px]">
              <span className={cn("mt-1.5 size-1.5 flex-none rounded-full", r.status === "active" ? "bg-success" : "bg-faint")} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.name}</span>
                <span className="block text-subtle">
                  {r.status === "active"
                    ? `${r.step} of ${r.stepCount} sent · next ${r.nextAt ? shortDate(new Date(r.nextAt)) : "soon"}`
                    : `${r.step} of ${r.stepCount} sent · ${r.endedReason?.toLowerCase() ?? r.status}`}
                </span>
              </span>
              {canEdit && r.status === "active" && (
                <button
                  type="button"
                  disabled={pending}
                  title="Stop these emails for this lead"
                  onClick={() =>
                    startTransition(async () => {
                      await stopRunAction(leadId, r.id);
                      router.refresh();
                    })
                  }
                  className="rounded p-1 text-subtle hover:bg-accent hover:text-ink"
                >
                  <StopCircle className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LeadMenu({ leadId, values, owners }: { leadId: string; values: LeadValues; owners: Owner[] }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex gap-1">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil />
        Edit details
      </Button>
      <Button
        variant="ghost"
        aria-label="Delete lead"
        disabled={pending}
        onClick={() => window.confirm("Delete this lead and its history? Their client record and quote (if any) stay.") && startTransition(async () => void (await deleteLeadAction(leadId)))}
      >
        <Trash2 />
      </Button>
      {open && <LeadDialog open onOpenChange={setOpen} leadId={leadId} initial={values} owners={owners} />}
    </div>
  );
}


