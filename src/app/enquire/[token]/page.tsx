import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { findEnquiryForm, withTenant } from "@/db";
import { companyHeader } from "@/db/costs";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Get a quote", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * A company's public enquiry form. Link to it from the website, or embed it with `?embed=1` (no page
 * chrome, sized for an iframe). Enquiries land in the pipeline as new leads.
 */
export default async function EnquiryPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { token } = await params;
  const embed = (await searchParams).embed === "1";
  const orgId = await findEnquiryForm(token);
  if (!orgId) notFound();
  const org = await withTenant(orgId, (tx) => companyHeader(tx, orgId));
  const company = org?.tradingName ?? org?.name ?? "";
  return (
    <main className={cn("min-h-dvh font-sans text-[15px] text-ink", embed ? "bg-transparent p-1" : "bg-surface-2 px-4 py-8 sm:py-12")}>
      <div className={cn("mx-auto w-full max-w-[560px]", !embed && "rounded-2xl bg-white p-6 shadow-ring sm:p-8")}>
        {!embed && (
          <header className="mb-5">
            {org?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- company logo
              <img src={org.logoUrl} alt={company} className="mb-4 max-h-12 max-w-[200px] object-contain" />
            ) : (
              <div className="mb-3 text-[13px] font-semibold text-ink-2">{company}</div>
            )}
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Tell us about your project</h1>
            <p className="mt-1 text-ink-2">A few details and we&apos;ll be in touch, usually within one working day.</p>
          </header>
        )}
        <EnquiryForm token={token} company={company} />
      </div>
      {!embed && <p className="mt-4 text-center text-[12px] text-subtle">Your details go to {company} only, to reply to your enquiry.</p>}
    </main>
  );
}
