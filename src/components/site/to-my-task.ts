import { shortDay } from "@/components/app/projects/types";
import { isLate } from "@/core/projects";
import type { TaskStatus } from "@/core/projects";
import type { MyTask } from "./my-tasks";

type Row = { id: string; title: string; notes: string | null; status: TaskStatus; startDate: string | null; dueDate: string | null; projectId: string; projectName: string; phaseName: string | null };

/** A task row from the database, shaped for the site app ("Mon 6 Oct – 9 Oct", late or not). */
export function toMyTask(t: Row, today: string): MyTask {
  const from = t.startDate ?? t.dueDate;
  const to = t.dueDate ?? t.startDate;
  const when = !from ? null : from === to ? (from === today ? "today" : shortDay(from)) : `${shortDay(from!)} – ${shortDay(to!)}`;
  return { id: t.id, title: t.title, notes: t.notes, status: t.status, when, late: isLate(t, today), projectId: t.projectId, projectName: t.projectName, phaseName: t.phaseName };
}

/** For today: anything on today, late, under way, waiting, or finished today. The rest is "later". */
export function isForToday(t: Row, today: string): boolean {
  if (t.status !== "todo") return true;
  if (isLate(t, today)) return true;
  const from = t.startDate ?? t.dueDate;
  const to = t.dueDate ?? t.startDate;
  return Boolean(from && to && from <= today && today <= to);
}
