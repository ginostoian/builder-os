import type { BadgeTone } from "@/components/ui/badge";
import type { ProjectStatus, TaskStatus } from "@/core/projects";

export type Phase = { id: string; name: string; position: number };
export type Task = {
  id: string;
  phaseId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  position: number;
  workerId: string | null;
  workerName: string | null;
  trade: string | null;
  startDate: string | null;
  dueDate: string | null;
};
export type Member = { id: string; name: string; role: string };
/** Someone a task can be given to (with or without a login). */
export type Worker = { id: string; name: string; trade: string | null; kind: string };

export const PROJECT_TONE: Record<ProjectStatus, BadgeTone> = { booked: "blue", on_site: "green", snagging: "amber", complete: "muted", on_hold: "grey" };
export const TASK_TONE: Record<TaskStatus, BadgeTone> = { todo: "grey", in_progress: "blue", waiting: "amber", done: "green" };
/** Column dot / timeline bar colour per task status. */
export const TASK_DOT: Record<TaskStatus, string> = { todo: "bg-faint", in_progress: "bg-info", waiting: "bg-warning", done: "bg-success" };

/** "Mon 6 Oct" style date for compact places. */
export const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
/** "6 Oct" */
export const shortDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** The project page's views. Here, not in the (client) header, because the server page reads it too. */
export const PROJECT_VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "board", label: "Board" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
  { key: "diary", label: "Site diary" },
  { key: "files", label: "Files" },
  { key: "costs", label: "Costs" },
] as const;
export type ProjectView = (typeof PROJECT_VIEWS)[number]["key"];
