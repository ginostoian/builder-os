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
        title="Quote clearly. Lock scope. Manage changes."
        description="BuilderOS is built for UK renovation companies that want cleaner quoting and tighter control once work starts."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/product", label: "Explore product" }}
        note="Straightforward pricing. No pushy sales flow."
        visual={
          <Image
            src="/images/marketing/hero-product-screenshot.svg"
            alt="BuilderOS product overview screenshot placeholder"
            width={1600}
            height={1000}
            className="h-auto w-full rounded-xl border"
            priority
          />
        }
      />

      <FeatureGridSection
        label="The problem"
        title="Common issues in day-to-day delivery"
        description="These are recurring commercial issues for renovation teams working from ad-hoc quote and approval workflows."
        primaryCta={{ href: "/request-access", label: "Request access" }}
        secondaryCta={{ href: "/how-it-works", label: "How it works" }}
        background="muted"
        items={[
          {
            title: "Underquoting",
            description: "Small scope misses reduce margin over the full project.",
          },
          {
            title: "Scope creep",
            description: "Work expands without a clean record of what was agreed.",
          },
          {
            title: "Unpaid variations",
            description: "Extra work is done before approvals are formally captured.",
          },
          {
            title: "Version confusion",
            description: "Teams and clients reference different quote versions at the same time.",
          },
          {
            title: "Unclear approvals",
            description: "It is hard to confirm who approved what and when.",
          },
          {
            title: "Margin leakage",
            description: "Small undocumented changes accumulate across long projects.",
          },
        ]}
      />

      <TestimonialsSection />

      <section className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-4">
            <span className="section-label">The solution</span>
            <h2>A straightforward commercial flow</h2>
            <p>
              BuilderOS keeps quoting, acceptance, and changes in one process so decisions stay clear
              from first draft to final variation.
            </p>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/request-access"
              className="inline-flex items-center rounded-xl bg-[#121316] px-5 py-3 text-base font-medium !text-white"
            >
              Request access
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center rounded-xl border bg-white px-5 py-3 text-base font-medium text-[var(--foreground)]"
            >
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
              <h3 className="text-[2rem] leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                Quote properly
              </h3>
              <p>Build clear quotes with structured items, totals, and version history.</p>
            </div>
          </article>

          <article className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="min-w-0 space-y-3 lg:order-1">
              <span className="section-label">02</span>
              <h3 className="text-[2rem] leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                Lock scope
              </h3>
              <p>Once accepted, the quote becomes fixed so the agreed scope is protected.</p>
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
              <h3 className="text-[2rem] leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                Manage variations
              </h3>
              <p>Changes move through a formal variation approval process with a clear paper trail.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y bg-[#fafafa]">
        <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
          <div className="section-head space-y-4">
            <span className="section-label">Product preview</span>
            <h2>What the workflow looks like</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <figure className="panel-card space-y-3">
              <Image
                src="/images/marketing/quote-builder-screenshot.svg"
                alt="Quote builder screenshot placeholder"
                width={1600}
                height={1000}
                className="h-auto w-full rounded-lg border"
              />
              <figcaption className="text-sm text-[var(--muted-foreground)]">
                Quote builder with structured line items and clear totals.
              </figcaption>
            </figure>
            <figure className="panel-card space-y-3">
              <Image
                src="/images/marketing/variation-flow-screenshot.svg"
                alt="Variation flow screenshot placeholder"
                width={1600}
                height={1000}
                className="h-auto w-full rounded-lg border"
              />
              <figcaption className="text-sm text-[var(--muted-foreground)]">
                Variation flow showing approvals, status, and updated value.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <FeatureGridSection
        label="Who it's for"
        title="Teams handling renovation projects end to end"
        description="BuilderOS is designed for businesses where scope, approval, and change control are central to delivery."
        items={[
          {
            title: "Renovation companies",
            description: "Teams managing quoting, approvals, and live jobs.",
          },
          {
            title: "Design & build",
            description: "Businesses running design responsibility and delivery together.",
          },
          {
            title: "Extensions & refurbishments",
            description: "Projects where scope detail and signed changes matter.",
          },
        ]}
      />

      <FaqSection
        title="Questions before you start?"
        description="These are common questions from renovation teams reviewing BuilderOS."
        primaryCta={{ href: "/request-access", label: "Get started" }}
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
        title="Free up your team. Keep your commercial process clear."
        description="Move from ad-hoc quoting to a structured flow for scope, acceptance, and approved changes."
        primaryHref="/request-access"
        primaryLabel="Get started"
        secondaryHref="/product"
        secondaryLabel="Talk to us"
      />
    </div>
  );
}
