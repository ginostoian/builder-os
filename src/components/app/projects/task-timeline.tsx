"use client";

import * as React from "react";
import { CalendarPlus } from "lucide-react";
import { addDays } from "@/core/payment-plan";
import { daysBetween, isLate, timelineBar, timelineRange } from "@/core/projects";
import { cn } from "@/lib/utils";
import { TASK_DOT, shortDay, type Phase, type Task } from "./types";

const DAY = 26; // px per day
const LABEL = 260; // px for the left column

/**
 * Tasks on a calendar, week by week, grouped by stage: who's on site when, what overlaps, what's slipping.
 * A stage's own bar spans its tasks. Tasks without dates are listed underneath to be scheduled.
 */
export function TaskTimeline({
  tasks,
  phases,
  today,
  projectStart,
  projectEnd,
  onOpen,
}: {
  tasks: Task[];
  phases: Phase[];
  today: string;
  projectStart: string | null;
  projectEnd: string | null;
  onOpen: (task: Task) => void;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const range = timelineRange([projectStart, projectEnd, ...tasks.flatMap((t) => [t.startDate, t.dueDate])], today);
  const days = Array.from({ length: range.days }, (_, i) => addDays(range.start, i));
  const weeks = days.filter((_, i) => i % 7 === 0);
  const todayOffset = daysBetween(range.start, today);
  const scheduled = tasks.filter((t) => t.startDate || t.dueDate);
  const unscheduled = tasks.filter((t) => !t.startDate && !t.dueDate);
  const groups = [
    ...phases.map((p) => ({ phase: p as Phase | null, tasks: scheduled.filter((t) => t.phaseId === p.id) })),
    { phase: null, tasks: scheduled.filter((t) => !t.phaseId || !phases.some((p) => p.id === t.phaseId)) },
  ].filter((g) => g.tasks.length > 0);

  // Start scrolled so today is in view, a week in from the left.
  React.useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, (todayOffset - 7) * DAY);
  }, [todayOffset]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-2">
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL + range.days * DAY }}>
          {/* Header: weeks and days */}
          <div className="sticky top-0 z-20 flex border-b border-hairline bg-white">
            <div className="sticky left-0 z-10 flex-none border-r border-hairline bg-white" style={{ width: LABEL }} />
            <div>
              <div className="flex">
                {weeks.map((w) => (
                  <div key={w} className="border-l border-hairline px-2 py-1 text-[11.5px] font-medium text-ink-2" style={{ width: 7 * DAY }}>
                    w/c {shortDay(w)}
                  </div>
                ))}
              </div>
              <div className="flex">
                {days.map((d, i) => (
                  <div key={d} className={cn("py-0.5 text-center text-[10.5px] text-subtle", i % 7 >= 5 && "bg-surface", d === today && "font-semibold text-brand")} style={{ width: DAY }}>
                    {"MTWTFSS"[i % 7]}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekend shading and the "today" line, behind the rows */}
          <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: LABEL }} aria-hidden>
            {days.map((d, i) => (i % 7 >= 5 ? <div key={d} className="absolute top-0 bottom-0 bg-black/[0.025]" style={{ left: i * DAY, width: DAY }} /> : null))}
            {todayOffset >= 0 && todayOffset < range.days && <div className="absolute top-0 bottom-0 z-10 w-0.5 bg-brand/70" style={{ left: todayOffset * DAY + DAY / 2 }} />}
          </div>

          {groups.length === 0 && (
            <div className="sticky left-0 px-6 py-10 text-subtle" style={{ width: "min(100%, 640px)" }}>
              Nothing is scheduled yet. Give tasks a start or due date and they appear here.
            </div>
          )}

          {groups.map((g) => {
            const span = spanOf(g.tasks);
            const bar = span ? timelineBar(span, range.start) : null;
            return (
              <div key={g.phase?.id ?? "none"}>
                <div className="relative flex h-8 items-center border-b border-hairline bg-white/70">
                  <div className="sticky left-0 z-10 flex h-full flex-none items-center truncate border-r border-hairline bg-white px-4 font-semibold" style={{ width: LABEL }}>
                    {g.phase?.name ?? "No stage"}
                  </div>
                  {bar && <div className="absolute h-1.5 rounded-full bg-ink/25" style={{ left: LABEL + bar.offset * DAY + 2, width: bar.length * DAY - 4 }} />}
                </div>
                {g.tasks
                  .slice()
                  .sort((a, b) => (a.startDate ?? a.dueDate ?? "").localeCompare(b.startDate ?? b.dueDate ?? ""))
                  .map((t) => {
                    const b = timelineBar(t, range.start)!;
                    const late = isLate(t, today);
                    return (
                      <div key={t.id} className="relative flex h-9 items-center border-b border-muted">
                        <button type="button" onClick={() => onOpen(t)} className="sticky left-0 z-10 flex h-full flex-none flex-col justify-center truncate border-r border-hairline bg-white px-4 pl-6 text-left hover:bg-surface-2" style={{ width: LABEL }}>
                          <span className={cn("truncate text-[12.5px]", t.status === "done" && "text-subtle line-through decoration-faint-2")}>{t.title}</span>
                          {(t.workerName || t.trade) && <span className="truncate text-[11px] text-subtle">{[t.workerName, t.trade].filter(Boolean).join(" · ")}</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpen(t)}
                          title={`${t.title}: ${t.startDate ? shortDay(t.startDate) : ""}${t.startDate && t.dueDate && t.startDate !== t.dueDate ? " – " : ""}${t.dueDate && t.dueDate !== t.startDate ? shortDay(t.dueDate) : ""}`}
                          className={cn("absolute h-5 rounded-[5px] opacity-90 hover:opacity-100", TASK_DOT[t.status], late && "ring-2 ring-danger ring-offset-1")}
                          style={{ left: LABEL + b.offset * DAY + 2, width: Math.max(b.length * DAY - 4, 10) }}
                        />
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline bg-white px-6 py-2 text-[12px] text-subtle">
        <Legend dot="bg-faint" label="To do" />
        <Legend dot="bg-info" label="In progress" />
        <Legend dot="bg-warning" label="Waiting" />
        <Legend dot="bg-success" label="Done" />
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-brand/70" />
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] ring-2 ring-danger" />
          Late
        </span>
      </div>

      {unscheduled.length > 0 && (
        <div className="max-h-[30%] flex-none overflow-auto border-t border-hairline bg-white px-6 py-3">
          <div className="mb-1.5 text-xs font-medium text-subtle">Not scheduled ({unscheduled.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((t) => (
              <button key={t.id} type="button" onClick={() => onOpen(t)} className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12.5px] text-ink-2 hover:bg-muted hover:text-ink">
                <CalendarPlus className="size-3.5 text-subtle" />
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-4 rounded-[3px]", dot)} />
      {label}
    </span>
  );
}

/** The first and last date across some tasks. */
function spanOf(tasks: Task[]): { startDate: string; dueDate: string } | null {
  const dates = tasks.flatMap((t) => [t.startDate, t.dueDate]).filter((d): d is string => Boolean(d)).sort();
  return dates.length ? { startDate: dates[0], dueDate: dates[dates.length - 1] } : null;
}
