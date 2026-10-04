import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Phone, Search, Workflow } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { AddLeadButton } from "@/components/app/pipeline/add-lead-button";
import { PipelineBoard } from "@/components/app/pipeline/pipeline-board";
import { STAGE_TONE, type LeadCard } from "@/components/app/pipeline/types";
import { shortDay } from "@/components/app/projects/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { addDays, ukToday } from "@/core/payment-plan";
import { LEAD_SOURCE_LABEL, LEAD_STAGES, LEAD_STAGE_LABEL, LOST_REASON_LABEL, OPEN_STAGES, followUpState, type LeadStage } from "@/core/pipeline";
import { quoteRef } from "@/core/quote";
import { can } from "@/core/roles";
import { followUpsDue, leadOwners, listLeads, pipelineInsights, type LeadRow } from "@/db/pipeline";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pipeline" };

const VIEWS = [
  { key: "board", label: "Board" },
  { key: "list", label: "List" },
  { key: "insights", label: "Insights" },
] as const;
type View = (typeof VIEWS)[number]["key"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const toCard = (l: LeadRow): LeadCard => ({
  id: l.id,
  name: l.name,
  email: l.email,
  phone: l.phone,
  postcode: l.postcode ?? l.address?.postcode ?? null,
  source: l.source,
  projectType: l.projectType,
  description: l.description,
  valuePence: l.valuePence,
  stage: l.stage,
  ownerName: l.ownerName,
  nextActionOn: l.nextActionOn,
  nextAction: l.nextAction,
  visitAt: l.visitAt?.toISOString() ?? null,
  lostReason: l.lostReason,
  quoteNumber: l.quoteNumber,
  quoteStatus: l.quoteStatus,
  viaWebForm: l.viaWebForm,
  createdAt: l.createdAt.toISOString(),
  stageChangedAt: l.stageChangedAt.toISOString(),
});

/** Every enquiry from first call to won or lost: a board to work from, a list to search, and what's working. */
export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; q?: string | string[]; stage?: string | string[]; mine?: string | string[]; new?: string | string[] }> }) {
  const session = await requirePermission("leads.view");
  const p = await searchParams;
  const view: View = VIEWS.find((v) => v.key === first(p.view))?.key ?? "board";
  const q = first(p.q)?.slice(0, 100) ?? "";
  const stage = LEAD_STAGES.find((s) => s === first(p.stage));
  const mine = first(p.mine) === "1";
  const today = ukToday();
  const canEdit = can(session.role, "leads.edit");
  const since = new Date(`${addDays(today, -365)}T00:00:00Z`);
  const data = await withSession(session, async (tx) => ({
    owners: await leadOwners(tx, session.orgId),
    due: await followUpsDue(tx, session.orgId, today, mine ? session.memberId : undefined),
    leads:
      view === "insights"
        ? []
        : await listLeads(tx, session.orgId, {
            ownerId: mine ? session.memberId : undefined,
            search: q || undefined,
            stages: view === "list" && stage ? [stage] : undefined,
            closedSince: view === "board" ? new Date(`${addDays(today, -30)}T00:00:00Z`) : undefined,
          }),
    insights: view === "insights" ? await pipelineInsights(tx, session.orgId, since) : null,
  }));
  const href = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { view: view === "board" ? undefined : view, q: q || undefined, stage: stage, mine: mine ? "1" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/app/pipeline${s ? `?${s}` : ""}`;
  };
  const open = data.leads.filter((l) => (OPEN_STAGES as readonly string[]).includes(l.stage));
  const openValue = open.reduce((s, l) => s + (l.valuePence ?? 0), 0);

  return (
    <LiveAppShell active="pipeline" crumbs={["Pipeline", VIEWS.find((v) => v.key === view)!.label]}>
      <div className="flex min-h-0 flex-1 flex-col bg-surface-2">
        <div className="flex flex-col gap-3 px-6 pt-[18px] pb-3">
          <ScreenTitle title="Pipeline" subtitle={view === "insights" ? "Where your work comes from, and what wins it." : `${open.length} open lead${open.length === 1 ? "" : "s"}${openValue ? `, ${formatGBP(openValue, 0)} of work` : ""}.`}>
            {can(session.role, "automations.manage") && (
              <>
                <Button asChild variant="ghost">
                  <Link href="/app/pipeline/form">
                    <Globe />
                    Web form
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/app/pipeline/automations">
                    <Workflow />
                    Automations
                  </Link>
                </Button>
              </>
            )}
            {canEdit && <AddLeadButton owners={data.owners} meId={session.memberId} startOpen={first(p.new) === "1"} />}
          </ScreenTitle>

          {data.due.length > 0 && view !== "insights" && (
            <Panel className="flex items-start gap-3 px-4 py-2.5">
              <Phone className="mt-0.5 size-4 flex-none text-warning" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {data.due.length} follow-up{data.due.length === 1 ? "" : "s"} due{mine ? " for you" : ""}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]">
                  {data.due.slice(0, 8).map((d) => (
                    <Link key={d.id} href={`/app/pipeline/${d.id}`} className={cn("hover:underline", d.nextActionOn! < today ? "text-danger" : "text-ink-2")}>
                      {d.name}: {d.nextAction ?? "follow up"}
                      {d.nextActionOn! < today ? ` (since ${shortDay(d.nextActionOn!)})` : ""}
                    </Link>
                  ))}
                  {data.due.length > 8 && <span className="text-subtle">and {data.due.length - 8} more</span>}
                </div>
              </div>
            </Panel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex gap-1.5" aria-label="Pipeline views">
              {VIEWS.map((v) => (
                <Link key={v.key} href={href({ view: v.key === "board" ? undefined : v.key })} aria-current={v.key === view ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", v.key === view ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}>
                  {v.label}
                </Link>
              ))}
            </nav>
            <Link href={href({ mine: mine ? undefined : "1" })} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", mine ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}>
              Mine
            </Link>
            {view !== "insights" && (
              <form action="/app/pipeline" className="relative ml-auto">
                {view !== "board" && <input type="hidden" name="view" value={view} />}
                {mine && <input type="hidden" name="mine" value="1" />}
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
                <input name="q" defaultValue={q} placeholder="Name, email, phone or postcode" className="h-8 w-[260px] rounded-md bg-white pr-2.5 pl-8 text-[13px] shadow-ring-input outline-none" />
              </form>
            )}
          </div>
        </div>

        {view === "board" && <PipelineBoard leads={data.leads.map(toCard)} today={today} canEdit={canEdit} />}
        {view === "list" && <LeadList leads={data.leads} today={today} stage={stage} href={href} />}
        {view === "insights" && data.insights && <Insights i={data.insights} />}
      </div>
    </LiveAppShell>
  );
}

function LeadList({ leads, today, stage, href }: { leads: LeadRow[]; today: string; stage: LeadStage | undefined; href: (o: Record<string, string | undefined>) => string }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
      <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Filter by stage">
        <Link href={href({ stage: undefined })} className={cn("rounded-full px-2.5 py-0.5 text-[12px]", !stage ? "bg-ink-2 text-white" : "bg-white text-ink-2 shadow-ring")}>
          All
        </Link>
        {LEAD_STAGES.map((s) => (
          <Link key={s} href={href({ stage: s })} className={cn("rounded-full px-2.5 py-0.5 text-[12px]", stage === s ? "bg-ink-2 text-white" : "bg-white text-ink-2 shadow-ring")}>
            {LEAD_STAGE_LABEL[s]}
          </Link>
        ))}
      </nav>
      <Panel className="overflow-hidden">
        {leads.length === 0 ? (
          <p className="px-6 py-10 text-center text-subtle">No leads here.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-hairline text-left text-[12px] text-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">Lead</th>
                <th className="px-2 py-2 font-medium">Stage</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Owner</th>
                <th className="px-2 py-2 font-medium">Next</th>
                <th className="px-2 py-2 font-medium">Quote</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const due = followUpState(l.nextActionOn, today);
                return (
                  <tr key={l.id} className="border-b border-muted last:border-0 hover:bg-surface-2">
                    <td className="max-w-[280px] px-4 py-2">
                      <Link href={`/app/pipeline/${l.id}`} className="block truncate font-medium hover:underline">
                        {l.name}
                      </Link>
                      <span className="block truncate text-[11.5px] text-subtle">{[l.projectType, l.postcode ?? l.address?.postcode, l.phone].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={STAGE_TONE[l.stage]}>{LEAD_STAGE_LABEL[l.stage]}</Badge>
                      {l.stage === "lost" && l.lostReason && <div className="text-[11px] text-subtle">{LOST_REASON_LABEL[l.lostReason]}</div>}
                    </td>
                    <td className="px-2 py-2 text-ink-2">{LEAD_SOURCE_LABEL[l.source]}</td>
                    <td className="px-2 py-2 text-ink-2">{l.ownerName ?? "–"}</td>
                    <td className={cn("px-2 py-2 text-[12.5px]", due === "overdue" ? "font-medium text-danger" : due === "today" ? "font-medium text-warning" : "text-ink-2")}>
                      {l.nextActionOn ? `${l.nextAction ?? "Follow up"} · ${l.nextActionOn === today ? "today" : shortDay(l.nextActionOn)}` : "–"}
                    </td>
                    <td className="px-2 py-2 font-mono text-[12px]">
                      {l.quoteId && l.quoteNumber ? (
                        <Link href={`/app/quotes/${l.quoteId}`} className="hover:underline">
                          {quoteRef(l.quoteNumber)}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular">{l.valuePence ? formatGBP(l.valuePence, 0) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Insights({ i }: { i: Awaited<ReturnType<typeof pipelineInsights>> }) {
  const total = i.bySource.reduce((s, r) => s + r.leads, 0);
  const won = i.bySource.reduce((s, r) => s + r.won, 0);
  const decided = i.bySource.reduce((s, r) => s + r.won + r.lost, 0);
  const wonValue = i.bySource.reduce((s, r) => s + r.wonValue, 0);
  const lostTotal = i.lostReasons.reduce((s, r) => s + r.n, 0);
  const openValue = i.open.reduce((s, r) => s + r.value, 0);
  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Leads (12 months)" value={String(total)} />
          <Kpi label="Win rate" value={decided ? `${Math.round((won / decided) * 100)}%` : "–"} sub={`${won} won of ${decided} decided`} />
          <Kpi label="Won" value={formatGBP(wonValue, 0)} sub="Value of won leads" />
          <Kpi label="Enquiry to win" value={i.avgDaysToWin !== null ? `${i.avgDaysToWin} days` : "–"} sub="On average" />
        </div>
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-4">
          <Panel className="overflow-hidden">
            <h2 className="border-b border-hairline px-4 py-2.5 font-semibold">Where your work comes from</h2>
            {i.bySource.length === 0 ? (
              <p className="px-4 py-6 text-subtle">No leads yet.</p>
            ) : (
              <table className="w-full tabular">
                <thead className="text-left text-[12px] text-subtle">
                  <tr>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 text-right font-medium">Leads</th>
                    <th className="px-2 py-2 text-right font-medium">Won</th>
                    <th className="px-2 py-2 text-right font-medium">Win rate</th>
                    <th className="px-4 py-2 text-right font-medium">Won value</th>
                  </tr>
                </thead>
                <tbody>
                  {i.bySource.map((r) => (
                    <tr key={r.source} className="border-t border-muted">
                      <td className="px-4 py-2 font-medium">{LEAD_SOURCE_LABEL[r.source]}</td>
                      <td className="px-2 py-2 text-right">{r.leads}</td>
                      <td className="px-2 py-2 text-right">{r.won}</td>
                      <td className="px-2 py-2 text-right">{r.won + r.lost ? `${Math.round((r.won / (r.won + r.lost)) * 100)}%` : "–"}</td>
                      <td className="px-4 py-2 text-right">{formatGBP(r.wonValue, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel className="p-4">
              <h2 className="mb-2 font-semibold">Why leads are lost</h2>
              {i.lostReasons.length === 0 ? (
                <p className="text-subtle">None lost. Long may it last.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {i.lostReasons.map((r) => (
                    <li key={r.reason ?? "none"}>
                      <div className="flex justify-between text-[12.5px]">
                        <span>{r.reason ? LOST_REASON_LABEL[r.reason] : "No reason"}</span>
                        <span className="text-subtle tabular">{r.n}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-ink-2" style={{ width: `${(r.n / lostTotal) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="p-4">
              <h2 className="mb-2 font-semibold">Open now</h2>
              <ul className="flex flex-col gap-1.5 tabular">
                {OPEN_STAGES.map((s) => {
                  const r = i.open.find((o) => o.stage === s);
                  return (
                    <li key={s} className="flex justify-between text-[12.5px]">
                      <span className="text-ink-2">{LEAD_STAGE_LABEL[s]}</span>
                      <span>
                        {r?.n ?? 0}
                        {r?.value ? ` · ${formatGBP(r.value, 0)}` : ""}
                      </span>
                    </li>
                  );
                })}
                <li className="mt-1 flex justify-between border-t border-hairline pt-1.5 font-semibold">
                  <span>Pipeline value</span>
                  <span>{formatGBP(openValue, 0)}</span>
                </li>
              </ul>
            </Panel>
          </div>
        </div>
        <p className="text-[12px] text-subtle">Leads from the last 12 months. Value is each lead&apos;s rough value; set it when you add the lead or once you&apos;ve quoted.</p>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 shadow-ring">
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className="mt-1.5 mb-1 text-2xl font-semibold tracking-[-0.02em] tabular">{value}</div>
      {sub && <div className="text-xs text-subtle">{sub}</div>}
    </div>
  );
}
