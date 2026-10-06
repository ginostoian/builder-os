"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addPhaseAction, addTaskAction, deletePhaseAction, movePhaseAction, moveTaskAction, renamePhaseAction, setTaskStatusAction } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/core/projects";
import { TaskBoard } from "./task-board";
import { TaskDialog, type TaskDraft } from "./task-dialog";
import { TaskList } from "./task-list";
import { TaskTimeline } from "./task-timeline";
import type { Phase, Task, Worker } from "./types";

type Change = { kind: "status"; id: string; status: TaskStatus; order?: string[] };

/**
 * The three ways to see a project's tasks (board, list, timeline) over the same data and the same task
 * dialog. Moves and ticks show at once (optimistically) and are saved in the background.
 */
export function TasksWorkspace({
  view,
  projectId,
  tasks,
  phases,
  workers,
  today,
  canEdit,
  projectStart,
  projectEnd,
}: {
  view: "board" | "list" | "timeline";
  projectId: string;
  tasks: Task[];
  phases: Phase[];
  workers: Worker[];
  today: string;
  canEdit: boolean;
  projectStart: string | null;
  projectEnd: string | null;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [editing, setEditing] = React.useState<TaskDraft | null>(null);
  const [, startTransition] = React.useTransition();
  const [shown, apply] = React.useOptimistic(tasks, (current: Task[], c: Change) => {
    const moved = current.map((t) => (t.id === c.id ? { ...t, status: c.status } : t));
    if (!c.order) return moved;
    const rank = new Map(c.order.map((id, i) => [id, i]));
    return moved.map((t) => (rank.has(t.id) ? { ...t, position: rank.get(t.id)! } : t));
  });

  const save = (change: Change, run: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      apply(change);
      const r = await run();
      if (!r.ok) setError(r.message);
      router.refresh();
    });

  const quickAdd = async (input: { title: string; status?: TaskStatus; phaseId?: string | null }) => {
    const r = await addTaskAction({ projectId, title: input.title, status: input.status ?? "todo", phaseId: input.phaseId ?? undefined });
    if (!r.ok) setError(r.message);
    router.refresh();
    return r.ok;
  };

  const phase = async (op: Parameters<React.ComponentProps<typeof TaskList>["onPhase"]>[0]) => {
    const r =
      op.kind === "add"
        ? await addPhaseAction({ projectId, name: op.name })
        : op.kind === "rename"
          ? await renamePhaseAction(projectId, op.id, op.name)
          : op.kind === "move"
            ? await movePhaseAction(projectId, op.id, op.dir)
            : await deletePhaseAction(projectId, op.id);
    if (!r.ok) setError(r.message);
    router.refresh();
    return r.ok;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(canEdit || error) && (
        <div className="flex flex-none items-center gap-3 border-b border-hairline bg-white px-4 py-2 lg:px-6">
          {error ? (
            <p role="alert" className="flex-1 text-[12.5px] text-danger">
              {error}{" "}
              <button type="button" className="underline" onClick={() => setError(undefined)}>
                Dismiss
              </button>
            </p>
          ) : (
            <p className="flex-1 text-[12.5px] text-subtle">{view === "board" ? (
                <>
                  <span className="lg:hidden">Swipe across for each column. Tap a card to change it.</span>
                  <span className="hidden lg:inline">Drag cards between columns, or click one to change it.</span>
                </>
              ) : view === "list" ? "Tick tasks off as they're done. Click one to add who and when." : "Tasks with a start or due date, week by week. Click one to change its dates."}</p>
          )}
          {canEdit && (
            <Button onClick={() => setEditing({ status: "todo" })}>
              <Plus />
              New task
            </Button>
          )}
        </div>
      )}
      {view === "board" && (
        <TaskBoard
          tasks={shown}
          phases={phases}
          today={today}
          canEdit={canEdit}
          onOpen={setEditing}
          onMove={(id, status, order) => save({ kind: "status", id, status, order }, () => moveTaskAction({ projectId, taskId: id, status, order }))}
          onQuickAdd={(status, title) => quickAdd({ title, status })}
        />
      )}
      {view === "list" && (
        <TaskList
          tasks={shown}
          phases={phases}
          today={today}
          canEdit={canEdit}
          onOpen={setEditing}
          onStatus={(t, status) => save({ kind: "status", id: t.id, status }, () => setTaskStatusAction(projectId, t.id, status))}
          onQuickAdd={(phaseId, title) => quickAdd({ title, phaseId })}
          onPhase={phase}
        />
      )}
      {view === "timeline" && <TaskTimeline tasks={shown} phases={phases} today={today} projectStart={projectStart} projectEnd={projectEnd} onOpen={setEditing} />}
      <TaskDialog projectId={projectId} phases={phases} workers={workers} task={canEdit ? editing : null} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />
    </div>
  );
}
