import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { GuideChapters } from "@/components/app/onboarding/guide-chapters";
import { GuideControls } from "@/components/app/onboarding/guide-controls";
import { ProgressRing } from "@/components/app/onboarding/progress-ring";
import { requirePermission } from "@/auth/session";
import { getGuide } from "@/server/onboarding";

export const metadata: Metadata = { title: "Getting started" };

/** Your getting-started guide: progress, every chapter, and the tour and checklist switches. */
export default async function GettingStartedPage() {
  await requirePermission("settings.view");
  const guide = await getGuide();
  const current = guide.chapters.filter((c) => !c.locked)[guide.level - 1];
  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Getting started"]}>
      <SettingsFrame active="guide" title="Getting started" subtitle="A guided path through Builder OS. Steps tick themselves off as you and your team work.">
        <Panel className="flex max-w-[760px] flex-wrap items-center gap-5 p-5">
          <div className="relative flex-none text-brand">
            <ProgressRing percent={guide.percent} size={72} stroke={6} />
            <span className="absolute inset-0 flex items-center justify-center text-[16px] font-semibold text-ink tabular">{guide.percent}%</span>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="text-[15px] font-semibold">{guide.complete ? "Every chapter done" : `Level ${guide.level} of ${guide.levels}${current ? `: ${current.title}` : ""}`}</div>
            <div className="mt-0.5 text-subtle">
              {guide.done} of {guide.total} steps done{guide.next ? `. Up next: ${guide.next.title.toLowerCase()}.` : "."}
            </div>
            <GuideControls hidden={guide.hidden} tourDone={guide.tourDone} hasSkipped={guide.chapters.some((c) => c.steps.some((s) => s.state === "skipped"))} />
          </div>
        </Panel>
        <div className="max-w-[760px]">
          <GuideChapters chapters={guide.chapters} />
        </div>
      </SettingsFrame>
    </LiveAppShell>
  );
}
