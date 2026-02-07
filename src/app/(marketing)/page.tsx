import Image from "next/image";
import Link from "next/link";
import { FeatureGridSection } from "@/components/marketing/feature-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";
import { AcceptanceMock, QuoteBuilderMock, VariationsMock } from "@/components/marketing/solution-mocks";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";

export default function HomePage() {
  return (
    <div>
      <PageHero
        label="BuilderOS"
        title="Quoting, acceptance, and variations in one workflow."
        description="For UK renovation and design & build teams that need a clear commercial record from first quote to approved change."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/product", label: "View product" }}
        note="Designed for teams running repeatable project delivery workflows."
        visual={
          <Image
            src="/images/marketing/hero-product-screenshot.svg"
            alt="BuilderOS product overview screenshot placeholder"
            width={1600}
            height={1000}
            className="h-auto w-full rounded-lg border"
            priority
          />
        }
      />

      <FeatureGridSection
        label="The problem"
        title="Common observations in live projects"
        description="These patterns appear when quoting, acceptance, and changes are handled across email threads and spreadsheets."
        background="muted"
        items={[
          {
            title: "Quote details vary by project",
            description: "Different formats make totals and scope harder to compare.",
          },
          {
            title: "Accepted scope is hard to reference",
            description: "Teams and clients often work from different versions.",
          },
          {
            title: "Change requests arrive informally",
            description: "Extra work can begin before a formal approval is recorded.",
          },
          {
            title: "Approval history is fragmented",
            description: "Key decisions are spread across email, calls, and documents.",
          },
          {
            title: "Status is not always visible",
            description: "It can be unclear which items are pending or fully agreed.",
          },
          {
            title: "Reporting takes extra reconciliation",
            description: "Commercial summaries require manual review across multiple tools.",
          },
        ]}
      />

      <TestimonialsSection />

      <section className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-5">
            <span className="section-label">The solution</span>
            <h2>One commercial system across the project lifecycle</h2>
            <p>
              BuilderOS keeps draft scope, accepted scope, and approved changes in one continuous record.
            </p>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href="/request-access" className="btn-primary">
              Request access
            </Link>
            <Link href="/how-it-works" className="btn-secondary">
              See how it works
            </Link>
          </div>
        </div>

        <div className="mt-14 space-y-10">
          <article className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="panel-card min-w-0 overflow-hidden">
              <QuoteBuilderMock />
            </div>
            <div className="min-w-0 space-y-3">
              <span className="section-label">01</span>
              <h3 className="text-[var(--foreground)]">Create structured quotes</h3>
              <p>Line items, totals, and revisions stay in one format.</p>
            </div>
          </article>

          <article className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="min-w-0 space-y-3 lg:order-1">
              <span className="section-label">02</span>
              <h3 className="text-[var(--foreground)]">Confirm accepted scope</h3>
              <p>Once accepted, the agreed version is fixed for reference.</p>
            </div>
            <div className="panel-card min-w-0 overflow-hidden lg:order-2">
              <AcceptanceMock />
            </div>
          </article>

          <article className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="panel-card min-w-0 overflow-hidden">
              <VariationsMock />
            </div>
            <div className="min-w-0 space-y-3">
              <span className="section-label">03</span>
              <h3 className="text-[var(--foreground)]">Record approved changes</h3>
              <p>Post-acceptance variations capture status, value, and approval history.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y bg-[#fcfcfc]">
        <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
          <div className="section-head space-y-5">
            <span className="section-label">Product preview</span>
            <h2>Interface example</h2>
          </div>
          <div className="grid gap-6">
            <figure className="space-y-3">
              <Image
                src="/images/marketing/quote-builder-screenshot.svg"
                alt="Quote builder screenshot placeholder"
                width={1600}
                height={1000}
                className="h-auto w-full rounded-md border"
              />
              <figcaption className="text-sm text-[var(--muted-foreground)]">
                Quote builder view with line items, totals, and revision context.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <FeatureGridSection
        label="Who it's for"
        title="Teams that run formal quote and change control"
        description="Use this as a fit check rather than a checklist."
        items={[
          {
            title: "Renovation companies",
            description: "Teams with repeatable quoting and approval steps.",
          },
          {
            title: "Design & build",
            description: "Businesses managing scope through design and delivery.",
          },
          {
            title: "Extensions & refurbishments",
            description: "Projects where signed changes are part of normal delivery.",
          },
        ]}
      />

      <FaqSection
        title="Common implementation questions"
        description="Questions teams usually ask when reviewing fit."
        primaryCta={{ href: "/request-access", label: "Request access" }}
        secondaryCta={{ href: "/pricing", label: "View pricing" }}
        background="muted"
        items={[
          {
            question: "Can we use BuilderOS with our current workflow?",
            answer:
              "Yes. Most teams start with quotes and acceptance first, then move variations into the same workflow once the team is comfortable.",
          },
          {
            question: "Do clients need an account to accept a quote?",
            answer:
              "No. Clients can review and accept through a secure quote link without creating a full account.",
          },
          {
            question: "Can we track changes after the quote is accepted?",
            answer:
              "Yes. Post-acceptance changes are handled as variations so each change and approval remains traceable.",
          },
          {
            question: "Is this built for UK renovation businesses specifically?",
            answer:
              "Yes. The current focus is UK renovation and design & build teams, including VAT handling and practical quote workflows.",
          },
        ]}
      />

      <FinalCtaSection
        title="Request access to review BuilderOS with your team."
        description="We can walk through your current workflow and confirm whether the product is a practical fit."
        primaryHref="/request-access"
        primaryLabel="Request access"
        secondaryHref="/product"
        secondaryLabel="Join beta"
      />
    </div>
  );
}
