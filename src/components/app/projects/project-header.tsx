"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FileSpreadsheet, HardHat, MapPin, Settings2, Trash2, User } from "lucide-react";
import { deleteProjectAction, updateProjectAction } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatAddress } from "@/core/clients";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/core/projects";
import type { Address } from "@/core/schemas";
import { cn } from "@/lib/utils";
import { ProjectForm, type ProjectFormValues } from "./project-form";
import { PROJECT_TONE, shortDay, type Member } from "./types";

export const PROJECT_VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "board", label: "Board" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
  { key: "diary", label: "Site diary" },
  { key: "files", label: "Files" },
] as const;
export type ProjectView = (typeof PROJECT_VIEWS)[number]["key"];

const STATUS_STYLE: Record<string, string> = {
  blue: "bg-info-soft text-info",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  muted: "bg-muted text-ink-2",
  grey: "bg-line text-ink-2",
};

/** Name, status (changeable in place), the essentials, and the view tabs. */
export function ProjectHeader({
  projectId,
  view,
  values,
  clientId,
  clientName,
  managerName,
  quote,
  counts,
  canEdit,
  clients,
  members,
}: {
  projectId: string;
  view: ProjectView;
  values: ProjectFormValues;
  clientId: string;
  clientName: string;
  managerName: string | null;
  quote: { id: string; ref: string } | null;
  counts: { diary: number; files: number; late: number };
  canEdit: boolean;
  clients: { id: string; name: string; address: Address | null }[];
  members: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const tone = STATUS_STYLE[PROJECT_TONE[values.status]] ?? STATUS_STYLE.grey;

  return (
    <div className="flex-none border-b border-hairline bg-white">
      <div className="flex items-start gap-4 px-6 pt-[18px]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{values.name}</h1>
            {canEdit ? (
              <select
                aria-label="Project status"
                value={values.status}
                disabled={pending}
                onChange={(e) =>
                  startTransition(async () => {
                    await updateProjectAction(projectId, {
                      ...values,
                      status: e.target.value as ProjectStatus,
                      startDate: values.startDate ?? undefined,
                      endDate: values.endDate ?? undefined,
                      managerMemberId: values.managerMemberId ?? undefined,
                      siteAddress: values.siteAddress ?? undefined,
                    });
                    router.refresh();
                  })
                }
                className={cn("h-6 cursor-pointer appearance-none rounded-full border-0 px-2.5 text-[11.5px] font-medium outline-none", tone)}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : (
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-medium", tone)}>{PROJECT_STATUS_LABEL[values.status]}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-subtle">
            <Link href={`/app/clients/${clientId}`} className="flex items-center gap-[5px] hover:text-ink">
              <User className="size-[13px]" />
              {clientName}
            </Link>
            {values.siteAddress && (
              <span className="flex min-w-0 items-center gap-[5px]">
                <MapPin className="size-[13px] flex-none" />
                <span className="truncate">{formatAddress(values.siteAddress)}</span>
              </span>
            )}
            {(values.startDate || values.endDate) && (
              <span className="flex items-center gap-[5px]">
                <CalendarDays className="size-[13px]" />
                {values.startDate ? shortDay(values.startDate) : "?"} – {values.endDate ? shortDay(values.endDate) : "?"}
              </span>
            )}
            {managerName && (
              <span className="flex items-center gap-[5px]">
                <HardHat className="size-[13px]" />
                {managerName}
              </span>
            )}
            {quote && (
              <Link href={`/app/quotes/${quote.id}`} className="flex items-center gap-[5px] hover:text-ink">
                <FileSpreadsheet className="size-[13px]" />
                {quote.ref}
              </Link>
            )}
          </div>
        </div>
        {canEdit && (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              setConfirmDelete(false);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Settings2 className="text-ink-2" />
                Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[620px]">
              <DialogTitle>Project details</DialogTitle>
              <DialogDescription className="sr-only">Name, client, dates, who runs it and what the client sees.</DialogDescription>
              <div className="mt-3">
                <ProjectForm
                  projectId={projectId}
                  initial={values}
                  clients={clients}
                  members={members}
                  onDone={() => {
                    setOpen(false);
                    router.refresh();
                  }}
                  onCancel={() => setOpen(false)}
                />
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-hairline pt-4">
                <span className="flex-1 text-[12.5px] text-subtle">Deleting removes its tasks, diary and files for good. The quote and invoices stay.</span>
                <Button
                  variant={confirmDelete ? "destructive" : "ghost"}
                  disabled={pending}
                  onClick={() => {
                    if (!confirmDelete) return setConfirmDelete(true);
                    startTransition(async () => void (await deleteProjectAction(projectId)));
                  }}
                >
                  <Trash2 />
                  {confirmDelete ? "Delete project for good" : "Delete project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <nav className="flex gap-5 px-6 pt-3" aria-label="Project views">
        {PROJECT_VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "overview" ? `/app/projects/${projectId}` : `/app/projects/${projectId}?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn("-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 font-medium", view === v.key ? "border-ink text-ink" : "border-transparent text-subtle hover:text-ink-2")}
          >
            {v.label}
            {v.key === "diary" && counts.diary > 0 && <span className="text-[11px] text-subtle tabular">{counts.diary}</span>}
            {v.key === "files" && counts.files > 0 && <span className="text-[11px] text-subtle tabular">{counts.files}</span>}
            {v.key === "board" && counts.late > 0 && <span className="rounded-full bg-danger-soft px-1.5 text-[10.5px] text-danger tabular">{counts.late} late</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
