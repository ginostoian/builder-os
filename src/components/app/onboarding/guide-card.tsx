"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import type { StepState } from "@/core/onboarding";
import { onboardingAction } from "@/app/onboarding-actions";
import { Panel } from "../app-shell";
import { openGuide } from "./events";
import { ProgressRing } from "./progress-ring";

/** The dashboard's getting-started card: where you are and the next thing to do. */
export function GuideCard({ percent, level, levels, chapter, next }: { percent: number; level: number; levels: number; chapter: string; next: StepState | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Panel className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <div className="relative flex-none text-brand">
        <ProgressRing percent={percent} size={52} stroke={5} />
        <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-ink tabular">{percent}%</span>
      </div>
      <div className="min-w-[200px] flex-1">
        <div className="text-[12px] text-subtle">
          Getting started · Level {level} of {levels}: {chapter}
        </div>
        <div className="mt-0.5 font-semibold">{next ? next.title : "Nearly there"}</div>
        {next && <div className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-2">{next.why}</div>}
      </div>
      <div className="flex flex-none items-center gap-1.5 max-sm:w-full max-sm:justify-end">
        <button type="button" onClick={openGuide} className="h-8 rounded-md px-3 text-ink-2 hover:bg-accent hover:text-ink">
          See all steps
        </button>
        {next && (
          <Link href={next.href} className="flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 font-medium whitespace-nowrap text-white hover:bg-ink/90">
            {next.cta}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
        <button
          type="button"
          aria-label="Hide getting started"
          title="Hide (Settings → Getting started brings it back)"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await onboardingAction({ op: "hide" });
              router.refresh();
            })
          }
          className="rounded-md p-1.5 text-subtle hover:bg-accent hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </Panel>
  );
}
