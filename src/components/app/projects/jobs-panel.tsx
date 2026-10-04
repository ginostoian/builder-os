import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/core/projects";
import { PROJECT_TONE } from "./types";

type Job = { id: string; name: string; status: ProjectStatus; clientName: string; total: number; done: number; late: number };

/** Current jobs with progress, for the dashboard. */
export function JobsPanel({ jobs }: { jobs: Job[] }) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-[18px] pt-4 pb-2">
        <h2 className="font-semibold">Current jobs</h2>
        <Link href="/app/projects" className="text-xs text-ink-2 hover:text-ink">
          All projects
        </Link>
      </div>
      {jobs.length === 0 ? (
        <p className="px-[18px] pb-4 text-ink-2">No jobs running. Start a project from an accepted quote.</p>
      ) : (
        <ul>
          {jobs.slice(0, 6).map((j) => {
            const percent = j.total === 0 ? 0 : Math.round((j.done / j.total) * 100);
            return (
              <li key={j.id} className="border-t border-hairline">
                <Link href={`/app/projects/${j.id}`} className="flex items-center gap-3 px-[18px] py-2.5 hover:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{j.name}</span>
                    <span className="flex items-center gap-2 text-[12px] text-subtle">
                      <span className="truncate">{j.clientName}</span>
                      {j.late > 0 && (
                        <span className="flex flex-none items-center gap-1 font-medium text-danger">
                          <AlertTriangle className="size-3" />
                          {j.late} late
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="h-1.5 w-16 flex-none overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                  </span>
                  <Badge tone={PROJECT_TONE[j.status]}>{PROJECT_STATUS_LABEL[j.status]}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
