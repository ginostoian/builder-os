/**
 * Projects: running the job once a quote is won. A project has stages (from the quote's sections), tasks
 * in each stage, a site diary and files. Pure rules shared by the screens, the database layer and the
 * client portal: statuses and their wording, progress, and the dates a timeline needs.
 */
import { addDays } from "./payment-plan";

/** Where the job is. "Booked" is won and scheduled; "Snagging" is the finishing list before handover. */
export const PROJECT_STATUSES = ["booked", "on_site", "snagging", "complete", "on_hold"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  booked: "Booked in",
  on_site: "On site",
  snagging: "Snagging",
  complete: "Complete",
  on_hold: "On hold",
};

/** A task's column on the board. "Waiting" covers materials, another trade, the client or a decision. */
export const TASK_STATUSES = ["todo", "in_progress", "waiting", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

/** Weather on site, for the diary: the usual reason a day was lost. */
export const WEATHER = ["dry", "rain", "wind", "cold", "hot"] as const;
export type Weather = (typeof WEATHER)[number];
export const WEATHER_LABEL: Record<Weather, string> = { dry: "Dry", rain: "Rain", wind: "Windy", cold: "Cold / frost", hot: "Hot" };

export const MAX_TASKS_PER_PROJECT = 1_000;
export const MAX_PHASES_PER_PROJECT = 60;
export const MAX_DIARY_PHOTOS = 12;

/** Share of tasks done, as a whole percentage (0 with no tasks). */
export function progress(tasks: { status: string }[]): { done: number; total: number; percent: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** A task is late when it has a due date before today and isn't done. */
export const isLate = (task: { status: string; dueDate: string | null }, today: string) => task.status !== "done" && task.dueDate !== null && task.dueDate < today;

/** Days from a to b (both YYYY-MM-DD), so 2026-10-05 → 2026-10-07 is 2. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** The Monday on or before a date. Timelines are drawn in whole weeks, Monday first. */
export function startOfWeek(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

/**
 * The span a timeline should show: from the Monday before the earliest date to the Sunday after the latest,
 * at least `minWeeks` long, and always including today so "now" is on screen.
 */
export function timelineRange(dates: (string | null | undefined)[], today: string, minWeeks = 6): { start: string; days: number } {
  const known = dates.filter((d): d is string => Boolean(d)).concat(today).sort();
  const start = startOfWeek(known[0]);
  const lastMonday = startOfWeek(known[known.length - 1]);
  const weeks = Math.max(minWeeks, daysBetween(start, lastMonday) / 7 + 1);
  return { start, days: weeks * 7 };
}

/** Where a task sits on a timeline: offset and length in days, or null when it has no dates. */
export function timelineBar(task: { startDate: string | null; dueDate: string | null }, rangeStart: string): { offset: number; length: number } | null {
  const from = task.startDate ?? task.dueDate;
  const to = task.dueDate ?? task.startDate;
  if (!from || !to) return null;
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { offset: daysBetween(rangeStart, a), length: daysBetween(a, b) + 1 };
}
