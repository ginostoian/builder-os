"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { archiveWorkerAction } from "@/app/app/team/actions";
import { Button } from "@/components/ui/button";

/** Mark someone as having left (their open tasks are unassigned), or bring them back. */
export function ArchiveWorker({ workerId, archived, openTasks }: { workerId: string; archived: boolean; openTasks: number }) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const run = () => {
    if (!archived && !window.confirm(openTasks > 0 ? `Mark as left? Their ${openTasks} open task${openTasks > 1 ? "s" : ""} will be unassigned.` : "Mark as left? You can bring them back later.")) return;
    startTransition(async () => {
      const r = await archiveWorkerAction(workerId, !archived);
      if (!r.ok) setError(r.message);
      else router.refresh();
    });
  };
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant={archived ? "secondary" : "ghost"} onClick={run} disabled={pending}>
        {archived ? "Bring back to the team" : "Mark as left"}
      </Button>
      {error && <span className="text-[12.5px] text-danger">{error}</span>}
    </div>
  );
}
