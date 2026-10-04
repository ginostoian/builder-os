import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/costs/print-button";
import { formatAddress } from "@/core/clients";
import { poLineTotal, poRef, poTotals } from "@/core/costs";
import { formatGBP } from "@/core/money";
import { longDate } from "@/core/quote-snapshot";
import { id as uuid } from "@/core/schemas";
import { companyHeader, getPurchaseOrder } from "@/db/costs";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "Purchase order" };

/** The order as a document, to print or save as PDF and send to the supplier. */
export default async function PrintPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("costs.view");
  const poId = (await params).id;
  if (!uuid.safeParse(poId).success) notFound();
  const data = await withSession(session, async (tx) => ({
    found: await getPurchaseOrder(tx, session.orgId, poId),
    org: await companyHeader(tx, session.orgId),
  }));
  if (!data.found) notFound();
  const { po, siteAddress, projectName, createdByName } = data.found;
  const t = poTotals(po.lines, po.vatRateBps);
  const company = data.org?.tradingName ?? data.org?.name ?? session.orgName;

  return (
    <div className="min-h-dvh bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[760px] justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[760px] bg-white p-10 text-[13px] text-ink shadow-ring print:shadow-none">
        <header className="flex items-start justify-between gap-6">
          <div>
            {data.org?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- company logo
              <img src={data.org.logoUrl} alt={company} className="mb-2 max-h-12 max-w-[200px] object-contain" />
            ) : (
              <div className="text-lg font-semibold">{company}</div>
            )}
            {data.org?.vatNumber && <div className="text-subtle">VAT {data.org.vatNumber}</div>}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold tracking-[-0.02em]">Purchase order</div>
            <div className="font-mono">{poRef(po.number)}</div>
            <div className="text-subtle">{longDate(po.orderedOn ?? po.createdAt.toISOString().slice(0, 10))}</div>
          </div>
        </header>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="text-[11.5px] font-medium tracking-wide text-subtle uppercase">Supplier</div>
            <div className="mt-1 font-medium">{po.supplierName}</div>
            {po.supplierEmail && <div className="text-ink-2">{po.supplierEmail}</div>}
          </div>
          <div>
            <div className="text-[11.5px] font-medium tracking-wide text-subtle uppercase">Deliver to</div>
            <div className="mt-1 font-medium">{siteAddress ? formatAddress(siteAddress) : projectName}</div>
            {po.neededBy && <div className="text-ink-2">Needed by {longDate(po.neededBy)}</div>}
            {po.deliveryNotes && <div className="mt-1 whitespace-pre-line text-ink-2">{po.deliveryNotes}</div>}
          </div>
        </div>
        <table className="mt-8 w-full tabular">
          <thead className="border-b border-ink text-left text-[12px]">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 pl-3 font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-b border-hairline">
                <td className="py-2 pr-3">{l.description}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 pl-3">{l.unit}</td>
                <td className="py-2 text-right">{formatGBP(l.unitPricePence)}</td>
                <td className="py-2 text-right">{formatGBP(poLineTotal(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto flex w-[260px] flex-col gap-1 tabular">
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd>{formatGBP(t.net)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">VAT ({po.vatRateBps / 100}%)</dt>
            <dd>{formatGBP(t.vat)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{formatGBP(t.total)}</dd>
          </div>
        </dl>
        <p className="mt-10 text-ink-2">
          Please quote {poRef(po.number)} on your invoice.{createdByName ? ` Ordered by ${createdByName}, ${company}.` : ""}
        </p>
      </article>
    </div>
  );
}
