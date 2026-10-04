import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { JobCosts } from "@/components/app/costs/job-costs";
import { toExpense } from "@/components/app/costs/to-expense";
import { ProjectFiles } from "@/components/app/projects/project-files";
import { ProjectHeader } from "@/components/app/projects/project-header";
import { PROJECT_VIEWS, type ProjectView } from "@/components/app/projects/types";
import { ProjectOverview } from "@/components/app/projects/project-overview";
import { SiteDiary } from "@/components/app/projects/site-diary";
import { TasksWorkspace } from "@/components/app/projects/tasks-workspace";
import { ukToday } from "@/core/payment-plan";
import { isLate } from "@/core/projects";
import { quoteRef } from "@/core/quote";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { clientOptions } from "@/db/clients";
import { assignableMembers, assignableWorkers, getProject, listDiary, listFiles, projectMoney } from "@/db/projects";
import { costProjects, jobCosting } from "@/db/costs";
import { requirePermission, withSession } from "@/auth/session";
import { publicUrl, storageConfigured } from "@/server/storage";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string | string[] }> }) {
  const session = await requirePermission("projects.view");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const raw = (await searchParams).view;
  const seesCosts = can(session.role, "costs.view");
  const asked = PROJECT_VIEWS.find((v) => v.key === (Array.isArray(raw) ? raw[0] : raw))?.key ?? "overview";
  const view: ProjectView = asked === "costs" && !seesCosts ? "overview" : asked;
  const canEdit = can(session.role, "projects.edit");
  const seesMoney = can(session.role, "quotes.edit");
  const today = ukToday();

  const data = await withSession(session, async (tx) => {
    const found = await getProject(tx, session.orgId, id);
    if (!found) return undefined;
    const q = found.project.quoteId;
    return {
      found,
      members: await assignableMembers(tx, session.orgId),
      workers: await assignableWorkers(tx, session.orgId),
      clients: canEdit ? await clientOptions(tx, session.orgId, found.project.clientId) : [],
      diary: await listDiary(tx, session.orgId, id),
      files: await listFiles(tx, session.orgId, id),
      money: q && seesMoney ? await projectMoney(tx, session.orgId, q) : null,
      costing: view === "costs" ? await jobCosting(tx, session.orgId, id) : null,
      costProjects: view === "costs" ? await costProjects(tx, session.orgId) : [],
    };
  });
  if (!data) notFound();
  const { found } = data;
  const p = found.project;
  const tasks = found.tasks;

  return (
    <LiveAppShell active="board" crumbs={["Projects", p.name]}>
      <ProjectHeader
        projectId={p.id}
        view={view}
        values={{ name: p.name, clientId: p.clientId, status: p.status, startDate: p.startDate, endDate: p.endDate, managerMemberId: p.managerMemberId, siteAddress: p.siteAddress, shareProgress: p.shareProgress }}
        clientId={p.clientId}
        clientName={found.clientName}
        managerName={found.managerName}
        quote={p.quoteId && found.quoteNumber ? { id: p.quoteId, ref: quoteRef(found.quoteNumber) } : null}
        counts={{ diary: data.diary.length, files: data.files.length, late: tasks.filter((t) => isLate(t, today)).length }}
        canEdit={canEdit}
        showCosts={seesCosts}
        clients={data.clients}
        members={data.members}
      />
      {view === "overview" && (
        <ProjectOverview
          projectId={p.id}
          quoteId={p.quoteId}
          tasks={tasks}
          phases={found.phases}
          today={today}
          diary={data.diary.map((d) => ({ id: d.id, entryDate: d.entryDate, body: d.body, authorName: d.authorName, photos: d.photos.length }))}
          money={data.money}
          shareProgress={p.shareProgress}
        />
      )}
      {(view === "board" || view === "list" || view === "timeline") && (
        <TasksWorkspace view={view} projectId={p.id} tasks={tasks} phases={found.phases} workers={data.workers} today={today} canEdit={canEdit} projectStart={p.startDate} projectEnd={p.endDate} />
      )}
      {view === "diary" && (
        <SiteDiary
          projectId={p.id}
          entries={data.diary.map((d) => ({ ...d, photos: d.photos.map((ph) => ({ url: publicUrl(ph.key) })) }))}
          today={today}
          canEdit={canEdit}
          storageEnabled={storageConfigured()}
          shareProgress={p.shareProgress}
        />
      )}
      {view === "files" && (
        <ProjectFiles
          projectId={p.id}
          files={data.files.map((f) => ({ id: f.id, name: f.name, url: publicUrl(f.storageKey), contentType: f.contentType, sizeBytes: f.sizeBytes, shareWithClient: f.shareWithClient, uploadedByName: f.uploadedByName, createdAt: f.createdAt }))}
          canEdit={canEdit}
          storageEnabled={storageConfigured()}
          shareProgress={p.shareProgress}
        />
      )}
      {view === "costs" && data.costing && (
        <JobCosts
          projectId={p.id}
          quoteId={p.quoteId}
          costing={data.costing}
          expenses={data.costing.expenses.map(toExpense)}
          projects={data.costProjects.map((x) => ({ id: x.id, name: x.name }))}
          canEdit={can(session.role, "costs.edit")}
          storageEnabled={storageConfigured()}
        />
      )}
    </LiveAppShell>
  );
}
