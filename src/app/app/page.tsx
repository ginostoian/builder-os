import Link from "next/link";
import { CheckCircle2, Eye, FilePen, MessageSquare, Plus, ThumbsDown, Users } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { quoteRef } from "@/core/quote";
import { can } from "@/core/roles";
import { dashboardData } from "@/db/dashboard";
import { invoiceTotals } from "@/db/invoices";
import { getSession, withSession } from "@/auth/session";

const ukHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(d));
const today = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(d);
const ago = (d: Date, now: Date) => {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 1) {
    const hours = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
    return hours < 1 ? "just now" : `${hours}h ago`;
  }
  return days === 1 ? "yesterday" : `${days} days ago`;
};

const ACTIVITY: Record<string, { icon: typeof Eye; text: string; className: string }> = {
  viewed: { icon: Eye, text: "opened", className: "text-info" },
  commented: { icon: MessageSquare, text: "commented on", className: "text-brand" },
  accepted: { icon: CheckCircle2, text: "accepted", className: "text-success" },
  declined: { icon: ThumbsDown, text: "declined", className: "text-ink-2" },
};

export default async function DashboardPage() {
  const session = await getSession();
  const now = new Date();
  const hour = ukHour(now);
  const greeting = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${session.memberName.split(" ")[0]}`;

  // Site leads use the office app but never see prices: give them a simple start page.
  if (!can(session.role, "quotes.edit")) {
    return (
      <LiveAppShell active="dashboard">
        <div className="flex min-h-0 flex-1 flex-col gap-4 bg-surface-2 px-7 py-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{greeting}</h1>
            <div className="mt-0.5 text-subtle">{today(now)}</div>
          </div>
          <Panel className="flex items-center gap-3 p-5">
            <Users className="size-5 text-subtle" />
            <span className="flex-1">Look up a client&apos;s contact details and address.</span>
            <Button variant="secondary" asChild>
              <Link href="/app/clients">Clients</Link>
            </Button>
          </Panel>
        </div>
      </LiveAppShell>
    );
  }

  const canInvoice = can(session.role, "invoices.manage");
  const [d, money] = await withSession(session, async (tx) => [await dashboardData(tx, session.orgId, now), canInvoice ? await invoiceTotals(tx, session.orgId) : null] as const);
  const kpis = [
    { label: "Awaiting reply", value: formatGBP(d.awaitingValue, 0), sub: `${d.awaiting.length} ${d.awaiting.length === 1 ? "quote" : "quotes"} sent` },
    { label: "Won this month", value: formatGBP(d.wonThisMonth.value, 0), sub: `${d.wonThisMonth.count} accepted`, tone: d.wonThisMonth.count > 0 ? "text-success" : undefined },
    { label: "Opened this week", value: String(d.openedThisWeek), sub: "quotes clients looked at" },
    { label: "Win rate", value: d.winRate90 === null ? "–" : `${d.winRate90}%`, sub: d.decided90 ? `of ${d.decided90} decided in 90 days` : "no decisions yet" },
  ];

  return (
    <LiveAppShell active="dashboard">
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto bg-surface-2 px-7 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{greeting}</h1>
            <div className="mt-0.5 text-subtle">{today(now)}</div>
          </div>
          <Button asChild>
            <Link href="/app/quotes/new">
              <Plus />
              New quote
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl bg-white px-4 py-3.5 shadow-card">
              <div className="text-[12.5px] text-ink-2">{k.label}</div>
              <div className="mt-1.5 mb-1 text-2xl font-semibold tracking-[-0.02em] tabular">{k.value}</div>
              <div className={`text-xs ${k.tone ?? "text-subtle"}`}>{k.sub}</div>
            </div>
          ))}
        </div>

        {money && money.outstanding > 0 && (
          <Link href="/app/payments" className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-white px-4 py-3 shadow-card hover:bg-surface">
            <span className="font-medium">Payments</span>
            <span className="tabular">
              <span className="text-subtle">Unpaid </span>
              {formatGBP(money.outstanding, 0)}
            </span>
            <span className={`tabular ${money.overdueCount > 0 ? "text-danger" : ""}`}>
              <span className="text-subtle">Overdue </span>
              {formatGBP(money.overdue, 0)}
              {money.overdueCount > 0 && ` (${money.overdueCount})`}
            </span>
            <span className="tabular">
              <span className="text-subtle">Due in 7 days </span>
              {formatGBP(money.dueThisWeek, 0)}
            </span>
            <span className="ml-auto text-[12.5px] text-ink-2">View payments →</span>
          </Link>
        )}

        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-3">
          <div className="flex flex-col gap-3">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-[18px] pt-4 pb-2">
                <h2 className="font-semibold">Awaiting a reply</h2>
                <span className="text-xs text-subtle">Oldest first</span>
              </div>
              {d.awaiting.length === 0 ? (
                <p className="px-[18px] pb-4 text-ink-2">Nothing waiting. Quotes you send show here until the client accepts or declines.</p>
              ) : (
                <ul>
                  {d.awaiting.slice(0, 8).map((q) => (
                    <li key={q.id} className="border-t border-hairline">
                      <Link href={`/app/quotes/${q.id}`} className="flex items-center gap-3 px-[18px] py-2.5 hover:bg-surface">
                        <span className="font-mono text-[11.5px] text-subtle">{quoteRef(q.number)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{q.title}</span>
                          <span className="block truncate text-[12px] text-subtle">
                            {q.clientName} · sent {ago(q.sentAt, now)} · {q.views === 0 ? "not opened yet" : `opened ${q.views}×`}
                          </span>
                        </span>
                        <span className="font-medium tabular">{formatGBP(q.total, 0)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-[18px] pt-4 pb-2">
                <h2 className="font-semibold">Drafts in progress</h2>
                <Link href="/app/quotes" className="text-xs text-ink-2 hover:text-ink">
                  All quotes
                </Link>
              </div>
              {d.drafts.length === 0 ? (
                <p className="px-[18px] pb-4 text-ink-2">No drafts. Start a quote from a client or the button above.</p>
              ) : (
                <ul>
                  {d.drafts.map((q) => (
                    <li key={q.id} className="border-t border-hairline">
                      <Link href={`/app/quotes/${q.id}`} className="flex items-center gap-3 px-[18px] py-2.5 hover:bg-surface">
                        <FilePen className="size-3.5 text-subtle" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{q.title}</span>
                          <span className="text-subtle"> · {q.clientName}</span>
                        </span>
                        <span className="text-[12px] text-subtle">edited {ago(q.updatedAt, now)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel className="px-[18px] py-4">
            <h2 className="mb-2 font-semibold">Client activity</h2>
            {d.activity.length === 0 ? (
              <p className="text-ink-2">When clients open, comment on or accept a quote, you&apos;ll see it here.</p>
            ) : (
              <ol className="flex flex-col">
                {d.activity.map((a) => {
                  const look = ACTIVITY[a.kind] ?? ACTIVITY.viewed;
                  return (
                    <li key={a.id} className="border-t border-hairline first:border-0">
                      <Link href={`/app/quotes/${a.quoteId}`} className="flex gap-2.5 py-2.5 hover:text-ink">
                        <look.icon className={`mt-0.5 size-4 flex-none ${look.className}`} />
                        <span className="min-w-0 flex-1 text-[12.5px] leading-normal">
                          <span className="font-medium">{a.clientName}</span> {look.text} <span className="font-medium">{a.title}</span>
                          <span className="block text-subtle">
                            {quoteRef(a.number)} · {ago(a.createdAt, now)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </LiveAppShell>
  );
}
