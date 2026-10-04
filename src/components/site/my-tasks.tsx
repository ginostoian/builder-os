"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pause, Play } from "lucide-react";
import { setMyTaskStatusAction } from "@/app/m/actions";
import type { TaskStatus } from "@/core/projects";
import { cn } from "@/lib/utils";

export type MyTask = { id: string; title: string; notes: string | null; status: TaskStatus; when: string | null; late: boolean; projectId: string; projectName: string; phaseName: string | null };

/** My tasks: tap the box when it's done; start it, or say why it's waiting. Big targets for site use. */
export function MyTasks({ tasks, showJob }: { tasks: MyTask[]; showJob: boolean }) {
  if (tasks.length === 0) return <p className="rounded-2xl bg-white px-4 py-5 text-center text-subtle shadow-ring">Nothing on your list. Ask the office if you&apos;re not sure what&apos;s next.</p>;
  return (
    <ul className="overflow-hidden rounded-2xl bg-white shadow-ring">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} showJob={showJob} />
      ))}
    </ul>
  );
}

function TaskRow({ task, showJob }: { task: MyTask; showJob: boolean }) {
  const router = useRouter();
  const [status, setStatus] = React.useOptimistic(task.status);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  const change = (next: TaskStatus, why?: string) =>
    startTransition(async () => {
      setStatus(next);
      setError(undefined);
      const r = await setMyTaskStatusAction(task.id, next, why);
      if (!r.ok) {
        setError(r.message);
      } else {
        setAsking(false);
        setReason("");
        router.refresh();
      }
    });
  const done = status === "done";
  const meta = [showJob ? task.projectName : null, task.phaseName, task.when].filter(Boolean).join(" · ");

  return (
    <li className="border-b border-line last:border-0">
      <div className="flex min-h-[60px] items-center gap-1 pr-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          disabled={pending}
          onClick={() => change(done ? "in_progress" : "done")}
          className="flex size-[52px] flex-none items-center justify-center"
        >
          <span className={cn("flex size-[24px] items-center justify-center rounded-[7px] text-white", done ? "bg-success" : "bg-white shadow-[inset_0_0_0_1.5px_#D6D5CF]")}>
            <Check className="size-[14px]" />
          </span>
        </button>
        <div className="min-w-0 flex-1 py-2">
          <div className={cn("font-medium", done && "text-subtle line-through")}>{task.title}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
            {showJob ? (
              <Link href={`/m/jobs/${task.projectId}`} className="underline-offset-2 hover:underline">
                {meta}
              </Link>
            ) : (
              meta
            )}
            {task.late && !done && <span className="font-medium text-danger">late</span>}
            {status === "in_progress" && <span className="font-medium text-info">in progress</span>}
            {status === "waiting" && <span className="font-medium text-warning">waiting</span>}
          </div>
        </div>
        {!done && status !== "in_progress" && (
          <button type="button" disabled={pending} onClick={() => change("in_progress")} aria-label="Start" className="flex size-11 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-accent">
            <Play className="size-4" />
          </button>
        )}
        {!done && status !== "waiting" && (
          <button type="button" disabled={pending} onClick={() => setAsking((a) => !a)} aria-label="Waiting on something" aria-expanded={asking} className="flex size-11 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-accent">
            <Pause className="size-4" />
          </button>
        )}
      </div>
      {asking && (
        <form
          className="flex gap-2 px-3.5 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            change("waiting", reason);
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Waiting on what? e.g. plasterboard delivery"
            className="h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-[15px] shadow-ring-input outline-none"
          />
          <button type="submit" disabled={pending} className="h-11 flex-none rounded-xl bg-ink px-4 font-semibold text-white disabled:opacity-60">
            Save
          </button>
        </form>
      )}
      {task.notes && status === "waiting" && !asking && <p className="line-clamp-2 px-[52px] pb-2 text-xs whitespace-pre-line text-ink-2">{task.notes.split("\n").at(-1)}</p>}
      {error && <p className="px-[52px] pb-2 text-[13px] text-danger">{error}</p>}
    </li>
  );
}
