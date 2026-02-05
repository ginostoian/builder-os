import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

export default function TermsPage() {
  return (
    <div>
      <PageHero
        label="Terms"
        title="Terms & conditions"
        description="These terms describe the general conditions for using BuilderOS and related services."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/privacy", label: "Privacy policy" }}
      />

      <section className="border-y bg-[#fafafa]">
        <div className="mx-auto w-full max-w-4xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
          <div className="space-y-8">
            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">1. Service use</h2>
              <p className="mt-3">
                BuilderOS is provided for business use by authorized users. You are responsible for
                maintaining the confidentiality of account credentials and for activities performed by
                your users.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">2. Billing</h2>
              <p className="mt-3">
                Paid plans are billed in line with your selected billing cycle. Pricing, renewal
                timing, and plan details are confirmed during onboarding.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">3. Data responsibility</h2>
              <p className="mt-3">
                You retain responsibility for the business data entered into the platform, including
                quote and client information. We process that data to provide the service.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">4. Acceptable use</h2>
              <p className="mt-3">
                You agree not to misuse the service, interfere with platform operations, or use
                BuilderOS for unlawful activities.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">5. Contact</h2>
              <p className="mt-3">
                For questions regarding these terms, please contact the BuilderOS team via the request
                access form.
              </p>
            </article>
          </div>
        </div>
      </section>

      <FaqSection
        title="Terms FAQs"
        description="Quick answers to common questions about these terms."
        items={[
          {
            question: "Are these terms final legal advice?",
            answer:
              "No. This page provides product-level terms information and should be reviewed with your legal team if needed.",
          },
          {
            question: "Do these terms apply to all users in our organization?",
            answer:
              "Yes. Organization administrators are responsible for ensuring users follow the agreed terms.",
          },
          {
            question: "Can terms be updated over time?",
            answer:
              "Terms may be revised as the service evolves. Material updates are communicated through standard channels.",
          },
          {
            question: "Who should we contact for terms questions?",
            answer:
              "Please contact the BuilderOS team through the request access form for clarification.",
          },
        ]}
      />

      <FinalCtaSection
        title="Need clarification before getting started?"
        description="Share your questions and we can walk through product, pricing, and terms together."
        primaryHref="/request-access"
        primaryLabel="Talk to us"
        secondaryHref="/pricing"
        secondaryLabel="View pricing"
      />
    </div>
  );
}
