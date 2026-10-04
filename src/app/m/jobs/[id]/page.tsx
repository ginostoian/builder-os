import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Navigation, Phone } from "lucide-react";
import { CheckIn } from "@/components/site/check-in";
import { MyTasks } from "@/components/site/my-tasks";
import { PostUpdate } from "@/components/site/post-update";
import { SiteFrame, SiteHeading } from "@/components/site/site-frame";
import { toMyTask } from "@/components/site/to-my-task";
import { formatAddress } from "@/core/clients";
import { ukToday } from "@/core/payment-plan";
import { longDate } from "@/core/quote-snapshot";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { myJob, openVisit, workerForMember } from "@/db/site";
import { requirePermission, withSession } from "@/auth/session";
import { publicUrl, storageConfigured } from "@/server/storage";

export const metadata: Metadata = { title: "Job" };

/** One of my jobs: how to get there, who the client is, my tasks there, check in, and post an update. */
export default async function SiteJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("site.app");
  const projectId = (await params).id;
  if (!uuid.safeParse(projectId).success) notFound();
  const today = ukToday();
  const data = await withSession(session, async (tx) => {
    const worker = await workerForMember(tx, session.orgId, session.memberId);
    if (!worker) return null;
    const job = await myJob(tx, session.orgId, { workerId: worker.id, memberId: session.memberId }, projectId);
    if (!job) return null;
    return { job, open: await openVisit(tx, session.orgId, worker.id) };
  });
  if (!data) notFound();
  const { job } = data;
  const address = formatAddress(job.siteAddress);

  return (
    <SiteFrame eyebrow={job.clientName} title={job.name} back="/m" office={can(session.role, "app.office")}>
      {(address || job.clientPhone) && (
        <section className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-ring">
          {address && (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 flex-none text-subtle" />
              <span className="flex-1">{address}</span>
            </div>
          )}
          <div className="flex gap-2">
            {address && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-surface font-semibold shadow-ring"
              >
                <Navigation className="size-4" />
                Directions
              </a>
            )}
            {job.clientPhone && (
              <a href={`tel:${job.clientPhone}`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-surface font-semibold shadow-ring">
                <Phone className="size-4" />
                Call {job.clientName.split(" ")[0]}
              </a>
            )}
          </div>
        </section>
      )}

      <CheckIn open={data.open ? { projectId: data.open.projectId, projectName: data.open.projectName, checkedInAt: data.open.checkedInAt.toISOString() } : null} jobs={[{ id: job.id, name: job.name }]} here={job.id} />

      <SiteHeading title="My tasks here" aside={job.tasks.length > 0 ? `${job.tasks.filter((t) => t.status === "done").length} of ${job.tasks.length} done` : undefined} />
      <MyTasks tasks={job.tasks.map((t) => toMyTask(t, today))} showJob={false} />

      <SiteHeading title="Post an update" />
      <PostUpdate projectId={job.id} photosEnabled={storageConfigured()} />

      {job.diary.length > 0 && (
        <>
          <SiteHeading title="Latest from site" />
          <ul className="flex flex-col gap-2">
            {job.diary.map((d) => (
              <li key={d.id} className="rounded-2xl bg-white p-3.5 shadow-ring">
                <div className="text-xs text-subtle">{d.entryDate === today ? "Today" : longDate(d.entryDate)}</div>
                <p className="mt-0.5 whitespace-pre-line">{d.body}</p>
                {d.photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {d.photos.map((p) => (
                      <a key={p.key} href={publicUrl(p.key)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- CDN image */}
                        <img src={publicUrl(p.key)} alt="" loading="lazy" className="size-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </SiteFrame>
  );
}
