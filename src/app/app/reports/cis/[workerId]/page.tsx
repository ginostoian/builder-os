import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PrintButton } from "@/components/app/costs/print-button";
import { taxMonth } from "@/core/cis";
import { formatGBP } from "@/core/money";
import { longDate } from "@/core/quote-snapshot";
import { id as uuid } from "@/core/schemas";
import { cisPayments, cisSettings } from "@/db/cis";
import { companyHeader } from "@/db/costs";
import { workers } from "@/db/schema";
import { requirePermission, withSession } from "@/auth/session";
import { ukToday } from "@/core/payment-plan";

export const metadata: Metadata = { title: "CIS statement" };

/**
 * The payment and deduction statement HMRC asks contractors to give each subcontractor for the tax month
 * (within 14 days of it ending). Print it or save it as a PDF and send it to them.
 */
export default async function CisStatementPage({ params, searchParams }: { params: Promise<{ workerId: string }>; searchParams: Promise<{ month?: string | string[] }> }) {
  const session = await requirePermission("costs.view");
  const workerId = (await params).workerId;
  if (!uuid.safeParse(workerId).success) notFound();
  const raw = (await searchParams).month;
  const day = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) ? raw : ukToday();
  const m = taxMonth(day);
  const data = await withSession(session, async (tx) => {
    const [w] = await tx
      .select({ name: workers.name, utr: workers.utr, status: workers.cisStatus, verificationRef: workers.cisVerificationRef })
      .from(workers)
      .where(and(eq(workers.orgId, session.orgId), eq(workers.id, workerId)));
    if (!w) return null;
    return { w, payments: await cisPayments(tx, session.orgId, workerId, m.start, m.end), org: await companyHeader(tx, session.orgId), settings: await cisSettings(tx, session.orgId) };
  });
  if (!data) notFound();
  const { w, payments } = data;
  const company = data.org?.tradingName ?? data.org?.name ?? session.orgName;
  const sum = (f: (p: (typeof payments)[number]) => number) => payments.reduce((a, p) => a + f(p), 0);
  const gross = sum((p) => p.netPence);
  const materials = sum((p) => p.materialsPence ?? 0);
  const deducted = sum((p) => p.deductionPence ?? 0);

  return (
    <div className="min-h-dvh bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[760px] justify-end px-4 print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[760px] bg-white p-6 text-[13px] text-ink shadow-ring sm:p-10 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-lg font-semibold">{company}</div>
            {data.settings.employerRef && <div className="text-ink-2">Employer reference: {data.settings.employerRef}</div>}
          </div>
          <div className="text-right">
            <div className="text-[19px] font-semibold tracking-[-0.02em]">CIS payment and deduction statement</div>
            <div className="text-ink-2">Tax month ending {longDate(m.end)}</div>
          </div>
        </header>

        <dl className="mt-8 grid grid-cols-[180px_minmax(0,1fr)] gap-y-1.5">
          <dt className="text-subtle">Subcontractor</dt>
          <dd className="font-medium">{w.name}</dd>
          <dt className="text-subtle">UTR</dt>
          <dd>{w.utr ?? "Not given"}</dd>
          {w.verificationRef && (
            <>
              <dt className="text-subtle">Verification number</dt>
              <dd>{w.verificationRef}</dd>
            </>
          )}
        </dl>

        <table className="mt-8 w-full tabular">
          <thead className="border-b border-hairline text-left text-[12px] text-subtle">
            <tr>
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Job</th>
              <th className="py-2 text-right font-medium">Gross</th>
              <th className="py-2 text-right font-medium">Materials</th>
              <th className="py-2 text-right font-medium">Deducted</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-muted">
                <td className="py-2">{longDate(p.spentOn)}</td>
                <td className="py-2">
                  {p.projectName}
                  <div className="text-[11.5px] text-subtle">
                    {p.description} · {(p.rateBps ?? 0) / 100}%
                  </div>
                </td>
                <td className="py-2 text-right">{formatGBP(p.netPence)}</td>
                <td className="py-2 text-right">{formatGBP(p.materialsPence ?? 0)}</td>
                <td className="py-2 text-right">{formatGBP(p.deductionPence ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-6 ml-auto grid max-w-[340px] grid-cols-[1fr_auto] gap-y-1.5 tabular">
          <dt className="text-ink-2">Gross amount paid (excluding VAT)</dt>
          <dd className="text-right font-medium">{formatGBP(gross)}</dd>
          <dt className="text-ink-2">Less cost of materials</dt>
          <dd className="text-right">{formatGBP(materials)}</dd>
          <dt className="text-ink-2">Amount liable to deduction</dt>
          <dd className="text-right">{formatGBP(Math.max(0, gross - materials))}</dd>
          <dt className="border-t border-hairline pt-1.5 font-semibold">Amount deducted</dt>
          <dd className="border-t border-hairline pt-1.5 text-right font-semibold">{formatGBP(deducted)}</dd>
        </dl>

        <p className="mt-10 text-[12px] text-subtle">
          {payments.length === 0
            ? "No payments under CIS to this subcontractor in this tax month."
            : `Keep this statement: it shows the tax deducted from your payments, which counts towards your tax and National Insurance.`}
        </p>
      </article>
    </div>
  );
}
