"use client";

import * as React from "react";
import { CalendarDays, Plus, StickyNote, User } from "lucide-react";
import { TASK_STATUSES, TASK_STATUS_LABEL, isLate, type TaskStatus } from "@/core/projects";
import { TEXT } from "@/core/limits";
import { cn } from "@/lib/utils";
import { TASK_DOT, shortDay, type Phase, type Task } from "./types";

/**
 * Tasks in columns by status. Drag a card to another column (or between cards) to move it; click it to
 * open it. On phones and tablets, where dragging is awkward, open the card and change its status instead.
 */
export function TaskBoard({
  tasks,
  phases,
  today,
  canEdit,
  onOpen,
  onMove,
  onQuickAdd,
}: {
  tasks: Task[];
  phases: Phase[];
  today: string;
  canEdit: boolean;
  onOpen: (task: Task) => void;
  onMove: (taskId: string, status: TaskStatus, order: string[]) => void;
  onQuickAdd: (status: TaskStatus, title: string) => Promise<boolean>;
}) {
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<{ status: TaskStatus; before: string | null } | null>(null);
  const phaseName = new Map(phases.map((p) => [p.id, p.name]));
  const columns = TASK_STATUSES.map((status) => ({ status, tasks: tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position) }));

  const drop = (status: TaskStatus, before: string | null) => {
    if (!dragging) return;
    const column = columns.find((c) => c.status === status)!.tasks.map((t) => t.id).filter((id) => id !== dragging);
    const at = before ? column.indexOf(before) : -1;
    const order = at < 0 ? [...column, dragging] : [...column.slice(0, at), dragging, ...column.slice(at)];
    onMove(dragging, status, order);
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-auto bg-surface-2 px-6 py-4">
      {columns.map((col) => (
        <section
          key={col.status}
          aria-label={TASK_STATUS_LABEL[col.status]}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            if (over?.status !== col.status || over.before !== null) setOver({ status: col.status, before: null });
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(col.status, over?.status === col.status ? over.before : null);
          }}
          className={cn("flex min-w-0 flex-col gap-2 rounded-xl p-1 transition-colors duration-[120ms]", dragging && over?.status === col.status && "bg-line/60")}
        >
          <div className="flex items-center gap-2 px-1 pt-0.5 pb-1">
            <span className={cn("size-2 rounded-full", TASK_DOT[col.status])} />
            <span className="font-semibold">{TASK_STATUS_LABEL[col.status]}</span>
            <span className="text-subtle">{col.tasks.length}</span>
          </div>
          {col.tasks.map((t) => {
            const late = isLate(t, today);
            return (
              <div key={t.id}>
                {dragging && over?.status === col.status && over.before === t.id && <div className="mb-2 h-1 rounded-full bg-ink/40" />}
                <button
                  type="button"
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(t.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragging || dragging === t.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (over?.before !== t.id) setOver({ status: col.status, before: t.id });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(col.status, t.id);
                  }}
                  onClick={() => onOpen(t)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-[10px] bg-white px-3 py-2.5 text-left shadow-ring transition-shadow hover:shadow-[0_0_0_1px_var(--color-faint),0_2px_6px_rgb(16_16_15/0.06)]",
                    canEdit && "cursor-grab active:cursor-grabbing",
                    dragging === t.id && "opacity-40",
                    t.status === "done" && "text-ink-2",
                  )}
                >
                  {t.phaseId && phaseName.get(t.phaseId) && <span className="truncate text-[11px] font-medium text-subtle">{phaseName.get(t.phaseId)}</span>}
                  <span className={cn("leading-snug font-medium", t.status === "done" && "line-through decoration-faint-2")}>{t.title}</span>
                  {(t.assigneeName || t.trade || t.dueDate || t.notes) && (
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-subtle">
                      {(t.assigneeName || t.trade) && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {[t.assigneeName, t.trade].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={cn("flex items-center gap-1", late && "font-medium text-danger")}>
                          <CalendarDays className="size-3" />
                          {late ? `Late · ${shortDay(t.dueDate)}` : shortDay(t.dueDate)}
                        </span>
                      )}
                      {t.notes && <StickyNote className="size-3" aria-label="Has notes" />}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {dragging && over?.status === col.status && over.before === null && <div className="h-1 rounded-full bg-ink/40" />}
          {canEdit && <QuickAdd placeholder={col.status === "todo" ? "Add a task…" : `Add to ${TASK_STATUS_LABEL[col.status].toLowerCase()}…`} onAdd={(title) => onQuickAdd(col.status, title)} />}
        </section>
      ))}
    </div>
  );
}

/** A one-line "add a task" box: type, press Enter, keep typing the next one. */
export function QuickAdd({ placeholder, onAdd, className }: { placeholder: string; onAdd: (title: string) => Promise<boolean>; className?: string }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2 text-subtle hover:bg-white hover:text-ink", className)}>
        <Plus className="size-3.5" />
        {placeholder.replace(/…$/, "")}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={text}
      disabled={busy}
      maxLength={TEXT.line}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => !text.trim() && setOpen(false)}
      onKeyDown={async (e) => {
        if (e.key === "Escape") {
          setText("");
          setOpen(false);
        }
        if (e.key === "Enter" && text.trim()) {
          e.preventDefault();
          setBusy(true);
          const ok = await onAdd(text.trim());
          setBusy(false);
          if (ok) setText("");
        }
      }}
      className={cn("h-8 w-full rounded-md bg-white px-2.5 shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)]", className)}
    />
  );
}
