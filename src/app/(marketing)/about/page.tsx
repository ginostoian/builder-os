import { FeatureGridSection } from "@/components/marketing/feature-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

export default function AboutPage() {
  return (
    <div>
      <PageHero
        label="About"
        title="Software for practical commercial control."
        description="BuilderOS is built around day-to-day renovation workflows: quoted scope, accepted scope, and approved changes."
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
            title: "Calm interface decisions",
            description: "The interface stays plain so operational details remain easy to review.",
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
            question: "Is BuilderOS trying to replace every back-office tool?",
            answer:
              "No. The product is intentionally focused to keep workflows clear and maintainable for real teams.",
          },
          {
            question: "How do you decide what features to build?",
            answer:
              "Feature decisions are based on practical workflow needs and recurring operational issues from renovation businesses.",
          },
          {
            question: "Does the design intentionally stay minimal?",
            answer:
              "Yes. The interface is designed to reduce noise so teams can make decisions quickly and confidently.",
          },
        ]}
      />

      <FinalCtaSection
        title="Request access to review the product in context."
        description="If your team values explicit process and clear records, we can run through the workflow."
        primaryHref="/request-access"
        primaryLabel="Request access"
        secondaryHref="/how-it-works"
        secondaryLabel="Join beta"
      />
    </div>
  );
}
