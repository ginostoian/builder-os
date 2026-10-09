import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Estimator } from "@/components/estimator/estimator";
import { findEstimator, withTenant } from "@/db";
import { companyHeader } from "@/db/costs";
import { getEstimator } from "@/db/estimator";
import { formToken } from "@/server/rate-limit";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Project cost estimator", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * A company's cost estimator, for its own website: link to it, or embed it with `?embed=1` (no page chrome,
 * sized for an iframe that grows to fit). Estimates use the company's settings; asking for a quote sends
 * the company an enquiry (and a lead on the Pro plan).
 */
export default async function EstimatePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { token } = await params;
  const embed = (await searchParams).embed === "1";
  const orgId = await findEstimator(token);
  if (!orgId) notFound();
  const { org, settings } = await withTenant(orgId, async (tx) => ({ org: await companyHeader(tx, orgId), settings: (await getEstimator(tx, orgId)).settings }));
  const company = org?.tradingName ?? org?.name ?? "";
  return (
    <main className={cn("font-sans text-[15px] text-ink", embed ? "bg-transparent p-1" : "min-h-dvh bg-surface-2 px-4 py-8 sm:py-12")}>
      <div className={cn("mx-auto w-full max-w-[640px]", !embed && "rounded-2xl bg-white p-5 shadow-ring sm:p-8")}>
        {!embed && (
          <header className="mb-5">
            {org?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- company logo
              <img src={org.logoUrl} alt={company} className="mb-4 max-h-12 max-w-[200px] object-contain" />
            ) : (
              <div className="mb-3 text-[13px] font-semibold text-ink-2">{company}</div>
            )}
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{settings.headline || "How much will your project cost?"}</h1>
            <p className="mt-1 text-ink-2">Pick your project for a guide price in seconds, then ask us for a proper quote.</p>
          </header>
        )}
        <Estimator embedded={embed} company={{ token, name: company, formToken: formToken(`estimate:${token}`), settings }} />
      </div>
      {!embed && (
        <p className="mt-4 text-center text-[12px] text-subtle">
          Cost estimator by{" "}
          <a href="https://builder-os.co.uk/tools/renovation-cost-calculator" target="_blank" rel="noopener" className="underline underline-offset-2">
            Builder OS
          </a>
        </p>
      )}
    </main>
  );
}
