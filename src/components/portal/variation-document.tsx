import { formatGBP } from "@/core/money";
import { StoredImage } from "@/components/stored-image";
import { longDate } from "@/core/quote-snapshot";
import type { VariationSnapshot } from "@/core/variation";
import { cn } from "@/lib/utils";

const qty = (n: number) => String(Number(n.toFixed(3)));

/**
 * A sent variation as the client sees it, from its snapshot only. Shared by the client portal and the
 * team's variation screen. Omissions show as credits.
 */
export function VariationDocument({ snapshot, sentAt }: { snapshot: VariationSnapshot; sentAt: Date }) {
  const credit = snapshot.totals.total < 0;
  return (
    <div className="flex flex-col gap-3.5">
      <section className="rounded-[14px] bg-white px-6 py-6 shadow-ring print:shadow-none">
        <div className="text-[12.5px] text-subtle">
          Variation {snapshot.ref} · to quote {snapshot.quote.ref}, {snapshot.quote.title} · {longDate(sentAt)}
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em]">{snapshot.title}</h1>
        {snapshot.reason && <p className="mt-2 leading-[1.6] whitespace-pre-line text-ink-2">{snapshot.reason}</p>}
      </section>

      {snapshot.photos && snapshot.photos.length > 0 && (
        <section className="rounded-[14px] bg-white px-5 py-4 shadow-ring print:shadow-none print:break-inside-avoid">
          <h2 className="mb-2.5 font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {snapshot.photos.map((p, i) => (
              <a key={p.url} href={p.url} target="_blank" rel="noreferrer noopener" className="block aspect-[4/3] overflow-hidden rounded-[10px] bg-muted">
                <StoredImage src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-[14px] bg-white shadow-ring print:shadow-none">
        <div className="flex flex-col px-5 py-2">
          {snapshot.lines.map((l) => (
            <div key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-muted py-2.5 first:border-0">
              <span className="min-w-0 flex-1 text-ink-3">
                {l.name}
                {l.omit && <span className="ml-2 rounded-[5px] bg-info-soft px-1.5 py-px text-[11px] whitespace-nowrap text-info">Taken out</span>}
              </span>
              <span className="text-xs text-subtle tabular">
                {qty(l.qty)} {l.unit} × {formatGBP(l.unitPrice)}
              </span>
              <span className={cn("w-[104px] text-right tabular", l.omit ? "text-info" : "text-ink-3")}>{formatGBP(l.total)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-hairline bg-surface-2 px-5 py-4 tabular">
          <div className="flex justify-between text-ink-2">
            <span>Subtotal</span>
            <span>{formatGBP(snapshot.totals.net)}</span>
          </div>
          <div className="flex justify-between text-ink-2">
            <span>VAT {Number((snapshot.vatRateBps / 100).toFixed(2))}%</span>
            <span>{formatGBP(snapshot.totals.vat)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[15px] font-semibold">
            <span>{credit ? "Credit to you" : "Added to your price"}</span>
            <span>{formatGBP(Math.abs(snapshot.totals.total))}</span>
          </div>
        </div>
      </section>
      <p className="px-1 text-[12px] text-subtle">
        {credit
          ? "Once approved, this credit comes off a future invoice."
          : "Once approved, this is invoiced separately or added to one of your payments, payable by bank transfer."}
      </p>
    </div>
  );
}
