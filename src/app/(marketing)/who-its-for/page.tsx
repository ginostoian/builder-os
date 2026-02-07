import { FeatureGridSection } from "@/components/marketing/feature-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { PageHero } from "@/components/marketing/page-hero";

export default function WhoItsForPage() {
  return (
    <div>
      <PageHero
        label="Who it's for"
        title="Designed for renovation teams with structured work."
        description="This page helps you quickly check whether BuilderOS matches the type of jobs and process your business runs."
        primaryAction={{ href: "/request-access", label: "Request access" }}
        secondaryAction={{ href: "/product", label: "See product" }}
      />

      <FeatureGridSection
        label="Ideal customers"
        title="Best fit for commercially managed renovation work"
        description="BuilderOS is intended for teams that treat quoting and approval workflows as core operations."
        background="muted"
        items={[
          {
            title: "UK renovation companies",
            description: "Teams handling multiple projects with formal quoting and approvals.",
          },
          {
            title: "Design & build firms",
            description: "Businesses that combine design responsibility with project delivery.",
          },
          {
            title: "Typical project sizes £10k–£300k",
            description: "Jobs where clear scope and variation control have direct financial impact.",
          },
        ]}
      />

      <FeatureGridSection
        label="Who it's not for"
        title="May not be the right fit in these cases"
        description="This helps self-qualification and avoids pushing the product where it adds little value."
        items={[
          {
            title: "DIY builders",
            description: "BuilderOS is for professional teams, not personal one-off home projects.",
          },
          {
            title: "One-off trades",
            description: "If you rarely need staged quoting or formal change approvals, it may be too much.",
          },
          {
            title: "Small invoice-based jobs",
            description: "Very small, quick-turn work is often simpler with lightweight invoicing only.",
          },
        ]}
      />

      <FaqSection
        title="Fit FAQs"
        description="Quick answers to help your team self-qualify."
        items={[
          {
            question: "Is BuilderOS suitable for very small one-off jobs?",
            answer:
              "Usually not. The product delivers most value when teams run repeated quote, acceptance, and variation workflows.",
          },
          {
            question: "Do you only support large contractors?",
            answer:
              "No. BuilderOS is designed for renovation businesses in the £10k–£300k project range.",
          },
          {
            question: "Can design & build teams use this as well?",
            answer:
              "Yes. It is intended for renovation and design & build teams where scope clarity is important.",
          },
          {
            question: "What if our process is currently spreadsheet-based?",
            answer:
              "That is a common starting point. BuilderOS introduces structure where spreadsheets tend to become hard to control.",
          },
        ]}
      />

      <FinalCtaSection
        title="Find out if BuilderOS matches your operating model."
        description="If your projects sit in the £10k–£300k range and rely on clear approvals, we can show you the workflow."
        primaryHref="/request-access"
        primaryLabel="Get started"
        secondaryHref="/product"
        secondaryLabel="See product"
      />
    </div>
  );
}
