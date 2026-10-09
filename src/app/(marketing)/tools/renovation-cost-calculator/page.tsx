import type { Metadata } from "next";
import Link from "next/link";
import { Estimator } from "@/components/estimator/estimator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { estimate, formatPounds, PROJECTS, PROJECT_TYPES } from "@/core/estimator";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("renovation-cost-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

/** The guide-price table: each project at a standard finish, in a mid-priced region and in London, with VAT. */
const rows = PROJECT_TYPES.flatMap((t) => {
  const spec = PROJECTS[t];
  const cases = spec.kind === "area" ? [{ label: `${spec.label}, ${spec.defaultSize} m²`, size: spec.defaultSize, variant: undefined }] : (spec.variants ?? []).map((v) => ({ label: `${spec.short}: ${v.label}`, size: undefined, variant: v.id }));
  return cases.map((c) => {
    const typical = estimate({ type: t, size: c.size, variant: c.variant, finish: "standard" }, { region: "east_midlands", vat: true })!;
    const london = estimate({ type: t, size: c.size, variant: c.variant, finish: "standard" }, { region: "london", vat: true })!;
    return { label: c.label, typical: `${formatPounds(typical.low)} to ${formatPounds(typical.high)}`, london: `${formatPounds(london.low)} to ${formatPounds(london.high)}` };
  });
});

const faqs: Faq[] = [
  {
    q: "How much does a single-storey extension cost in 2026?",
    a: "As a guide, around £2,000 to £3,000 per m² including VAT for a standard finish in much of the UK, and more in London and the South East. A 20 m² rear extension often comes to £45,000 to £65,000 before professional fees. The calculator works it out for your size, finish and region.",
  },
  {
    q: "How much does a loft conversion cost?",
    a: "It depends mostly on the type. A rooflight (Velux) conversion is the cheapest, a dormer is the most common, and hip-to-gable and mansard conversions cost more because they change the roof's shape. As a guide, from about £25,000 for a simple rooflight conversion to £80,000 or more for a mansard, including VAT.",
  },
  {
    q: "Do these prices include VAT?",
    a: "Yes, unless you untick the box. Most building firms are VAT registered, so homeowners pay VAT at 20% on top of the builder's price. Some smaller firms aren't registered and don't charge VAT.",
  },
  {
    q: "What isn't included in the estimate?",
    a: "Usually professional fees (architect or designer, structural engineer, building control and planning), which often add 10% to 15% to an extension, plus anything not described, like a new kitchen in a new extension. Each estimate lists what it leaves out.",
  },
  {
    q: "Why do prices vary so much by region?",
    a: "Labour and overheads cost more in some places, especially London and the South East, where building work commonly costs 20% to 30% more than the national average. Northern Ireland, the North East and Wales are usually cheaper.",
  },
  {
    q: "How accurate is this calculator?",
    a: "It's a guide based on typical 2026 prices, good for deciding whether a project fits your budget. The real price depends on your home, access, ground conditions, design and finishes, so always get written quotes from builders who've seen the job.",
  },
  {
    q: "Can I put this calculator on my building company's website?",
    a: "Yes, free. Sign up for Builder OS, open Settings and then Website estimator, choose the projects you do, set your area and prices, and paste the code into your website. Homeowners get a guide price, and you get their enquiry.",
  },
];

export default function RenovationCostPage() {
  return (
    <ToolPage
      tool={tool}
      heading="Renovation cost calculator: how much will your project cost?"
      intro={
        <p>
          Get a guide price for an extension, loft conversion, new kitchen, bathroom, garage conversion or whole-house refurbishment, based on typical 2026 UK prices for your
          region. Choose your project, size and finish to see the likely range, including VAT.
        </p>
      }
      calculator={
        <div className="mx-auto max-w-[760px] rounded-[24px] bg-white p-5 shadow-ring sm:p-7">
          <Estimator />
        </div>
      }
      cta={{
        title: "Builders: put this estimator on your website.",
        body: "Free with Builder OS. Choose the projects you do, set your prices, and paste one snippet into your site. Homeowners get a guide price for their project, and you get their enquiry with the estimate attached.",
        points: ["Your projects, your area, your prices", "Enquiries emailed to you straight away", "On Pro, every enquiry lands in your pipeline", "Works on any website, phone or desktop"],
      }}
      faqs={faqs}
      disclaimer="Guide prices only, based on published 2026 UK cost ranges and typical regional differences. Every home is different: get written quotes from builders who've seen the job."
    >
      <div>
        <h2>Typical renovation costs in 2026</h2>
        <p>Guide prices for a standard finish, including VAT, in a mid-priced region and in London. Use the calculator above for your own size, finish and region.</p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Typical (Midlands)</th>
                <th>London</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.typical}</td>
                  <td>{r.london}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2>What drives the cost</h2>
        <ul>
          <li>
            <strong>Size:</strong> most of the cost of an extension scales with floor area, though small extensions cost more per m² because the fixed costs are spread over less space.
          </li>
          <li>
            <strong>Finish:</strong> kitchens, bathrooms, glazing and flooring can double the cost between a basic and a premium specification.
          </li>
          <li>
            <strong>Structure:</strong> steel beams, knocking through, foundations and roof changes add cost quickly. A two-storey extension costs less per m² than a single-storey one, because the foundations and roof cover twice the space.
          </li>
          <li>
            <strong>Where you live:</strong> labour costs most in London and the South East.
          </li>
        </ul>
      </div>

      <div>
        <h2>Getting a quote you can trust</h2>
        <ol>
          <li>Get at least three written quotes from builders who&apos;ve visited, based on the same drawings and specification.</li>
          <li>Check that each quote breaks the work down line by line and lists what isn&apos;t included.</li>
          <li>Agree stage payments tied to finished work, not dates, and avoid paying a large sum up front.</li>
          <li>Ask how changes will be priced and agreed before they&apos;re done.</li>
        </ol>
      </div>

      <div id="for-builders">
        <h2>For builders: your own estimator</h2>
        <p>
          Builder OS customers can put this estimator on their own website for free, set to the projects they do, their area and their own prices. Homeowners get an instant guide
          price, and the builder gets the enquiry with the estimate attached. <Link href="/pricing">Start free</Link>, then open Settings and Website estimator.
        </p>
      </div>
    </ToolPage>
  );
}
