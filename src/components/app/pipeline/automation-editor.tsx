"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Plus, Send, Trash2, X } from "lucide-react";
import { deleteAutomationAction, saveAutomationAction, sendTestAction } from "@/app/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import {
  AUTOMATION_TRIGGERS,
  LEAD_STAGES,
  LEAD_STAGE_LABEL,
  MAX_AUTOMATION_STEPS,
  MERGE_FIELDS,
  fillMergeFields,
  triggerLabel,
  unknownMergeFields,
  type AutomationStep,
  type AutomationTrigger,
  type LeadStage,
} from "@/core/pipeline";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import { AutomationSwitch } from "./automation-toggles";

const SAMPLE = Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample]));

/**
 * Write an automation: what starts it, and its emails (each sent some days after the one before). Merge
 * fields fill in the lead's details; preview shows an example, and "send me a test" emails it to you.
 */
export function AutomationEditor({
  automation,
  company,
  emailEnabled,
}: {
  automation: { id: string; name: string; enabled: boolean; trigger: AutomationTrigger; stage: LeadStage | null; steps: AutomationStep[] } | null;
  company: string;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(automation?.name ?? "");
  const [trigger, setTrigger] = React.useState<AutomationTrigger>(automation?.trigger ?? "stage_entered");
  const [stage, setStage] = React.useState<LeadStage>(automation?.stage ?? "quote_sent");
  const [steps, setSteps] = React.useState<AutomationStep[]>(automation?.steps ?? [{ id: crypto.randomUUID(), delayDays: 0, subject: "", body: "Hi {{first_name}},\n\n\n\nThanks,\n{{my_name}}\n{{company}}" }]);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const sample = { ...SAMPLE, company };

  const update = (i: number, patch: Partial<AutomationStep>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const moveStep = (i: number, d: -1 | 1) =>
    setSteps((s) => {
      const next = [...s];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const unknown = unknownMergeFields(steps.map((s) => s.subject + s.body).join(" "));
  const elapsed = steps.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s.delayDays], []);

  const save = () =>
    startTransition(async () => {
      setMessage(undefined);
      const r = await saveAutomationAction(automation?.id ?? null, {
        name: name.trim(),
        trigger,
        stage: trigger === "stage_entered" ? stage : undefined,
        steps: steps.map((s) => ({ ...s, subject: s.subject.trim(), delayDays: Math.max(0, Math.min(365, Math.round(s.delayDays) || 0)) })),
      });
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      if (!automation && r.id) return router.replace(`/app/pipeline/automations/${r.id}`);
      setMessage({ ok: true, text: "Saved" });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-[12px] bg-white p-5 shadow-ring">
        <div className="flex items-start gap-4">
          <Field label="Name" className="flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={TEXT.name} placeholder="e.g. Follow up a sent quote" className={control} />
          </Field>
          {automation && (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[12.5px] font-medium">{automation.enabled ? "On" : "Off"}</span>
              <AutomationSwitch id={automation.id} enabled={automation.enabled} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Starts">
            <select value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)} className={control}>
              {AUTOMATION_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t === "stage_entered" ? "When a lead moves to a stage" : triggerLabel(t, null)}
                </option>
              ))}
            </select>
          </Field>
          {trigger === "stage_entered" && (
            <Field label="Stage">
              <select value={stage} onChange={(e) => setStage(e.target.value as LeadStage)} className={control}>
                {LEAD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <p className="text-[12.5px] text-ink-2">
          {trigger === "stage_entered"
            ? `Emails stop as soon as the lead leaves ${LEAD_STAGE_LABEL[stage]} (for example, when they accept the quote).`
            : "Emails stop as soon as the lead moves past New enquiry (for example, once you've spoken to them)."}{" "}
          Leads without an email address, or who unsubscribed, are skipped. Same-day emails go at once; later ones go out at the start of the working day.
        </p>
      </section>

      {steps.map((s, i) => {
        return (
          <StepCard
            key={s.id}
            index={i}
            step={s}
            elapsed={elapsed[i]}
            count={steps.length}
            sample={sample}
            emailEnabled={emailEnabled}
            onChange={(patch) => update(i, patch)}
            onMove={(d) => moveStep(i, d)}
            onRemove={() => setSteps((x) => x.filter((_, j) => j !== i))}
          />
        );
      })}
      {steps.length < MAX_AUTOMATION_STEPS && (
        <button
          type="button"
          onClick={() => setSteps((x) => [...x, { id: crypto.randomUUID(), delayDays: 3, subject: "", body: "Hi {{first_name}},\n\n\n\n{{my_name}}" }])}
          className="flex items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-faint py-3 text-ink-2 hover:bg-white hover:text-ink"
        >
          <Plus className="size-4" />
          Add another email
        </button>
      )}

      {unknown.length > 0 && <p className="text-[12.5px] text-warning">Not a merge field: {unknown.map((u) => `{{${u}}}`).join(", ")}. It will be left blank.</p>}
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-hairline bg-surface-2 py-3">
        {automation && (
          <Button variant="ghost" disabled={pending} onClick={() => window.confirm("Delete this automation? Leads in it stop getting its emails.") && startTransition(async () => void (await deleteAutomationAction(automation.id)))}>
            <Trash2 />
            Delete
          </Button>
        )}
        <span className={cn("flex-1 text-[12.5px]", message?.ok ? "text-success" : "text-danger")}>{message?.text}</span>
        <Button onClick={save} disabled={pending || !name.trim() || steps.length === 0}>
          {pending ? "Saving…" : automation ? "Save changes" : "Create (switched off)"}
        </Button>
      </div>
    </div>
  );
}

function StepCard({
  index,
  step,
  elapsed,
  count,
  sample,
  emailEnabled,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  step: AutomationStep;
  elapsed: number;
  count: number;
  sample: Record<string, string>;
  emailEnabled: boolean;
  onChange: (patch: Partial<AutomationStep>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = React.useState(false);
  const [test, setTest] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const area = React.useRef<HTMLTextAreaElement>(null);
  const insert = (key: string) => {
    const el = area.current;
    const token = `{{${key}}}`;
    const at = el?.selectionStart ?? step.body.length;
    onChange({ body: step.body.slice(0, at) + token + step.body.slice(el?.selectionEnd ?? at) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  return (
    <section className="rounded-[12px] bg-white shadow-ring">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="font-semibold">Email {index + 1}</span>
        <span className="text-[12.5px] text-ink-2">sent</span>
        <input
          type="number"
          min={0}
          max={365}
          value={step.delayDays}
          onChange={(e) => onChange({ delayDays: Number(e.target.value) })}
          aria-label="Days to wait"
          className={cn(control, "w-16 text-right tabular")}
        />
        <span className="text-[12.5px] text-ink-2">
          {step.delayDays === 0 ? (index === 0 ? "days after it starts (straight away)" : "days after the last one (same day)") : `day${step.delayDays === 1 ? "" : "s"} after ${index === 0 ? "it starts" : "the last one"}`}
          <span className="text-subtle"> · day {elapsed}</span>
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => setPreview((p) => !p)} className={cn("flex items-center gap-1 rounded px-2 py-1 text-[12px]", preview ? "bg-ink text-white" : "text-ink-2 hover:bg-accent")}>
          <Eye className="size-3.5" />
          Preview
        </button>
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up" className="rounded p-1 text-subtle hover:bg-accent disabled:opacity-30">
          <ArrowUp className="size-3.5" />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down" className="rounded p-1 text-subtle hover:bg-accent disabled:opacity-30">
          <ArrowDown className="size-3.5" />
        </button>
        {count > 1 && (
          <button type="button" onClick={onRemove} aria-label="Remove this email" className="rounded p-1 text-subtle hover:bg-accent hover:text-ink">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {preview ? (
        <div className="px-4 py-3">
          <div className="text-[12px] text-subtle">Subject</div>
          <div className="font-medium">{fillMergeFields(step.subject, sample) || "(no subject)"}</div>
          <div className="mt-3 rounded-lg bg-surface px-4 py-3 whitespace-pre-line">{fillMergeFields(step.body, sample)}</div>
          <p className="mt-2 text-[11.5px] text-subtle">With example details. Every automatic email ends with an unsubscribe link.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 py-3">
          <input value={step.subject} onChange={(e) => onChange({ subject: e.target.value })} maxLength={300} placeholder="Subject" aria-label="Subject" className={control} />
          <textarea ref={area} value={step.body} onChange={(e) => onChange({ body: e.target.value })} maxLength={4000} rows={9} aria-label="Email" className={cn(control, "h-auto resize-y py-2 leading-normal")} />
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11.5px] text-subtle">Insert:</span>
            {MERGE_FIELDS.map((f) => (
              <button key={f.key} type="button" onClick={() => insert(f.key)} title={f.label} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2 hover:bg-muted">
                {`{{${f.key}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-hairline px-4 py-2">
        <span className={cn("flex-1 text-[12px]", test?.ok ? "text-success" : "text-danger")}>{test?.text}</span>
        <Button
          variant="ghost"
          disabled={pending || !emailEnabled || !step.subject.trim() || !step.body.trim()}
          title={emailEnabled ? undefined : "Email isn't set up yet"}
          onClick={() =>
            startTransition(async () => {
              const r = await sendTestAction({ subject: step.subject.trim(), body: step.body });
              setTest(r.ok ? { ok: true, text: "Sent to your email." } : { ok: false, text: r.message });
            })
          }
        >
          <Send />
          Send me a test
        </Button>
      </div>
    </section>
  );
}
