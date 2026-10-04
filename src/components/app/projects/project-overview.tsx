import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Clock, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/core/money";
import { addDays } from "@/core/payment-plan";
import { TASK_STATUS_LABEL, isLate, progress } from "@/core/projects";
import { longDate } from "@/core/quote-snapshot";
import { cn } from "@/lib/utils";
import { TASK_TONE, dayLabel, shortDay, type Phase, type Task } from "./types";

type Money = { agreed: number; approvedVariations: number; awaitingVariations: number; contract: number; invoiced: number; paid: number };

/**
 * The project at a glance: how far along each stage is, what needs attention (late or waiting), what's
 * coming up this week, the latest from site, and (for people who see prices) where the money stands.
 */
export function ProjectOverview({
  projectId,
  quoteId,
  tasks,
  phases,
  today,
  diary,
  money,
  shareProgress,
}: {
  projectId: string;
  quoteId: string | null;
  tasks: Task[];
  phases: Phase[];
  today: string;
  diary: { id: string; entryDate: string; body: string; authorName: string | null; photos: number }[];
  money: Money | null;
  shareProgress: boolean;
}) {
  const overall = progress(tasks);
  const late = tasks.filter((t) => isLate(t, today));
  const waiting = tasks.filter((t) => t.status === "waiting");
  const weekEnd = addDays(today, 7);
  const upcoming = tasks
    .filter((t) => t.status !== "done" && !isLate(t, today) && ((t.startDate && t.startDate <= weekEnd) || (t.dueDate && t.dueDate <= weekEnd)))
    .sort((a, b) => (a.startDate ?? a.dueDate ?? "").localeCompare(b.startDate ?? b.dueDate ?? ""))
    .slice(0, 8);
  const stages = [
    ...phases.map((p) => ({ name: p.name, ...progress(tasks.filter((t) => t.phaseId === p.id)) })),
    ...(tasks.some((t) => !t.phaseId) ? [{ name: "No stage", ...progress(tasks.filter((t) => !t.phaseId)) }] : []),
  ];
  const view = (v: string) => `/app/projects/${projectId}?view=${v}`;

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2 px-6 py-5">
      <div className="mx-auto grid max-w-[1160px] grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start gap-4">
        <div className="flex flex-col gap-4">
          <section className="rounded-[12px] bg-white p-5 shadow-ring">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Progress</h2>
              <span className="text-subtle tabular">
                {overall.done} of {overall.total} tasks done
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${overall.percent}%` }} />
              </div>
              <span className="w-12 text-right text-[22px] font-semibold tracking-[-0.02em] tabular">{overall.percent}%</span>
            </div>
            {stages.length > 0 && (
              <ol className="mt-4 flex flex-col gap-2">
                {stages.map((s) => (
                  <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_120px_48px] items-center gap-3">
                    <span className={cn("truncate", s.total > 0 && s.done === s.total && "text-subtle")}>{s.name}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-success" style={{ width: `${s.percent}%` }} />
                    </div>
                    <span className="text-right text-[12px] text-subtle tabular">
                      {s.done}/{s.total}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {tasks.length === 0 && (
              <p className="mt-3 text-subtle">
                No tasks yet.{" "}
                <Link href={view("list")} className="text-ink underline underline-offset-2">
                  Add stages and tasks
                </Link>{" "}
                to track the job.
              </p>
            )}
          </section>

          {(late.length > 0 || waiting.length > 0) && (
            <section className="rounded-[12px] bg-white p-5 shadow-ring">
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-warning" />
                Needs attention
              </h2>
              <ul className="flex flex-col">
                {[...late, ...waiting.filter((w) => !late.includes(w))].slice(0, 10).map((t) => (
                  <TaskLine key={t.id} task={t} today={today} href={view("list")} />
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[12px] bg-white p-5 shadow-ring">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <CalendarClock className="size-4 text-ink-2" />
              Coming up this week
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-subtle">
                Nothing scheduled for the next 7 days.{" "}
                <Link href={view("timeline")} className="text-ink underline underline-offset-2">
                  Open the timeline
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col">
                {upcoming.map((t) => (
                  <TaskLine key={t.id} task={t} today={today} href={view("timeline")} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          {money && quoteId && (
            <section className="rounded-[12px] bg-white p-5 shadow-ring">
              <h2 className="mb-3 font-semibold">Money</h2>
              <dl className="flex flex-col gap-1.5 tabular">
                <Row label="Quote accepted" value={formatGBP(money.agreed)} />
                <Row label="Approved variations" value={formatGBP(money.approvedVariations)} />
                <div className="my-1 h-px bg-hairline" />
                <Row label="Contract value" value={formatGBP(money.contract)} strong />
                <Row label="Invoiced" value={formatGBP(money.invoiced)} />
                <Row label="Paid" value={formatGBP(money.paid)} />
                <Row label="Still to invoice" value={formatGBP(Math.max(0, money.contract - money.invoiced))} />
              </dl>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full bg-success" style={{ width: `${money.contract ? Math.min(100, (money.paid / money.contract) * 100) : 0}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                <Link href={`/app/quotes/${quoteId}`} className="flex items-center gap-1 text-ink-2 hover:text-ink">
                  Payments and variations <ArrowRight className="size-3" />
                </Link>
                {money.awaitingVariations > 0 && <span className="text-warning">{money.awaitingVariations} variation{money.awaitingVariations > 1 ? "s" : ""} awaiting approval</span>}
              </div>
            </section>
          )}

          <section className="rounded-[12px] bg-white p-5 shadow-ring">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">Latest from site</h2>
              <Link href={view("diary")} className="text-[12.5px] text-ink-2 hover:text-ink">
                Site diary
              </Link>
            </div>
            {diary.length === 0 ? (
              <p className="text-subtle">No updates yet. Post one from the site diary, with photos.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {diary.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <div className="text-[12px] text-subtle">
                      {d.entryDate === today ? "Today" : longDate(d.entryDate)} · {d.authorName ?? "Team"}
                      {d.photos > 0 && ` · ${d.photos} photo${d.photos > 1 ? "s" : ""}`}
                    </div>
                    <p className="line-clamp-3 whitespace-pre-line">{d.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex items-start gap-2.5 rounded-[12px] bg-white p-5 text-[12.5px] shadow-ring">
            {shareProgress ? <Eye className="mt-0.5 size-4 text-success" /> : <EyeOff className="mt-0.5 size-4 text-subtle" />}
            <p className="text-ink-2">
              {shareProgress
                ? "The client can follow progress in their portal: how far each stage is, plus the diary updates and files you share."
                : "The client doesn't see this project. Turn it on in Details to share progress in their portal."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "font-semibold")}>
      <dt className={strong ? undefined : "text-ink-2"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TaskLine({ task, today, href }: { task: Task; today: string; href: string }) {
  const late = isLate(task, today);
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 border-b border-muted py-2 last:border-0 hover:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate">{task.title}</span>
          {(task.assigneeName || task.trade) && <span className="block truncate text-[11.5px] text-subtle">{[task.assigneeName, task.trade].filter(Boolean).join(" · ")}</span>}
        </span>
        {late ? (
          <span className="flex items-center gap-1 text-[12px] font-medium text-danger">
            <Clock className="size-3" />
            Due {shortDay(task.dueDate!)}
          </span>
        ) : (
          (task.startDate || task.dueDate) && <span className="text-[12px] text-subtle">{dayLabel((task.startDate ?? task.dueDate)!)}</span>
        )}
        <Badge tone={TASK_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
      </Link>
    </li>
  );
}
