import { FeatureGridSection } from "@/components/marketing/feature-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";
import { AcceptanceMock, QuoteBuilderMock, VariationsMock } from "@/components/marketing/solution-mocks";

export default function ProductPage() {
  return (
    <div>
      <PageHero
        label="Product"
        title="An operating system for commercial control."
        description="BuilderOS gives renovation teams a clear structure for pricing work, confirming scope, and handling changes after acceptance."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/how-it-works", label: "How it works" }}
        note="Built for focused quoting and change control workflows."
      />

      <section className="border-y bg-[#fafafa]">
        <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
          <div className="mx-auto max-w-3xl text-center">
            <div className="space-y-4">
              <span className="section-label">Core modules</span>
              <h2>Three connected workflows</h2>
              <p>
                Quotes, acceptance, and variations are intentionally linked so the commercial record
                stays consistent from first send to final approval.
              </p>
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
                  Quotes
                </h3>
                <p>Build clear, versioned quotes with structured line items.</p>
              </div>
            </article>

            <article className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="min-w-0 space-y-3 lg:order-1">
                <span className="section-label">02</span>
                <h3 className="text-[2rem] leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                  Acceptance
                </h3>
                <p>Capture client approval online and lock the agreed quote.</p>
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
                  Variations
                </h3>
                <p>Handle post-acceptance changes through formal approvals.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <FeatureGridSection
        label="Difference"
        title="Built around clear decision points"
        description="The product is designed to reduce ambiguity at key commercial moments: review, acceptance, and change."
        items={[
          {
            title: "Summary-first quotes",
            description: "Clients review a clean summary first, then expand detail only when needed.",
          },
          {
            title: "Locked scope after acceptance",
            description: "The accepted quote is fixed so commitments stay clear for both sides.",
          },
          {
            title: "Formal variation approvals",
            description: "Any change is captured as a variation with explicit sign-off.",
          },
        ]}
      />

      <FeatureGridSection
        label="Boundaries"
        title="What it's not"
        description="BuilderOS is focused by design. It is not intended to be an all-in-one back office."
        background="muted"
        items={[
          {
            title: "Not accounting software",
            description: "It does not replace bookkeeping or year-end accounts.",
          },
          {
            title: "Not generic CRM",
            description: "It focuses on quoting and scope control for renovation work.",
          },
          {
            title: "Not a spreadsheet replacement",
            description: "It standardizes approvals and workflow rather than free-form analysis.",
          },
        ]}
      />

      <FaqSection
        title="Product FAQs"
        description="A few practical questions about how BuilderOS behaves in day-to-day use."
        background="muted"
        items={[
          {
            question: "Can we hide internal pricing details from clients?",
            answer:
              "Yes. Client-facing views can stay summary-first while internal calculations remain visible only to your team.",
          },
          {
            question: "What happens when we edit a sent quote?",
            answer:
              "The quote is versioned, and the client sees the latest version with updated timing clearly shown.",
          },
          {
            question: "Can variations be created before acceptance?",
            answer:
              "No. Variations are intended for post-acceptance changes so the original agreement stays clear.",
          },
          {
            question: "Is payment collection included?",
            answer:
              "No. BuilderOS currently focuses on quoting, acceptance, and variation control rather than payment processing.",
          },
        ]}
      />

      <FinalCtaSection
        title="Keep projects moving with cleaner commercial decisions."
        description="If your team wants a more consistent quote-to-variation process, BuilderOS is ready to review."
        primaryHref="/request-access"
        primaryLabel="Get started"
        secondaryHref="/how-it-works"
        secondaryLabel="See workflow"
      />
    </div>
  );
}
