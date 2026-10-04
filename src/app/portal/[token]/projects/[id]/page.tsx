import type { Metadata } from "next";
import { StoredImage } from "@/components/stored-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, FileImage, FileText, MapPin, ShieldCheck } from "lucide-react";
import { CompanyMark } from "@/components/portal/quote-document";
import { formatAddress } from "@/core/clients";
import { PROJECT_STATUS_LABEL } from "@/core/projects";
import { longDate } from "@/core/quote-snapshot";
import { id as uuid } from "@/core/schemas";
import { withTenant } from "@/db";
import { planAllows } from "@/db/billing";
import { PortalBlocked } from "@/components/portal/portal-gate";
import { requirePortal } from "@/server/portal-auth";
import { portalHeader } from "@/db/portal";
import { portalProject } from "@/db/projects";
import { privateUrl } from "@/server/storage";

type Params = Promise<{ token: string; id: string }>;

async function load(params: Params) {
  const { token, id } = await params;
  if (!uuid.safeParse(id).success) return null;
  const access = await requirePortal(token);
  if (!access) return null;
  const data = await withTenant(access.orgId, async (tx) => {
    if (!(await planAllows(tx, access.orgId, "projects"))) return null;
    const header = await portalHeader(tx, access.orgId, access.clientId);
    const project = await portalProject(tx, access.orgId, access.clientId, id);
    return header && project ? { header, project } : null;
  });
  return data ? { token, ...data } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  return { title: { absolute: data ? `${data.project.name} · progress` : "Project" } };
}

/**
 * How the client's job is going: stage-by-stage progress, key dates, and the updates and files the team
 * chose to share. Never the task list, notes or anything marked team-only.
 */
export default async function PortalProjectPage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) return <PortalBlocked token={(await params).token} />;
  const { project: p, header } = data;
  const company = header.company.tradingName ?? header.company.name;
  const stages = [...p.phases, ...(p.loose.total > 0 ? [{ id: "other", name: "Other work", total: p.loose.total, done: p.loose.done, started: p.loose.started }] : [])].filter((s) => s.total > 0);
  const total = stages.reduce((a, s) => a + s.total, 0);
  const done = stages.reduce((a, s) => a + s.done, 0);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="min-h-screen bg-muted font-sans text-[13.5px] text-ink antialiased">
      <header className="flex h-[60px] items-center gap-3 border-b border-hairline bg-white px-4 sm:px-10">
        <Link href={`/portal/${data.token}`} aria-label="Back to your quotes and projects" className="flex size-8 items-center justify-center rounded-md text-subtle hover:bg-accent">
          <ChevronLeft className="size-4" />
        </Link>
        <CompanyMark company={header.company} />
        <div className="font-semibold">{company}</div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6 sm:py-8">
        <section className="rounded-[14px] bg-white px-6 py-5 shadow-ring">
          <div className="text-[12.5px] text-subtle">Your project</div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.025em]">{p.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
            <span className="rounded-full bg-surface px-2 py-0.5 font-medium">{PROJECT_STATUS_LABEL[p.status]}</span>
            {p.siteAddress && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-subtle" />
                {formatAddress(p.siteAddress)}
              </span>
            )}
            {(p.startDate || p.endDate) && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-subtle" />
                {p.startDate ? longDate(p.startDate) : "To be confirmed"} – {p.endDate ? longDate(p.endDate) : "to be confirmed"}
              </span>
            )}
          </div>
          {total > 0 && (
            <>
              <div className="mt-5 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[20px] font-semibold tabular">{percent}%</span>
              </div>
              <ol className="mt-4 flex flex-col">
                {stages.map((s) => {
                  const finished = s.done === s.total;
                  const started = s.started > 0;
                  return (
                    <li key={s.id} className="flex items-center gap-3 border-t border-muted py-2.5 first:border-0">
                      <span className={`grid size-5 flex-none place-items-center rounded-full ${finished ? "bg-success text-white" : started ? "bg-info-soft text-info" : "bg-muted text-subtle"}`}>
                        {finished ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="flex-1">{s.name}</span>
                      <span className="text-[12px] text-subtle">{finished ? "Done" : started ? "In progress" : "Not started"}</span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>

        {p.diary.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 font-semibold">Updates from site</h2>
            {p.diary.map((d) => (
              <article key={d.id} className="rounded-[14px] bg-white px-5 py-4 shadow-ring">
                <div className="text-[12px] text-subtle">{longDate(d.entryDate)}</div>
                <p className="mt-1 leading-[1.55] whitespace-pre-line">{d.body}</p>
                {d.photos.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {d.photos.map((ph, i) => (
                      <a key={ph.key} href={privateUrl(ph.key)} target="_blank" rel="noreferrer noopener" className="block aspect-square overflow-hidden rounded-[8px] bg-muted">
                        <StoredImage src={privateUrl(ph.key)} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {p.files.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 font-semibold">Documents</h2>
            <ul className="overflow-hidden rounded-[14px] bg-white shadow-ring">
              {p.files.map((f) => {
                const Icon = f.contentType.startsWith("image/") ? FileImage : FileText;
                return (
                  <li key={f.id} className="border-b border-muted last:border-0">
                    <a href={privateUrl(f.storageKey)} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                      <Icon className="size-4 text-subtle" />
                      <span className="flex-1 truncate">{f.name}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="flex items-center gap-1.5 px-1 text-xs text-subtle">
          <ShieldCheck className="size-[13px]" />
          This is your private link from {company}. Please don&apos;t share it. Powered by Builder OS.
        </div>
      </main>
    </div>
  );
}
