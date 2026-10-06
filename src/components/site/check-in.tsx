"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { formatMinutes, londonTime, visitMinutes } from "@/core/team";
import { cn } from "@/lib/utils";
import { whereAmI } from "./where-am-i";
import { useSiteSync } from "./offline/site-sync";
import { send } from "./offline/sync";
import type { OpBody } from "./offline/outbox";

type Open = { projectId: string; projectName: string; checkedInAt: string } | null;

/**
 * Check in and out of site. The time comes from the server; the phone's location is added if the person
 * allows it, so the office can see they were on site. With no signal it's saved on the phone with the
 * time it happened and sent later. On a job page `here` is that job.
 */
export function CheckIn({ open: fromServer, jobs, here }: { open: Open; jobs: { id: string; name: string }[]; here?: string }) {
  const router = useRouter();
  const sync = useSiteSync();
  // A check-in or out still waiting to send wins over what the server last said.
  const queued = sync?.ops.filter((o) => !o.failed && (o.kind === "check_in" || o.kind === "check_out")).at(-1);
  const open: Open = React.useMemo(
    () => (queued ? (queued.kind === "check_in" ? { projectId: queued.projectId, projectName: queued.projectName, checkedInAt: queued.at } : null) : fromServer),
    [queued, fromServer],
  );
  const [note, setNote] = React.useState<string>();
  const [pick, setPick] = React.useState(here ?? jobs[0]?.id ?? "");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [open]);

  const act = (body: (geo: Awaited<ReturnType<typeof whereAmI>>) => OpBody) =>
    startTransition(async () => {
      setError(undefined);
      setNote(undefined);
      if (!sync) return setError("Reload the page and try again.");
      const r = await send(sync.memberId, body(await whereAmI()));
      if (r.status === "failed") setError(r.message);
      else if (r.status === "queued") setNote("No signal, so it's saved on this phone with the time. It'll send by itself.");
      else router.refresh();
    });
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "the job";

  const since = open ? new Date(open.checkedInAt) : null;
  const elsewhere = open && here && open.projectId !== here;
  const target = here ?? pick;

  return (
    <section className={cn("rounded-[18px] px-[18px] py-4", open && !elsewhere ? "bg-ink text-white" : "bg-white shadow-ring")}>
      {open && since ? (
        <>
          <div className={cn("flex items-center justify-between text-[12.5px]", elsewhere ? "text-subtle" : "text-night-text")}>
            <span>{elsewhere ? "You're checked in somewhere else" : "On site"}</span>
            <span>
              Since {londonTime(since)} · {formatMinutes(visitMinutes(since, null))}
            </span>
          </div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.01em]">{open.projectName}</div>
        </>
      ) : (
        <>
          <div className="text-[12.5px] text-subtle">Not checked in</div>
          {!here && jobs.length > 1 ? (
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl bg-surface px-3 text-[15px] font-medium shadow-ring-input outline-none" aria-label="Job">
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 text-lg font-semibold tracking-[-0.01em]">{here ? "Arrived on site?" : (jobs[0]?.name ?? "No jobs today")}</div>
          )}
        </>
      )}
      <div className="mt-3.5 flex gap-2">
        {open && !elsewhere ? (
          <button type="button" disabled={pending} onClick={() => act((geo) => ({ kind: "check_out", geo }))} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-ink disabled:opacity-60">
            <LogOut className="size-4" />
            {pending ? "Checking out…" : "Check out"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !target}
            onClick={() => act((geo) => ({ kind: "check_in", projectId: target, projectName: jobName(target), geo }))}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-60"
          >
            <LogIn className="size-4" />
            {pending ? "Checking in…" : elsewhere ? "Check in here instead" : "Check in"}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-2 text-[13px] text-danger">{error}</p>
      ) : note ? (
        <p className={cn("mt-2 text-[13px]", open && !elsewhere ? "text-night-text" : "text-ink-2")}>{note}</p>
      ) : (
        !open && (
          <p className="mt-2 flex items-center gap-1 text-[12px] text-subtle">
            <MapPin className="size-3" />
            Your location is saved with the time, if you allow it.
          </p>
        )
      )}
    </section>
  );
}
