import { FeatureGridSection } from "@/components/marketing/feature-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

export default function AboutPage() {
  return (
    <div>
      <PageHero
        label="About"
        title="Software shaped by real renovation operations."
        description="BuilderOS was designed around how renovation businesses actually work: quoted scope, client approval, and controlled change once the project is live."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/how-it-works", label: "How it works" }}
      />

      <FeatureGridSection
        label="Philosophy"
        title="Built for real renovation businesses"
        description="The product direction is based on practical workflow needs rather than broad platform messaging."
        background="muted"
        items={[
          {
            title: "Grounded in day-to-day work",
            description: "The product reflects the practical rhythm of quoting, approvals, and delivery.",
          },
          {
            title: "Designed for accountable teams",
            description: "It supports businesses that need clear records for clients, staff, and project decisions.",
          },
          {
            title: "Focused on useful structure",
            description: "The aim is to reduce ambiguity in commercial workflows, not add unnecessary complexity.",
          },
        ]}
      />

      <FeatureGridSection
        label="How we build"
        title="Focus on process and clarity"
        description="BuilderOS keeps workflow boundaries explicit: what is drafted, what is accepted, and what must be approved as a change."
        items={[
          {
            title: "Calm software for serious work",
            description: "The interface is intentionally calm and direct, so teams can make decisions quickly without noise.",
          },
          {
            title: "Clear commercial checkpoints",
            description: "Quotes, acceptance, and variations are separated so responsibilities stay visible.",
          },
          {
            title: "Respect for operational reality",
            description: "Features are shaped around real team constraints, not presentation-driven complexity.",
          },
        ]}
      />

      <FaqSection
        title="About BuilderOS"
        description="Context behind how the product is built and why the workflow is intentionally focused."
        items={[
          {
            question: "Why focus on quotes, acceptance, and variations first?",
            answer:
              "Those are the core commercial control points in renovation work, and they benefit most from clear structure.",
          },
          {
            question: "Is BuilderOS trying to be an all-in-one platform?",
            answer:
              "No. The product is intentionally focused to keep workflows clear and maintainable for real teams.",
          },
          {
            question: "How do you decide what features to build?",
            answer:
              "Feature decisions are based on practical workflow needs and repeated operational pain points from renovation businesses.",
          },
          {
            question: "Does the design intentionally stay minimal?",
            answer:
              "Yes. The interface is designed to reduce noise so teams can make decisions quickly and confidently.",
          },
        ]}
      />

      <FinalCtaSection
        title="Use software that stays calm when the work gets complex."
        description="BuilderOS is built for teams that value clear process, clear records, and clear decisions."
        primaryHref="/request-access"
        primaryLabel="Get started"
        secondaryHref="/how-it-works"
        secondaryLabel="How it works"
      />
    </div>
  );
}
