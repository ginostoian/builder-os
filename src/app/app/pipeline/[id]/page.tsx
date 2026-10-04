import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, CalendarClock, FileSpreadsheet, Flag, Mail, MapPin, MessageSquare, Phone, Sparkles } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Automations, Composer, FollowUp, LeadMenu, QuoteCard, StageTrack } from "@/components/app/pipeline/lead-parts";
import { STAGE_TONE } from "@/components/app/pipeline/types";
import { Badge } from "@/components/ui/badge";
import { formatAddress } from "@/core/clients";
import { formatGBP } from "@/core/money";
import { ukToday } from "@/core/payment-plan";
import { LEAD_SOURCE_LABEL, LEAD_STAGES, LEAD_STAGE_LABEL, LOST_REASON_LABEL, visitWhen, type LeadStage } from "@/core/pipeline";
import { quoteRef } from "@/core/quote";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { getLead, leadOwners } from "@/db/pipeline";
import { currentBooking } from "@/db/surveys";
import { SurveyCard } from "@/components/app/pipeline/survey-dialog";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead" };

const KIND_ICON = { created: Sparkles, note: MessageSquare, call: Phone, email: Mail, automation_email: Bot, stage: Flag, visit: CalendarClock, quote: FileSpreadsheet } as const;

const when = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

/** One lead: who, what, where it's at, what's next, and everything that's happened. */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("leads.view");
  const leadId = (await params).id;
  if (!uuid.safeParse(leadId).success) notFound();
  const today = ukToday();
  const data = await withSession(session, async (tx) => ({ found: await getLead(tx, session.orgId, leadId), owners: await leadOwners(tx, session.orgId), booking: await currentBooking(tx, session.orgId, leadId) }));
  if (!data.found) notFound();
  const { lead: l, activity, runs } = data.found;
  const canEdit = can(session.role, "leads.edit");
  const address = l.address ? formatAddress(l.address) : l.postcode;

  return (
    <LiveAppShell active="pipeline" crumbs={["Pipeline", l.name]}>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-2">
        <div className="border-b border-hairline bg-white px-6 pt-[18px] pb-4">
          <Link href="/app/pipeline" className="mb-2 flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Pipeline
          </Link>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-[21px] font-semibold tracking-[-0.02em]">{l.name}</h1>
                <Badge tone={STAGE_TONE[l.stage]}>{LEAD_STAGE_LABEL[l.stage]}</Badge>
                {l.valuePence ? <span className="text-[13px] font-medium tabular">{formatGBP(l.valuePence, 0)}</span> : null}
              </div>
              <div className="mt-0.5 text-subtle">
                {[l.projectType, LEAD_SOURCE_LABEL[l.source] + (l.sourceDetail ? ` (${l.sourceDetail})` : ""), data.found.ownerName ? `Owner: ${data.found.ownerName}` : "No owner"].filter(Boolean).join(" · ")}
              </div>
            </div>
            {canEdit && (
              <LeadMenu
                leadId={l.id}
                owners={data.owners}
                values={{ name: l.name, email: l.email, phone: l.phone, postcode: l.postcode, address: l.address, source: l.source, sourceDetail: l.sourceDetail, projectType: l.projectType, description: l.description, budget: l.budget, valuePence: l.valuePence, ownerMemberId: l.ownerMemberId }}
              />
            )}
          </div>
          <div className="mt-3">
            <StageTrack leadId={l.id} name={l.name} stage={l.stage} visitAt={l.visitAt?.toISOString() ?? null} canEdit={canEdit} />
          </div>
          {l.stage === "lost" && l.lostReason && (
            <p className="mt-2 text-[12.5px] text-ink-2">
              Lost: {LOST_REASON_LABEL[l.lostReason]}
              {l.lostNote ? `. ${l.lostNote}` : ""}
            </p>
          )}
        </div>

        <div className="mx-auto grid w-full max-w-[1160px] grid-cols-[minmax(0,1fr)_340px] items-start gap-4 px-6 py-5">
          <div className="flex flex-col gap-4">
            <section className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[12px] bg-white p-4 shadow-ring">
              <Contact icon={Phone} label="Phone" value={l.phone} href={l.phone ? `tel:${l.phone}` : undefined} />
              <Contact icon={Mail} label="Email" value={l.email} href={l.email ? `mailto:${l.email}` : undefined} note={l.emailOptOut ? "unsubscribed from automatic emails" : undefined} />
              <Contact icon={MapPin} label="Where" value={address} href={address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : undefined} />
              <Contact icon={CalendarClock} label="Site visit" value={l.visitAt ? `${visitWhen(l.visitAt)}${data.booking?.memberName ? `, ${data.booking.memberName}` : ""}` : null} />
              {l.budget && <Contact icon={Flag} label="Budget" value={l.budget} />}
              {l.description && <p className="col-span-2 rounded-lg bg-surface px-3 py-2 whitespace-pre-line text-ink-2">{l.description}</p>}
            </section>

            <Composer leadId={l.id} email={l.email} emailEnabled={emailConfigured()} canEdit={canEdit} />

            <section className="rounded-[12px] bg-white p-4 shadow-ring">
              <h2 className="mb-3 font-semibold">History</h2>
              <ol className="relative flex flex-col gap-4 before:absolute before:top-1 before:bottom-1 before:left-[11px] before:w-px before:bg-hairline">
                {activity.map((a) => {
                  const Icon = KIND_ICON[a.kind];
                  const [title, ...rest] = a.body.split("\n\n");
                  return (
                    <li key={a.id} className="relative flex gap-3">
                      <span className={cn("z-10 flex size-6 flex-none items-center justify-center rounded-full bg-white shadow-ring", a.kind === "automation_email" && "text-info", a.kind === "stage" && "text-brand")}>
                        <Icon className="size-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-subtle">
                          {when(a.createdAt)}
                          {a.memberName ? ` · ${a.memberName}` : a.kind === "automation_email" ? " · automatic" : ""}
                        </div>
                        <div className="whitespace-pre-line">{describe(a.kind, title)}</div>
                        {rest.length > 0 && (
                          <details className="mt-1 text-[12.5px] text-ink-2">
                            <summary className="cursor-pointer text-subtle">Show the email</summary>
                            <p className="mt-1 rounded-lg bg-surface px-3 py-2 whitespace-pre-line">{rest.join("\n\n")}</p>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            {(l.stage !== "won" && l.stage !== "lost") || data.booking ? (
              <SurveyCard
                leadId={l.id}
                name={l.name}
                canEdit={canEdit && l.stage !== "won" && l.stage !== "lost"}
                hasEmail={Boolean(l.email)}
                visit={data.booking ? { when: visitWhen(data.booking.startsAt), who: data.booking.memberName, online: data.booking.bookedBy === "client", past: data.booking.startsAt.getTime() < Date.parse(`${today}T00:00:00Z`) } : null}
              />
            ) : null}
            {l.stage !== "won" && l.stage !== "lost" && <FollowUp leadId={l.id} on={l.nextActionOn} action={l.nextAction} today={today} canEdit={canEdit} />}
            <QuoteCard
              leadId={l.id}
              quote={l.quoteId && data.found.quoteNumber ? { id: l.quoteId, ref: quoteRef(data.found.quoteNumber), status: data.found.quoteStatus ?? "", title: data.found.quoteTitle ?? "" } : null}
              canQuote={can(session.role, "quotes.edit")}
            />
            <Automations
              leadId={l.id}
              runs={runs.map((r) => ({ id: r.id, name: r.name, status: r.status, step: r.step, stepCount: r.stepCount, nextAt: r.nextAt?.toISOString() ?? null, endedReason: r.endedReason }))}
              optedOut={l.emailOptOut}
              hasEmail={Boolean(l.email)}
              canEdit={canEdit}
            />
          </aside>
        </div>
      </div>
    </LiveAppShell>
  );
}

function describe(kind: string, body: string) {
  if (kind === "stage" && (LEAD_STAGES as readonly string[]).includes(body.split(":")[0])) {
    const [stage, ...note] = body.split(": ");
    return `Moved to ${LEAD_STAGE_LABEL[stage as LeadStage]}${note.length ? `: ${note.join(": ")}` : ""}`;
  }
  if (kind === "visit") {
    const iso = body.replace("Site visit booked for ", "");
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? body : `Site visit booked for ${visitWhen(d)}`;
  }
  return body;
}

function Contact({ icon: Icon, label, value, href, note }: { icon: typeof Phone; label: string; value: string | null; href?: string; note?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 size-4 flex-none text-subtle" />
      <div className="min-w-0">
        <div className="text-[11.5px] text-subtle">{label}</div>
        {value ? (
          href ? (
            <a href={href} className="block truncate font-medium hover:underline" target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {value}
            </a>
          ) : (
            <div className="truncate font-medium">{value}</div>
          )
        ) : (
          <div className="text-faint-2">–</div>
        )}
        {note && <div className="text-[11.5px] text-warning">{note}</div>}
      </div>
    </div>
  );
}
