import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

const planFeatures = [
  "Structured quotes with version history",
  "Summary-first client view and share link",
  "Online acceptance and scope locking",
  "Variation workflow with formal approvals",
  "PDF export for quotes and variations",
  "Company defaults and terms setup",
];

export default function PricingPage() {
  return (
    <div>
      <PageHero
        label="Pricing"
        title="Simple pricing for renovation teams."
        description="Choose monthly or yearly billing. Yearly includes two months free while keeping the same product and support level."
        primaryAction={{ href: "/request-access", label: "Get started" }}
        secondaryAction={{ href: "/request-access", label: "Talk to us" }}
      />

      <section className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="panel-card">
            <div className="space-y-3">
              <span className="section-label">Monthly</span>
              <h2 className="text-[2.4rem] leading-none tracking-[-0.02em] text-[var(--foreground)]">
                £99<span className="text-lg font-medium text-[var(--muted-foreground)]"> / month</span>
              </h2>
              <p>Flexible monthly billing for teams that want to start immediately.</p>
              <a
                href="/request-access"
                className="inline-flex items-center rounded-xl bg-[#121316] px-5 py-3 text-base font-medium !text-white"
              >
                Get started
              </a>
            </div>

            <div className="mt-6 border-t pt-5">
              <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Includes:</p>
              <ul className="space-y-2">
                {planFeatures.map((feature) => (
                  <li key={`monthly-${feature}`} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rounded-2xl border border-[#121316] bg-[#121316] p-[clamp(1.25rem,1.7vw,1.6rem)] text-white shadow-[var(--card-shadow)]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#121316]">
                  Yearly
                </span>
                <span className="inline-flex items-center rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/90">
                  2 months free
                </span>
              </div>
              <h2 className="text-[2.4rem] leading-none tracking-[-0.02em] text-white">
                £990
                <span className="text-lg font-medium text-white/70"> / year</span>
              </h2>
              <p className="text-white/80">
                Effective monthly cost: £82.50. Best value for teams planning to use BuilderOS year-round.
              </p>
              <a
                href="/request-access"
                className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-base font-medium !text-[#121316]"
              >
                Choose yearly
              </a>
            </div>

            <div className="mt-6 border-t border-white/15 pt-5">
              <p className="mb-3 text-sm font-semibold text-white">Includes:</p>
              <ul className="space-y-2">
                {planFeatures.map((feature) => (
                  <li key={`yearly-${feature}`} className="flex items-start gap-2 text-sm text-white">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30 text-[11px]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <FaqSection
        title="Pricing FAQs"
        description="Answers to common billing and plan questions."
        background="muted"
        items={[
          {
            question: "What is included in both plans?",
            answer:
              "Both monthly and yearly include the same product features. The yearly option only changes billing value.",
          },
          {
            question: "How is the yearly discount calculated?",
            answer:
              "Yearly is priced as 10 months of service, giving two months free compared with monthly billing.",
          },
          {
            question: "Can we switch billing cycle later?",
            answer:
              "Yes. Teams can discuss cycle changes with BuilderOS support based on their renewal timing.",
          },
          {
            question: "Are there setup or onboarding fees?",
            answer:
              "There are no separate mandatory setup fees listed on this pricing page.",
          },
        ]}
      />

      <FinalCtaSection
        title="Start with the billing model that fits your team."
        description="Monthly for flexibility, yearly for lower effective cost. Same product and workflow in both plans."
        primaryHref="/request-access"
        primaryLabel="Get started"
        secondaryHref="/request-access"
        secondaryLabel="Talk to us"
      />
    </div>
  );
}
