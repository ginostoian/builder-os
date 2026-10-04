import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { ScreenTitle } from "@/components/app/app-shell";
import { AutoSubmitSelect } from "@/components/app/auto-submit-select";
import { TASK_DOT } from "@/components/app/projects/types";
import { Button } from "@/components/ui/button";
import { addDays, ukToday } from "@/core/payment-plan";
import { startOfWeek } from "@/core/projects";
import { can } from "@/core/roles";
import { calendarItems, type CalendarItem } from "@/db/calendar";
import { assignableWorkers } from "@/db/projects";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isDay = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${monthStart(iso)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const MAX_IN_CELL = 4;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Colour of an item's chip: surveys are sales, job dates are milestones, tasks follow their status. */
function chip(item: CalendarItem) {
  if (item.kind === "visit") return "bg-brand-soft text-brand-ink";
  if (item.kind === "job_start" || item.kind === "job_end") return "bg-info-soft text-ink";
  return item.status === "done" ? "bg-surface text-subtle line-through" : "bg-white text-ink shadow-ring";
}

function Item({ item, full = false }: { item: CalendarItem; full?: boolean }) {
  return (
    <Link href={item.href} title={[item.title, item.detail, item.worker].filter(Boolean).join(" · ")} className={cn("flex items-start gap-1.5 rounded-[5px] px-1.5 py-[3px] text-[11.5px] leading-tight hover:brightness-95", chip(item))}>
      {item.kind === "task" && item.status && <span className={cn("mt-[4px] size-1.5 flex-none rounded-full", TASK_DOT[item.status])} />}
      <span className="min-w-0 flex-1">
        <span className={cn("block", !full && "truncate")}>
          {item.time && <span className="mr-1 font-medium tabular">{item.time}</span>}
          {item.end === "start" ? "Starts: " : item.end === "due" ? "Due: " : ""}
          {item.title}
        </span>
        {full && (item.detail || item.worker) && <span className="block text-[11px] text-subtle no-underline">{[item.detail, item.worker].filter(Boolean).join(" · ")}</span>}
      </span>
    </Link>
  );
}

/**
 * Who's doing what, when: survey visits, task dates (filter to one person), and jobs starting and due to
 * finish. Month by default; week shows every item with its job and person.
 */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; d?: string | string[]; worker?: string | string[] }> }) {
  const session = await requirePermission("projects.view");
  const p = await searchParams;
  const today = ukToday();
  const view = first(p.view) === "week" ? "week" : "month";
  const anchor = isDay(first(p.d)) ? first(p.d)! : today;
  const workers = await withSession(session, (tx) => assignableWorkers(tx, session.orgId));
  const workerId = workers.find((w) => w.id === first(p.worker))?.id;

  const from = view === "week" ? startOfWeek(anchor) : startOfWeek(monthStart(anchor));
  const to = view === "week" ? addDays(from, 6) : addDays(startOfWeek(addDays(addMonths(anchor, 1), -1)), 6);
  const items = await withSession(session, (tx) => calendarItems(tx, session.orgId, from, to, { leads: can(session.role, "leads.view"), workerId }));
  const byDay = new Map<string, CalendarItem[]>();
  for (const i of items) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);

  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const month = anchor.slice(0, 7);
  const prev = view === "week" ? addDays(anchor, -7) : addMonths(anchor, -1);
  const next = view === "week" ? addDays(anchor, 7) : addMonths(anchor, 1);
  const href = (o: { view?: string; d?: string }) => {
    const q = new URLSearchParams();
    const v = o.view ?? view;
    if (v !== "month") q.set("view", v);
    const d = o.d ?? anchor;
    if (d !== today) q.set("d", d);
    if (workerId) q.set("worker", workerId);
    const s = q.toString();
    return `/app/calendar${s ? `?${s}` : ""}`;
  };
  const heading = view === "week" ? `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}` : fmt(anchor, { month: "long", year: "numeric" });

  return (
    <LiveAppShell active="calendar" crumbs={["Calendar", heading]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-5 lg:px-6">
        <ScreenTitle title="Calendar" subtitle="Surveys, task dates and jobs starting or finishing.">
          <div className="flex items-center gap-2">
            <form action="/app/calendar" className="flex items-center">
              {view === "week" && <input type="hidden" name="view" value="week" />}
              {anchor !== today && <input type="hidden" name="d" value={anchor} />}
              <AutoSubmitSelect name="worker" defaultValue={workerId ?? ""} aria-label="Whose tasks" className="h-8 rounded-md bg-white px-2 text-[13px] shadow-ring-input">
                <option value="">Everyone and everything</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}&rsquo;s tasks
                  </option>
                ))}
              </AutoSubmitSelect>
              <noscript>
                <Button type="submit" variant="outline" className="ml-1.5">
                  Show
                </Button>
              </noscript>
            </form>
            <div className="flex rounded-md bg-surface p-0.5 shadow-ring">
              {(["month", "week"] as const).map((v) => (
                <Link key={v} href={href({ view: v })} aria-current={v === view ? "page" : undefined} className={cn("rounded-[5px] px-2.5 py-1 text-[12.5px] capitalize", v === view ? "bg-white font-medium shadow-ring" : "text-ink-2 hover:text-ink")}>
                  {v}
                </Link>
              ))}
            </div>
          </div>
        </ScreenTitle>

        <div className="flex items-center gap-2">
          <Link href={href({ d: prev })} aria-label={view === "week" ? "Previous week" : "Previous month"} className="flex size-8 items-center justify-center rounded-md shadow-ring hover:bg-accent">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={href({ d: next })} aria-label={view === "week" ? "Next week" : "Next month"} className="flex size-8 items-center justify-center rounded-md shadow-ring hover:bg-accent">
            <ChevronRight className="size-4" />
          </Link>
          <Link href={href({ d: today })} className="flex h-8 items-center rounded-md px-2.5 shadow-ring hover:bg-accent">
            Today
          </Link>
          <h2 className="ml-1.5 text-[15px] font-semibold">{heading}</h2>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[11.5px] text-subtle">
            {can(session.role, "leads.view") && !workerId && (
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-soft" />
                Survey
              </span>
            )}
            {!workerId && (
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-info-soft" />
                Job starts / finishes
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-white shadow-ring" />
              Task
            </span>
          </div>
        </div>

        {view === "month" ? (
          <div className="overflow-hidden rounded-[10px] shadow-card">
            <div className="grid grid-cols-7 border-b border-hairline bg-surface">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-1.5 text-[11.5px] font-medium text-subtle">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const list = byDay.get(d) ?? [];
                const shown = list.slice(0, MAX_IN_CELL);
                return (
                  <div key={d} className={cn("flex min-h-[112px] min-w-0 flex-col gap-1 border-hairline p-1.5", i % 7 !== 6 && "border-r", i < days.length - 7 && "border-b", d.slice(0, 7) !== month && "bg-surface/60")}>
                    <Link href={href({ view: "week", d })} className={cn("flex size-6 items-center justify-center self-start rounded-full text-[12px] tabular hover:bg-accent", d === today ? "bg-ink font-semibold text-white hover:bg-ink" : d.slice(0, 7) !== month ? "text-faint" : "text-ink-2")}>
                      {Number(d.slice(8))}
                    </Link>
                    {shown.map((item) => (
                      <Item key={item.key} item={item} />
                    ))}
                    {list.length > shown.length && (
                      <Link href={href({ view: "week", d })} className="px-1.5 text-[11.5px] text-subtle hover:text-ink">
                        +{list.length - shown.length} more
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 overflow-hidden rounded-[10px] shadow-card">
            {days.map((d, i) => {
              const list = byDay.get(d) ?? [];
              return (
                <div key={d} className={cn("flex min-h-[420px] min-w-0 flex-col gap-1.5 p-2", i !== 6 && "border-r border-hairline", d === today && "bg-brand-tint")}>
                  <div className="mb-1 flex items-baseline gap-1.5">
                    <span className="text-[11.5px] font-medium text-subtle">{WEEKDAYS[i]}</span>
                    <span className={cn("text-[15px] font-semibold tabular", d === today && "text-brand")}>{Number(d.slice(8))}</span>
                  </div>
                  {list.length === 0 ? <div className="text-[11.5px] text-faint">Nothing on</div> : list.map((item) => <Item key={item.key} item={item} full />)}
                </div>
              );
            })}
          </div>
        )}

        {items.length === 0 && (
          <p className="text-center text-subtle">
            Nothing {view === "week" ? "this week" : "this month"}. Give tasks start or due dates, book survey visits on leads, or set job dates, and they show here.
          </p>
        )}
      </div>
    </LiveAppShell>
  );
}
