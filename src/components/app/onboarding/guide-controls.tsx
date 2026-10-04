"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, PlayCircle, RotateCcw } from "lucide-react";
import { onboardingAction } from "@/app/onboarding-actions";
import { Button } from "@/components/ui/button";
import { startTour } from "./events";

/** Replay the tour, show or hide the checklist in the top bar, and bring back skipped steps. */
export function GuideControls({ hidden, hasSkipped }: { hidden: boolean; tourDone: boolean; hasSkipped: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (op: "show" | "hide" | "reset_skipped") =>
    startTransition(async () => {
      await onboardingAction({ op });
      router.refresh();
    });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button onClick={startTour}>
        <PlayCircle />
        Replay the tour
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => run(hidden ? "show" : "hide")}>
        {hidden ? <Eye /> : <EyeOff />}
        {hidden ? "Show the checklist in the top bar" : "Hide the checklist from the top bar"}
      </Button>
      {hasSkipped && (
        <Button variant="ghost" disabled={pending} onClick={() => run("reset_skipped")}>
          <RotateCcw />
          Bring back skipped steps
        </Button>
      )}
    </div>
  );
}
