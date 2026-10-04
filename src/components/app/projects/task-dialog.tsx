"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { addTaskAction, deleteTaskAction, updateTaskAction } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from "@/core/projects";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import type { Phase, Task, Worker } from "./types";

export type TaskDraft = Partial<Task> & { status: TaskStatus };

/** Create or edit one task: what, which stage, who, when, and notes. */
export function TaskDialog({
  projectId,
  phases,
  workers,
  task,
  onClose,
  onSaved,
}: {
  projectId: string;
  phases: Phase[];
  workers: Worker[];
  /** An existing task (has an id) or a draft with defaults. Null closes the dialog. */
  task: TaskDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(task?.id);
  const [form, setForm] = React.useState(() => fromTask(task));
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [lastTask, setLastTask] = React.useState(task);
  // Reset the form when a different task is opened.
  if (task !== lastTask) {
    setLastTask(task);
    setForm(fromTask(task));
    setError(undefined);
    setConfirmDelete(false);
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () =>
    startTransition(async () => {
      const input = {
        projectId,
        title: form.title.trim(),
        status: form.status,
        phaseId: form.phaseId || undefined,
        workerId: form.workerId || undefined,
        trade: form.trade.trim() || undefined,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      const r = editing ? await updateTaskAction(task!.id!, input) : await addTaskAction(input);
      if (!r.ok) return setError(r.message);
      onSaved();
      onClose();
    });

  return (
    <Dialog open={task !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle>{editing ? "Task" : "New task"}</DialogTitle>
        <DialogDescription className="sr-only">What needs doing, who does it and when.</DialogDescription>
        <form
          className="mt-3 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="What needs doing">
            <input value={form.title} onChange={set("title")} maxLength={TEXT.line} required autoFocus={!editing} placeholder="e.g. First fix electrics, kitchen" className={control} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <select value={form.phaseId} onChange={set("phaseId")} className={control}>
                <option value="">No stage</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set("status")} className={control}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Who's doing it">
              <select value={form.workerId} onChange={set("workerId")} className={control}>
                <option value="">Nobody yet</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.trade ? ` · ${w.trade}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trade" hint="e.g. Electrician. Or a firm that isn't on your team.">
              <input value={form.trade} onChange={set("trade")} maxLength={TEXT.short} className={control} />
            </Field>
            <Field label="Start">
              <input type="date" value={form.startDate} onChange={set("startDate")} className={control} />
            </Field>
            <Field label="Due" error={form.startDate && form.dueDate && form.dueDate < form.startDate ? "Before the start date" : undefined}>
              <input type="date" value={form.dueDate} min={form.startDate || undefined} onChange={set("dueDate")} className={control} />
            </Field>
          </div>
          <Field label="Notes" hint={form.status === "waiting" ? "What is it waiting for? Materials, another trade, the client…" : undefined}>
            <textarea value={form.notes} onChange={set("notes")} maxLength={TEXT.note} rows={3} className={cn(control, "h-auto resize-y py-2 leading-normal")} />
          </Field>
          {error && <p className="text-danger">{error}</p>}
          <div className="mt-1 flex items-center gap-2">
            {editing &&
              (confirmDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteTaskAction(projectId, task!.id!);
                      if (!r.ok) return setError(r.message);
                      onSaved();
                      onClose();
                    })
                  }
                >
                  <Trash2 />
                  Delete task
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                  Delete
                </Button>
              ))}
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !form.title.trim() || Boolean(form.startDate && form.dueDate && form.dueDate < form.startDate)}>
              {pending ? "Saving…" : editing ? "Save" : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fromTask(t: TaskDraft | null) {
  return {
    title: t?.title ?? "",
    status: (t?.status ?? "todo") as TaskStatus,
    phaseId: t?.phaseId ?? "",
    workerId: t?.workerId ?? "",
    trade: t?.trade ?? "",
    startDate: t?.startDate ?? "",
    dueDate: t?.dueDate ?? "",
    notes: t?.notes ?? "",
  };
}
