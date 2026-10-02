import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { CompanyMark } from "@/components/portal/quote-document";
import { longDate } from "@/core/quote-snapshot";
import { formatGBP } from "@/core/money";
import { quoteRef } from "@/core/quote";
import { findPortalAccess, withTenant } from "@/db";
import { portalHeader, portalQuotes } from "@/db/portal";

export const metadata: Metadata = { title: { absolute: "Your quotes" } };

const STATUS: Record<string, { label: string; className: string }> = {
  sent: { label: "Awaiting your reply", className: "bg-info-soft text-info" },
  viewed: { label: "Awaiting your reply", className: "bg-info-soft text-info" },
  accepted: { label: "Accepted", className: "bg-success-soft text-success" },
  declined: { label: "Declined", className: "bg-line text-ink-2" },
  draft: { label: "Being updated", className: "bg-warning-soft text-warning" },
  expired: { label: "Expired", className: "bg-line text-ink-2" },
};

/** The client's portal home: every quote they've been sent by this company. */
export default async function PortalHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await findPortalAccess(token);
  if (!access) notFound();
  const data = await withTenant(access.orgId, async (tx) => {
    const header = await portalHeader(tx, access.orgId, access.clientId);
    return header && { ...header, quotes: await portalQuotes(tx, access.orgId, access.clientId) };
  });
  if (!data) notFound();
  const company = data.company.tradingName ?? data.company.name;

  return (
    <div className="min-h-screen bg-muted font-sans text-[13.5px] text-ink antialiased">
      <header className="flex h-[60px] items-center gap-3 border-b border-hairline bg-white px-4 sm:px-10">
        <CompanyMark company={data.company} />
        <div className="font-semibold">{company}</div>
      </header>
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">Hello {data.clientName}</h1>
          <p className="mt-1 text-ink-2">Your quotes from {company}. Open one to read it, ask questions or accept it.</p>
        </div>
        {data.quotes.length === 0 ? (
          <div className="rounded-[14px] bg-white px-6 py-10 text-center text-ink-2 shadow-ring">Nothing here yet. Quotes from {company} will appear here as soon as they&apos;re sent.</div>
        ) : (
          <ul className="overflow-hidden rounded-[14px] bg-white shadow-ring">
            {data.quotes.map((q) => {
              const status = STATUS[q.status] ?? STATUS.sent;
              return (
                <li key={q.id} className="border-b border-line last:border-0">
                  <Link href={`/portal/${token}/quotes/${q.number}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{q.title}</div>
                      <div className="mt-0.5 text-[12.5px] text-subtle">
                        {quoteRef(q.number)} · sent {longDate(q.sentAt)}
                      </div>
                      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-medium sm:hidden ${status.className}`}>{status.label}</span>
                    </div>
                    <span className={`hidden rounded-full px-2 py-0.5 text-[11.5px] font-medium sm:inline ${status.className}`}>{status.label}</span>
                    <span className="w-[100px] text-right font-medium tabular">{formatGBP(q.totalPence)}</span>
                    <ChevronRight className="size-4 text-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-1.5 px-1 text-xs text-subtle">
          <ShieldCheck className="size-[13px]" />
          This is your private link from {company}. Please don&apos;t share it. Powered by Builder OS.
        </div>
      </main>
    </div>
  );
}
