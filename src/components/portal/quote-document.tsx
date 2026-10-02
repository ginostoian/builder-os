"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, MapPin, MessageSquare, StickyNote } from "lucide-react";
import { formatAddress } from "@/core/clients";
import { formatGBP } from "@/core/money";
import { longDate, type QuoteSnapshot } from "@/core/quote-snapshot";
import { cn } from "@/lib/utils";

const KIND: Record<string, string> = { pc_sum: "PC sum", provisional: "Provisional sum" };
const qty = (n: number) => String(Number(n.toFixed(3)));

/**
 * A sent quote as the client sees it, rendered from the version snapshot only. Shared by the client portal,
 * the team's "preview as client" and the sent-quote screen, so all three show exactly the same thing.
 */
export function QuoteDocument({
  snapshot,
  sentAt,
  commentCounts,
  onCommentLine,
}: {
  snapshot: QuoteSnapshot;
  sentAt: Date;
  /** Comments per snapshot line id, shown as a small count. */
  commentCounts?: Map<string, number>;
  /** When set, each line gets a "Comment" button. */
  onCommentLine?: (line: { id: string; name: string }) => void;
}) {
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set());
  const q = snapshot.quote;
  return (
    <div className="flex flex-col gap-3.5">
      <section className="rounded-[14px] bg-white px-6 py-6 shadow-ring print:shadow-none">
        <div className="text-[12.5px] text-subtle">
          {q.ref}
          {q.versionNo > 1 && ` · version ${q.versionNo}`} · Prepared for {snapshot.client.name} · {longDate(sentAt)}
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em]">{q.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          {q.siteAddress && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-subtle" />
              {formatAddress(q.siteAddress)}
            </span>
          )}
          {q.validUntil && <span>Valid until {longDate(q.validUntil)}</span>}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] bg-white shadow-ring print:shadow-none">
        {snapshot.sections.map((s) => {
          const open = !closed.has(s.id);
          return (
            <div key={s.id} className="border-b border-line last:border-0 print:break-inside-avoid">
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setClosed((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    return next;
                  })
                }
                className="flex min-h-11 w-full items-center gap-3 px-5 py-3.5 text-left"
              >
                {open ? <ChevronDown className="size-[15px] text-subtle print:hidden" /> : <ChevronRight className="size-[15px] text-subtle print:hidden" />}
                <span className="flex-1 font-semibold">{s.name}</span>
                <span className="text-xs text-subtle">
                  {s.lines.length} {s.lines.length === 1 ? "item" : "items"}
                </span>
                <span className="w-[96px] text-right font-medium tabular">{formatGBP(s.total)}</span>
              </button>
              <div className={cn("flex flex-col px-5 pb-3 sm:pl-12", !open && "hidden print:flex")}>
                {s.lines.map((l) => {
                  const n = commentCounts?.get(l.id) ?? 0;
                  return (
                    <div key={l.id} id={`line-${l.id}`} className="group border-t border-muted py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="min-w-0 flex-1 text-ink-3">
                          {l.name}
                          {KIND[l.kind] && <span className="ml-2 rounded-[5px] bg-warning-soft px-1.5 py-px text-[11px] whitespace-nowrap text-warning">{KIND[l.kind]}</span>}
                        </span>
                        <span className="text-xs text-subtle tabular">
                          {qty(l.qty)} {l.unit} × {formatGBP(l.unitPrice)}
                        </span>
                        <span className="w-[96px] text-right text-ink-3 tabular">{formatGBP(l.total)}</span>
                      </div>
                      {l.note && (
                        <div className="mt-1.5 flex gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs leading-normal whitespace-pre-line text-ink-2">
                          <StickyNote className="size-[13px] flex-none text-brand" />
                          {l.note}
                        </div>
                      )}
                      {(onCommentLine || n > 0) && (
                        <div className="mt-1 flex gap-3 text-xs print:hidden">
                          {n > 0 && (
                            <span className="flex items-center gap-1 text-ink-2">
                              <MessageSquare className="size-3" />
                              {n} {n === 1 ? "comment" : "comments"}
                            </span>
                          )}
                          {onCommentLine && (
                            <button type="button" onClick={() => onCommentLine(l)} className="text-subtle underline-offset-2 hover:text-ink hover:underline sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                              Comment on this line
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex flex-col gap-1 border-t border-hairline bg-surface-2 px-5 py-4 tabular">
          <div className="flex justify-between text-ink-2">
            <span>Subtotal</span>
            <span>{formatGBP(snapshot.totals.net)}</span>
          </div>
          <div className="flex justify-between text-ink-2">
            <span>VAT {Number((q.vatRateBps / 100).toFixed(2))}%</span>
            <span>{formatGBP(snapshot.totals.vat)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[15px] font-semibold">
            <span>Total</span>
            <span>{formatGBP(snapshot.totals.total)}</span>
          </div>
        </div>
      </section>

      {snapshot.company.terms && (
        <section className="rounded-[14px] bg-white px-6 py-5 shadow-ring print:shadow-none">
          <h2 className="mb-2 font-semibold">Terms</h2>
          <p className="leading-[1.6] whitespace-pre-line text-ink-2">{snapshot.company.terms}</p>
        </section>
      )}
    </div>
  );
}

/** The contractor's brand at the top of the portal: logo, or initials on their brand colour. */
export function CompanyMark({ company }: { company: { name: string; tradingName: string | null; logoUrl: string | null; brandColour: string | null } }) {
  const name = company.tradingName ?? company.name;
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return company.logoUrl ? (
    // A company's own https logo URL (validated in settings). Plain <img>: we don't proxy arbitrary hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={company.logoUrl} alt={name} referrerPolicy="no-referrer" className="h-8 max-w-[160px] object-contain" />
  ) : (
    <span className="flex size-8 flex-none items-center justify-center rounded-lg text-xs font-semibold text-white" style={{ background: company.brandColour ?? "#10100F" }}>
      {initials || "•"}
    </span>
  );
}
