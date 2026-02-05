import { FeatureGridSection } from "@/components/marketing/feature-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

export default function HowItWorksPage() {
  return (
    <div>
      <PageHero
        label="How it works"
        title="A clear three-step process."
        description="BuilderOS follows a practical flow from quote creation to accepted changes."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/product", label: "View product" }}
      />

      <FeatureGridSection
        label="Step 1"
        title="Create a quote"
        description="Build the initial commercial scope using a structured format the whole team can follow."
        background="muted"
        items={[
          {
            title: "Hybrid pricing",
            description: "Mix fixed amounts, unit rates, labour, and allowances.",
          },
          {
            title: "Templates",
            description: "Start from saved structures instead of starting from zero.",
          },
          {
            title: "Speed",
            description: "Produce clear quotes faster with a consistent format.",
          },
        ]}
      />

      <FeatureGridSection
        label="Step 2"
        title="Send & accept"
        description="Share the quote clearly, capture acceptance online, and keep version history visible."
        items={[
          {
            title: "Client link",
            description: "Share a private link for clients to review the quote.",
          },
          {
            title: "Online acceptance",
            description: "Capture acceptance directly in the same flow.",
          },
          {
            title: "Versioning",
            description: "Updates are tracked, and clients always see the latest version.",
          },
        ]}
      />

      <FeatureGridSection
        label="Step 3"
        title="Variations"
        description="After acceptance, all changes are handled through a formal approval process."
        background="muted"
        items={[
          {
            title: "Changes become approved variations",
            description: "After acceptance, changes are captured as formal variations.",
          },
          {
            title: "Clear paper trail",
            description: "Each variation records what changed, when it changed, and who approved it.",
          },
          {
            title: "Status visibility",
            description: "Pending and approved items stay visible for both team and client context.",
          },
        ]}
      />

      <FaqSection
        title="Workflow FAQs"
        description="Common process questions from teams moving from ad-hoc tools to a structured flow."
        items={[
          {
            question: "How long does setup usually take?",
            answer:
              "Most teams can begin with a basic quote template and settings in a short onboarding session, then refine from live use.",
          },
          {
            question: "Can we keep using our existing templates?",
            answer:
              "Yes. Existing quote structures can be adapted into reusable sections and templates inside BuilderOS.",
          },
          {
            question: "What if the client requests changes after acceptance?",
            answer:
              "Those requests are captured as variations with status and approval history, rather than editing the accepted quote.",
          },
          {
            question: "Can different team members manage different stages?",
            answer:
              "Yes. Teams typically split responsibilities across quote creation, client communication, and variation handling.",
          },
        ]}
      />

      <FinalCtaSection
        title="Run each project with a repeatable process."
        description="From first quote to final change, BuilderOS keeps the commercial flow explicit and trackable."
        primaryHref="/request-access"
        primaryLabel="Get started"
        secondaryHref="/product"
        secondaryLabel="View product"
      />
    </div>
  );
}
