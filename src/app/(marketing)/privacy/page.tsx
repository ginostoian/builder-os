import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

export default function PrivacyPage() {
  return (
    <div>
      <PageHero
        label="Privacy"
        title="Privacy policy"
        description="This page outlines how BuilderOS handles personal and business data in the normal operation of the service."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/terms", label: "Terms & conditions" }}
      />

      <section className="border-y bg-[#fafafa]">
        <div className="mx-auto w-full max-w-4xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
          <div className="space-y-8">
            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">1. Information we process</h2>
              <p className="mt-3">
                We process account information, organization settings, and workflow data required to
                provide BuilderOS features such as quoting, acceptance, and variation management.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">2. Why we process it</h2>
              <p className="mt-3">
                Data is processed to operate the product, maintain security, provide support, and
                improve service reliability.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">3. Access and controls</h2>
              <p className="mt-3">
                Access is limited to authorized users and controlled by account-level permissions and
                organization context.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">4. Retention</h2>
              <p className="mt-3">
                Data is retained according to operational and legal requirements, and may be deleted in
                line with account closure or contractual terms.
              </p>
            </article>

            <article className="panel-card">
              <h2 className="text-[1.7rem] text-[var(--foreground)]">5. Contact</h2>
              <p className="mt-3">
                For privacy-related requests, contact the BuilderOS team through the request access
                form.
              </p>
            </article>
          </div>
        </div>
      </section>

      <FaqSection
        title="Privacy FAQs"
        description="Common data-handling questions from teams evaluating BuilderOS."
        items={[
          {
            question: "What data does BuilderOS store?",
            answer:
              "BuilderOS stores account, organization, and workflow data needed to run quoting, acceptance, and variations.",
          },
          {
            question: "Can we control who sees sensitive project information?",
            answer:
              "Yes. Access is limited by organization context and authorized user access within the platform.",
          },
          {
            question: "Do you share our data with other customers?",
            answer:
              "No. Customer data is handled within each organization context and is not shared across tenants.",
          },
          {
            question: "How can we request privacy clarification?",
            answer:
              "Contact the BuilderOS team via the request access form and we can discuss privacy handling in detail.",
          },
        ]}
      />

      <FinalCtaSection
        title="Want to review data handling before rollout?"
        description="We can walk through privacy expectations, workflow usage, and controls with your team."
        primaryHref="/request-access"
        primaryLabel="Talk to us"
        secondaryHref="/pricing"
        secondaryLabel="View pricing"
      />
    </div>
  );
}
