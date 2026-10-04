import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, HardHat, MapPin, Plus, SquareKanban } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { PROJECT_TONE, shortDay } from "@/components/app/projects/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/core/clients";
import { ukToday } from "@/core/payment-plan";
import { PROJECT_STATUS_LABEL } from "@/core/projects";
import { can } from "@/core/roles";
import { listProjects, type ProjectFilter } from "@/db/projects";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

const FILTERS: { key: ProjectFilter; label: string }[] = [
  { key: "active", label: "Current" },
  { key: "complete", label: "Complete" },
  { key: "all", label: "All" },
];

/** Every job: what's on site, booked in, snagging or done, with progress and anything late. */
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const session = await requirePermission("projects.view");
  const raw = (await searchParams).filter;
  const filter = FILTERS.find((f) => f.key === (Array.isArray(raw) ? raw[0] : raw))?.key ?? "active";
  const today = ukToday();
  const rows = await withSession(session, (tx) => listProjects(tx, session.orgId, filter, today));
  const canEdit = can(session.role, "projects.edit");

  return (
    <LiveAppShell active="board" crumbs={["Projects", FILTERS.find((f) => f.key === filter)!.label]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle title="Projects" subtitle="Jobs from booked in to handover: stages, tasks, the site diary and files.">
          {canEdit && (
            <Button asChild>
              <Link href="/app/projects/new">
                <Plus />
                New project
              </Link>
            </Button>
          )}
        </ScreenTitle>

        <nav className="flex gap-1.5" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "active" ? "/app/projects" : `/app/projects?filter=${f.key}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", f.key === filter ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <SquareKanban className="size-6 text-subtle" strokeWidth={1.5} />
            <p className="font-medium">{filter === "complete" ? "No finished projects yet" : "No projects yet"}</p>
            <p className="max-w-[440px] text-subtle">When a client accepts a quote, open it and click Start project: its sections become stages and its lines become tasks. Or start one from scratch.</p>
          </Panel>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
            {rows.map((r) => {
              const percent = r.total === 0 ? 0 : Math.round((r.done / r.total) * 100);
              return (
                <Link key={r.id} href={`/app/projects/${r.id}`} className="flex flex-col gap-2.5 rounded-[12px] bg-white p-4 shadow-ring transition-shadow hover:shadow-[0_0_0_1px_var(--color-faint),0_4px_12px_rgb(16_16_15/0.06)]">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.name}</div>
                      <div className="truncate text-[12.5px] text-subtle">{r.clientName}</div>
                    </div>
                    <Badge tone={PROJECT_TONE[r.status]}>{PROJECT_STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-[12px] text-subtle tabular">{r.total === 0 ? "No tasks" : `${r.done}/${r.total}`}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-subtle">
                    {r.siteAddress && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="size-3 flex-none" />
                        <span className="truncate">{formatAddress(r.siteAddress)}</span>
                      </span>
                    )}
                    {(r.startDate || r.endDate) && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {r.startDate ? shortDay(r.startDate) : "?"} – {r.endDate ? shortDay(r.endDate) : "?"}
                      </span>
                    )}
                    {r.managerName && (
                      <span className="flex items-center gap-1">
                        <HardHat className="size-3" />
                        {r.managerName}
                      </span>
                    )}
                  </div>
                  {(r.late > 0 || r.waiting > 0) && (
                    <div className="flex gap-2 text-[12px]">
                      {r.late > 0 && (
                        <span className="flex items-center gap-1 font-medium text-danger">
                          <AlertTriangle className="size-3" />
                          {r.late} late
                        </span>
                      )}
                      {r.waiting > 0 && <span className="text-warning">{r.waiting} waiting</span>}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </LiveAppShell>
  );
}
