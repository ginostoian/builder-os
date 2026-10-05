"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Lock, RotateCcw } from "lucide-react";
import type { ChapterState, StepState } from "@/core/onboarding";
import { PLAN_LABEL, planFor } from "@/core/plans";
import { onboardingAction } from "@/app/onboarding-actions";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./progress-ring";
import { STEP_GUIDES as HELP } from "@/lib/content/help/step-guides";

/**
 * The guide's chapters and steps. Each chapter is a level; the one you're on opens by default. A step
 * explains why it matters and how it works, links to where you do it, and ticks itself off once done.
 */
export function GuideChapters({ chapters, onNavigate }: { chapters: ChapterState[]; onNavigate?: () => void }) {
  const current = chapters.find((c) => !c.locked && !c.complete)?.id ?? null;
  const [open, setOpen] = React.useState<string | null>(current);
  return (
    <ol className="flex flex-col gap-2">
      {chapters.map((c, i) => {
        const isOpen = open === c.id;
        return (
          <li key={c.id} className={cn("rounded-[10px] bg-white shadow-ring", c.id === current && "shadow-[0_0_0_1.5px_var(--color-brand)]")}>
            <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
              <span
                className={cn(
                  "flex size-8 flex-none items-center justify-center rounded-full text-[12px] font-semibold",
                  c.complete ? "bg-success text-white" : c.locked ? "bg-surface text-faint-2" : c.id === current ? "bg-brand text-white" : "bg-surface text-ink-2",
                )}
              >
                {c.complete ? <Check className="size-4" strokeWidth={2.5} /> : c.locked ? <Lock className="size-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{c.title}</span>
                  {c.id === current && <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10.5px] font-medium text-brand">You&apos;re here</span>}
                </span>
                <span className="block text-[12px] text-subtle">{c.locked ? `Unlocks with ${PLAN_LABEL[planFor(c.steps[0].feature!)]}` : c.summary}</span>
              </span>
              {!c.locked && (
                <span className="flex items-center gap-1.5 text-[12px] text-subtle tabular">
                  {c.done}/{c.total}
                  <ChapterRing value={c.total ? (c.done / c.total) * 100 : 0} done={c.complete} />
                </span>
              )}
              <ChevronDown className={cn("size-4 flex-none text-subtle transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <ul className="border-t border-line px-2 py-1.5">
                {c.steps.map((s) => (
                  <StepItem key={s.id} step={s} onNavigate={onNavigate} />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ChapterRing({ value, done }: { value: number; done: boolean }) {
  return <ProgressRing percent={value} size={16} stroke={2.25} className={done ? "text-success" : "text-brand"} />;
}

function StepItem({ step, onNavigate }: { step: StepState; onNavigate?: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(step.state === "todo");
  const [pending, startTransition] = React.useTransition();
  const finished = step.state === "done" || step.state === "skipped";
  const toggleSkip = () =>
    startTransition(async () => {
      await onboardingAction({ op: step.state === "skipped" ? "unskip" : "skip", step: step.id });
      router.refresh();
    });
  return (
    <li className="rounded-lg">
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-surface">
        <span
          className={cn(
            "flex size-[18px] flex-none items-center justify-center rounded-full",
            step.state === "done" ? "bg-success text-white" : step.state === "skipped" ? "bg-line text-subtle" : step.state === "locked" ? "text-faint-2" : "shadow-[inset_0_0_0_1.5px_var(--color-faint)]",
          )}
        >
          {step.state === "done" ? <Check className="size-3" strokeWidth={3} /> : step.state === "skipped" ? <ArrowRight className="size-3" /> : step.state === "locked" ? <Lock className="size-3" /> : null}
        </span>
        <span className={cn("flex-1", finished && "text-subtle", step.state === "done" && "line-through decoration-faint")}>{step.title}</span>
        {step.state === "skipped" && <span className="text-[11px] text-subtle">Skipped</span>}
        {step.state === "locked" && step.feature && <span className="text-[11px] text-subtle">{PLAN_LABEL[planFor(step.feature)]}</span>}
      </button>
      {expanded && (
        <div className="mb-2 ml-[34px] mr-1.5">
          <p className="text-[12.5px] text-ink-2">{step.why}</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-ink-2">
            {step.how.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="mt-[7px] size-1 flex-none rounded-full bg-faint-2" />
                {h}
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center gap-2">
            {step.state === "locked" ? (
              <Link href="/app/settings/billing" onClick={onNavigate} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12px] font-medium text-white hover:bg-ink/90">
                See plans
              </Link>
            ) : (
              <Link
                href={step.href}
                onClick={onNavigate}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium",
                  finished ? "bg-white text-ink shadow-ring hover:bg-surface" : "bg-ink text-white hover:bg-ink/90",
                )}
              >
                {step.cta}
                <ArrowRight className="size-3" />
              </Link>
            )}
            {HELP[step.id] && (
              <a href={`/help/${HELP[step.id]}`} target="_blank" rel="noopener" className="inline-flex h-7 items-center rounded-md px-2 text-[12px] text-ink-2 underline-offset-2 hover:bg-surface hover:text-ink hover:underline">
                Read the guide
              </a>
            )}
            {(step.state === "todo" || step.state === "skipped") && (
              <button type="button" onClick={toggleSkip} disabled={pending} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-60">
                {step.state === "skipped" ? (
                  <>
                    <RotateCcw className="size-3" />
                    Put it back
                  </>
                ) : (
                  "Skip, not for us"
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
