import type { Metadata } from "next";
import { WhatsAppLink } from "@/components/app/whatsapp-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { SectionHeading } from "@/components/app/form-fields";
import { TASK_TONE, dayLabel, initials, shortDay } from "@/components/app/projects/types";
import { AppAccess } from "@/components/app/team/app-access";
import { ArchiveWorker } from "@/components/app/team/archive-worker";
import { Certificates } from "@/components/app/team/certificates";
import { VisitPlaces, VisitTimes } from "@/components/app/team/visit-times";
import { WorkerForm } from "@/components/app/team/worker-form";
import { WorkerCis } from "@/components/app/team/worker-cis";
import { cisSettings } from "@/db/cis";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/core/money";
import { addDays, ukToday } from "@/core/payment-plan";
import { TASK_STATUS_LABEL, isLate } from "@/core/projects";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { WORKER_KIND_LABEL, formatMinutes, londonDay, visitMinutes } from "@/core/team";
import { getWorker, listVisits, unlinkedMembers } from "@/db/team";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "Team" };

/** One person: their details, certificates, login, what they're on, and their recent hours on site. */
export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("team.view");
  const workerId = (await params).id;
  if (!uuid.safeParse(workerId).success) notFound();
  const today = ukToday();
  const data = await withSession(session, async (tx) => {
    const w = await getWorker(tx, session.orgId, workerId);
    if (!w) return null;
    return {
      ...w,
      logins: can(session.role, "team.edit") ? await unlinkedMembers(tx, session.orgId) : [],
      cis: (await cisSettings(tx, session.orgId)).enabled,
      visits: await listVisits(tx, session.orgId, { from: addDays(today, -27), to: today, workerId }),
    };
  });
  if (!data) notFound();
  const { worker: w } = data;
  const canEdit = can(session.role, "team.edit");
  const canSeeCosts = can(session.role, "costs.view");
  const now = new Date();
  const weekTotal = data.visits.filter((v) => londonDay(v.checkedInAt) > addDays(today, -7)).reduce((s, v) => s + visitMinutes(v.checkedInAt, v.checkedOutAt, now), 0);
  const fourWeekTotal = data.visits.reduce((s, v) => s + visitMinutes(v.checkedInAt, v.checkedOutAt, now), 0);

  return (
    <LiveAppShell active="people" crumbs={["Team", w.name]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/app/team" className="rounded-md p-1 text-subtle hover:bg-accent hover:text-ink" aria-label="Back to the team">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="flex size-10 items-center justify-center rounded-full bg-av-sage text-[13px] font-semibold text-ink-3">{initials(w.name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em]">
              {w.name}
              {w.archivedAt && <Badge tone="muted">Left</Badge>}
            </h1>
            <div className="text-subtle">{[WORKER_KIND_LABEL[w.kind], w.trade].filter(Boolean).join(" · ")}</div>
          </div>
          {canEdit && <ArchiveWorker workerId={w.id} archived={Boolean(w.archivedAt)} openTasks={data.tasks.length} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-4">
          <div className="flex flex-col gap-4">
            <Panel className="p-5">
              <SectionHeading title="Details" />
              <div className="mt-3">
                {canEdit ? (
                  <WorkerForm
                    workerId={w.id}
                    canSeeCosts={canSeeCosts}
                    initial={{
                      name: w.name,
                      kind: w.kind,
                      trade: w.trade,
                      phone: w.phone,
                      email: w.email,
                      dayRatePence: w.dayRatePence,
                      startedOn: w.startedOn,
                      emergencyName: w.emergencyName,
                      emergencyPhone: w.emergencyPhone,
                      notes: w.notes,
                    }}
                  />
                ) : (
                  <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-1.5">
                    <Detail
                      label="Mobile"
                      value={
                        w.phone && (
                          <span className="flex flex-wrap items-center gap-x-3">
                            <a href={`tel:${w.phone}`}>{w.phone}</a>
                            <WhatsAppLink phone={w.phone} />
                          </span>
                        )
                      }
                    />
                    <Detail label="Email" value={w.email} />
                    <Detail label="Started" value={w.startedOn && dayLabel(w.startedOn)} />
                    {canSeeCosts && <Detail label="Day rate" value={w.dayRatePence != null && formatGBP(w.dayRatePence)} />}
                    <Detail label="Emergency contact" value={[w.emergencyName, w.emergencyPhone].filter(Boolean).join(" · ")} />
                    <Detail label="Notes" value={w.notes && <span className="whitespace-pre-line">{w.notes}</span>} />
                  </dl>
                )}
              </div>
            </Panel>

            {data.cis && w.kind === "subcontractor" && canSeeCosts && (
              <Panel className="p-5">
                <SectionHeading title="CIS" hint="Their verified status decides the deduction on what you pay them." />
                <div className="mt-3">
                  <WorkerCis workerId={w.id} initial={{ status: w.cisStatus, utr: w.utr, verificationRef: w.cisVerificationRef, verifiedOn: w.cisVerifiedOn }} canEdit={canEdit} />
                </div>
              </Panel>
            )}

            <Panel className="p-5">
              <SectionHeading title="Certificates and cards" hint="CSCS, Gas Safe, insurance and the like. The office is emailed 30 days before one expires." />
              <div className="mt-3">
                <Certificates workerId={w.id} certificates={data.certificates} today={today} canEdit={canEdit} />
              </div>
            </Panel>
          </div>

          <div className="flex flex-col gap-4">
            <Panel className="p-5">
              <SectionHeading title="Site app" />
              <div className="mt-3">
                <AppAccess
                  workerId={w.id}
                  linked={w.memberId && data.memberName && data.memberRole ? { name: data.memberName, email: data.memberEmail, role: data.memberRole, active: Boolean(data.memberActive) } : null}
                  logins={data.logins}
                  canEdit={canEdit}
                />
              </div>
            </Panel>

            <Panel className="p-5">
              <SectionHeading title="Working on" hint="Open tasks on current projects." />
              {data.tasks.length === 0 ? (
                <p className="mt-2 text-subtle">Nothing assigned. Give them tasks from a project&apos;s task list.</p>
              ) : (
                <ul className="mt-2 flex flex-col">
                  {data.tasks.map((t) => (
                    <li key={t.id}>
                      <Link href={`/app/projects/${t.projectId}?view=list`} className="flex items-center gap-3 border-b border-muted py-2 last:border-0 hover:bg-surface-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{t.title}</span>
                          <span className="block truncate text-[11.5px] text-subtle">{t.projectName}</span>
                        </span>
                        {(t.startDate || t.dueDate) && (
                          <span className={isLate(t, today) ? "text-[12px] font-medium text-danger" : "text-[12px] text-subtle"}>
                            {isLate(t, today) ? `Due ${shortDay(t.dueDate!)}` : shortDay((t.startDate ?? t.dueDate)!)}
                          </span>
                        )}
                        <Badge tone={TASK_TONE[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="p-5">
              <div className="flex items-baseline justify-between">
                <SectionHeading title="Hours on site" />
                <Link href="/app/team?view=hours" className="text-[12.5px] text-ink-2 hover:text-ink">
                  Timesheets
                </Link>
              </div>
              <div className="mt-2 flex gap-6 tabular">
                <div>
                  <div className="text-[19px] font-semibold">{formatMinutes(weekTotal)}</div>
                  <div className="text-[12px] text-subtle">Last 7 days</div>
                </div>
                <div>
                  <div className="text-[19px] font-semibold">{formatMinutes(fourWeekTotal)}</div>
                  <div className="text-[12px] text-subtle">Last 4 weeks</div>
                </div>
              </div>
              {data.visits.length === 0 ? (
                <p className="mt-2 text-subtle">No check-ins yet. They check in and out of site from the site app.</p>
              ) : (
                <ul className="mt-3 flex flex-col">
                  {data.visits.slice(0, 12).map((v) => (
                    <li key={v.id} className="grid grid-cols-[88px_minmax(0,1fr)_auto_52px] items-center gap-x-2 gap-y-0.5 border-b border-muted py-1.5 text-[12.5px] last:border-0">
                      <span className="text-ink-2">{dayLabel(londonDay(v.checkedInAt))}</span>
                      <Link href={`/app/projects/${v.projectId}`} className="flex min-w-0 items-center gap-1 truncate hover:underline">
                        <MapPin className="size-3 flex-none text-subtle" />
                        <span className="truncate">{v.projectName}</span>
                      </Link>
                      <VisitTimes visit={v} canEdit={canEdit} />
                      <span className="text-right tabular">{formatMinutes(visitMinutes(v.checkedInAt, v.checkedOutAt, now))}</span>
                      <VisitPlaces visit={v} className="col-start-2 col-span-3" />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </LiveAppShell>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-subtle">{label}</dt>
      <dd>{value || <span className="text-faint-2">—</span>}</dd>
    </>
  );
}
