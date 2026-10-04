"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { TASK_STATUSES, TASK_STATUS_LABEL, isLate, progress, type TaskStatus } from "@/core/projects";
import { cn } from "@/lib/utils";
import { control } from "../form-fields";
import { QuickAdd } from "./task-board";
import { TASK_DOT, shortDay, type Phase, type Task } from "./types";

/**
 * Tasks grouped by stage, in order: the checklist view. Tick to finish, change status inline, click a task
 * to edit it. Stages can be added, renamed, reordered and removed here.
 */
export function TaskList({
  tasks,
  phases,
  today,
  canEdit,
  onOpen,
  onStatus,
  onQuickAdd,
  onPhase,
}: {
  tasks: Task[];
  phases: Phase[];
  today: string;
  canEdit: boolean;
  onOpen: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onQuickAdd: (phaseId: string | null, title: string) => Promise<boolean>;
  onPhase: (op: { kind: "add"; name: string } | { kind: "rename"; id: string; name: string } | { kind: "move"; id: string; dir: -1 | 1 } | { kind: "delete"; id: string }) => Promise<boolean>;
}) {
  const [hideDone, setHideDone] = React.useState(false);
  const groups = [
    ...phases.map((p) => ({ phase: p as Phase | null, tasks: tasks.filter((t) => t.phaseId === p.id) })),
    { phase: null, tasks: tasks.filter((t) => !t.phaseId || !phases.some((p) => p.id === t.phaseId)) },
  ].filter((g) => g.phase !== null || g.tasks.length > 0);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2 px-4 py-4 lg:px-6">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-ink-2">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Hide finished tasks
          </label>
          <span className="text-[12px] text-subtle">
            {tasks.filter((t) => t.status === "done").length} of {tasks.length} done
          </span>
        </div>
        {groups.map((g, gi) => (
          <PhaseGroup
            key={g.phase?.id ?? "none"}
            phase={g.phase}
            first={gi === 0}
            last={g.phase !== null && gi === phases.length - 1}
            tasks={hideDone ? g.tasks.filter((t) => t.status !== "done") : g.tasks}
            all={g.tasks}
            today={today}
            canEdit={canEdit}
            onOpen={onOpen}
            onStatus={onStatus}
            onQuickAdd={(title) => onQuickAdd(g.phase?.id ?? null, title)}
            onPhase={onPhase}
          />
        ))}
        {canEdit && <AddPhase onAdd={(name) => onPhase({ kind: "add", name })} />}
      </div>
    </div>
  );
}

function PhaseGroup({
  phase,
  first,
  last,
  tasks,
  all,
  today,
  canEdit,
  onOpen,
  onStatus,
  onQuickAdd,
  onPhase,
}: {
  phase: Phase | null;
  first: boolean;
  last: boolean;
  tasks: Task[];
  all: Task[];
  today: string;
  canEdit: boolean;
  onOpen: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onQuickAdd: (title: string) => Promise<boolean>;
  onPhase: Parameters<typeof TaskList>[0]["onPhase"];
}) {
  const p = progress(all);
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(phase?.name ?? "");
  const [menu, setMenu] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  return (
    <section className="overflow-hidden rounded-[12px] bg-white shadow-ring">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-2.5">
        {renaming && phase ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (name.trim() && (await onPhase({ kind: "rename", id: phase.id, name: name.trim() }))) setRenaming(false);
            }}
          >
            <input autoFocus value={name} maxLength={TEXT.name} onChange={(e) => setName(e.target.value)} className={cn(control, "max-w-[360px]")} />
            <Button type="submit" variant="secondary">
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <h3 className="min-w-0 flex-1 truncate font-semibold">{phase?.name ?? "No stage"}</h3>
        )}
        {!renaming && (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-success" style={{ width: `${p.percent}%` }} />
              </div>
              <span className="w-12 text-right text-[12px] text-subtle tabular">
                {p.done}/{p.total}
              </span>
            </div>
            {canEdit && phase && (
              <div className="relative">
                <button type="button" aria-label={`Stage options for ${phase.name}`} onClick={() => setMenu((m) => !m)} onBlur={() => setTimeout(() => (setMenu(false), setConfirmDelete(false)), 150)} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-muted hover:text-ink">
                  <MoreHorizontal className="size-4" />
                </button>
                {menu && (
                  <div className="absolute top-8 right-0 z-20 flex w-[200px] flex-col rounded-[10px] bg-white p-1 shadow-pop">
                    <MenuItem icon={Pencil} label="Rename" onSelect={() => (setMenu(false), setName(phase.name), setRenaming(true))} />
                    <MenuItem icon={ArrowUp} label="Move up" disabled={first} onSelect={() => (setMenu(false), void onPhase({ kind: "move", id: phase.id, dir: -1 }))} />
                    <MenuItem icon={ArrowDown} label="Move down" disabled={last} onSelect={() => (setMenu(false), void onPhase({ kind: "move", id: phase.id, dir: 1 }))} />
                    <MenuItem
                      icon={Trash2}
                      label={confirmDelete ? "Click again to delete" : "Delete stage"}
                      danger
                      onSelect={() => {
                        if (!confirmDelete) return setConfirmDelete(true);
                        setMenu(false);
                        void onPhase({ kind: "delete", id: phase.id });
                      }}
                    />
                    <p className="px-2 pt-1 pb-1.5 text-[11px] text-subtle">Deleting a stage keeps its tasks, without a stage.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </header>
      <ul>
        {tasks.map((t) => {
          const late = isLate(t, today);
          return (
            <li key={t.id} className="flex items-center gap-3 border-b border-muted px-4 py-2 last:border-b-0 hover:bg-surface-2">
              <button
                type="button"
                disabled={!canEdit}
                aria-label={t.status === "done" ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                onClick={() => onStatus(t, t.status === "done" ? "todo" : "done")}
                className={cn("grid size-5 flex-none place-items-center rounded-[6px] border", t.status === "done" ? "border-success bg-success text-white" : "border-faint-2 bg-white hover:border-ink")}
              >
                {t.status === "done" && <Check className="size-3.5" strokeWidth={3} />}
              </button>
              <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                <span className={cn("block truncate", t.status === "done" && "text-subtle line-through decoration-faint-2")}>{t.title}</span>
                {(t.workerName || t.trade) && <span className="block truncate text-[11.5px] text-subtle">{[t.workerName, t.trade].filter(Boolean).join(" · ")}</span>}
              </button>
              <span className={cn("w-[120px] flex-none text-right text-[12px] tabular", late ? "font-medium text-danger" : "text-subtle")}>
                {t.startDate && t.dueDate && t.startDate !== t.dueDate ? `${shortDay(t.startDate)} – ${shortDay(t.dueDate)}` : t.dueDate ? shortDay(t.dueDate) : t.startDate ? `from ${shortDay(t.startDate)}` : ""}
                {late && " · late"}
              </span>
              <div className="relative w-[124px] flex-none">
                <span className={cn("pointer-events-none absolute top-1/2 left-2.5 size-2 -translate-y-1/2 rounded-full", TASK_DOT[t.status])} />
                <select aria-label="Status" value={t.status} disabled={!canEdit} onChange={(e) => onStatus(t, e.target.value as TaskStatus)} className={cn(control, "h-7 pl-6 text-[12.5px]")}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
        {tasks.length === 0 && all.length > 0 && <li className="px-4 py-2.5 text-[12.5px] text-subtle">All finished.</li>}
      </ul>
      {canEdit && (
        <div className="px-2 py-1.5">
          <QuickAdd placeholder={phase ? `Add a task to ${phase.name}…` : "Add a task…"} onAdd={onQuickAdd} />
        </div>
      )}
    </section>
  );
}

function MenuItem({ icon: Icon, label, onSelect, disabled, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40", danger && "text-danger")}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function AddPhase({ onAdd }: { onAdd: (name: string) => Promise<boolean> }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus />
          Add stage
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim() && (await onAdd(name.trim()))) {
          setName("");
          setOpen(false);
        }
      }}
    >
      <input autoFocus value={name} maxLength={TEXT.name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Second fix, Decorating, Snagging" className={cn(control, "max-w-[360px]")} />
      <Button type="submit">Add stage</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
