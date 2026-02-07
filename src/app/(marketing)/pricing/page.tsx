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
        title="Pricing for UK renovation teams."
        description="Monthly and yearly plans include the same product. Yearly billing includes a lower effective monthly cost."
        primaryAction={{ href: "/request-access", label: "Request access" }}
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
              <p>Monthly billing with no annual commitment.</p>
              <a href="/request-access" className="btn-primary">
                Request access
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

          <article className="panel-card">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border bg-[#fafafa] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                  Yearly
                </span>
                <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                  2 months free
                </span>
              </div>
              <h2 className="text-[2.4rem] leading-none tracking-[-0.02em] text-[var(--foreground)]">
                £990
                <span className="text-lg font-medium text-[var(--muted-foreground)]"> / year</span>
              </h2>
              <p>
                Effective monthly cost is £82.50 for teams planning year-round use.
              </p>
              <a href="/request-access" className="btn-primary">
                Request access
              </a>
            </div>

            <div className="mt-6 border-t pt-5">
              <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Includes:</p>
              <ul className="space-y-2">
                {planFeatures.map((feature) => (
                  <li key={`yearly-${feature}`} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]">
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
        title="Request access to review pricing with your team."
        description="We can confirm billing options and rollout timing based on your workflow."
        primaryHref="/request-access"
        primaryLabel="Request access"
        secondaryHref="/request-access"
        secondaryLabel="Join beta"
      />
    </div>
  );
}
