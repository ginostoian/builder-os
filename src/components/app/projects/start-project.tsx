"use client";

import * as React from "react";
import Link from "next/link";
import { SquareKanban } from "lucide-react";
import { startProjectFromQuote } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, control } from "../form-fields";

/** On an accepted quote: open its project, or start one (stages from sections, tasks from lines). */
export function StartProject({ quoteId, projectId, sections, lines }: { quoteId: string; projectId: string | null; sections: number; lines: number }) {
  const [tasks, setTasks] = React.useState(true);
  const [start, setStart] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  if (projectId) {
    return (
      <Button asChild>
        <Link href={`/app/projects/${projectId}`}>
          <SquareKanban />
          Open project
        </Link>
      </Button>
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <SquareKanban />
          Start project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Start the project</DialogTitle>
        <DialogDescription>
          The quote&apos;s {sections} section{sections === 1 ? "" : "s"} become the job&apos;s stages. Add a board, timeline, site diary and files to run it day to day.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-3.5">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={tasks} onChange={(e) => setTasks(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Turn each quote line into a task</span>
              <span className="block text-subtle">
                {lines} task{lines === 1 ? "" : "s"}, ready to assign and schedule. Untick to start with empty stages.
              </span>
            </span>
          </label>
          <Field label="Start on site" hint="Optional. You can set it later.">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={control} />
          </Field>
        </div>
        {error && <p className="mt-3 text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await startProjectFromQuote({ quoteId, tasksFromLines: tasks, startDate: start || undefined });
                if (r && !r.ok) setError(r.message);
              })
            }
          >
            {pending ? "Starting…" : "Start project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
