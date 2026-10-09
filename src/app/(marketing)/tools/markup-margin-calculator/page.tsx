import type { Metadata } from "next";
import Link from "next/link";
import { MarkupMarginCalculator } from "@/components/tools/markup-margin-calculator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("markup-margin-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "What's the difference between markup and margin?",
    a: "Both describe the same profit. Markup is the profit as a percentage of your cost. Margin is the profit as a percentage of the selling price. A job that costs £1,000 and sells for £1,250 has a 25% markup and a 20% margin.",
  },
  {
    q: "How do I convert markup to margin?",
    a: "Margin = markup ÷ (1 + markup). So a 25% markup is 0.25 ÷ 1.25 = 20% margin, and a 50% markup is 33.3% margin.",
  },
  {
    q: "How do I convert margin to markup?",
    a: "Markup = margin ÷ (1 − margin). So a 20% margin needs a 0.20 ÷ 0.80 = 25% markup, and a 30% margin needs a 42.9% markup.",
  },
  {
    q: "What is a good margin for a building or renovation firm?",
    a: "It varies with the work and how much you subcontract, but many UK renovation firms aim for a gross margin of 20% to 35% on each job, to pay their overheads and leave a profit. Use the revenue and profit calculator to see what margin your own overheads and profit target need.",
  },
  {
    q: "Should I mark up materials and subcontractors?",
    a: "Usually, yes. You're responsible for ordering, managing, guaranteeing and financing them until the client pays. Many firms use a lower markup on materials and subcontractors than on their own labour, and price each line separately.",
  },
  {
    q: "Is markup calculated before or after VAT?",
    a: "Before. Work out your price from your costs before VAT, then add VAT on top if you're VAT registered. VAT isn't your money, so it shouldn't be part of your markup or margin.",
  },
];

export default function MarkupMarginPage() {
  return (
    <ToolPage
      tool={tool}
      heading="Markup vs margin calculator"
      intro={
        <p>
          Enter your cost and any one of a markup, a margin or a selling price, and see the rest. Mixing up markup and margin is one of the most common reasons good jobs make less
          than they should, so this shows exactly what the difference costs you.
        </p>
      }
      calculator={<MarkupMarginCalculator />}
      cta={{
        title: "Mark up every line, see your margin on every job.",
        body: "In Builder OS you set a markup on every line as you quote. Once the job starts, real costs are tracked against the quote, so you know what you actually made.",
        points: ["Markup on every quote line", "Your price list with your rates built in", "Job costing against the quote", "Profit and margin per job, without a spreadsheet"],
      }}
      faqs={faqs}
    >
      <div>
        <h2>Markup and margin, explained</h2>
        <p>
          <strong>Markup</strong> is what you add on top of your cost, as a percentage of that cost. <strong>Margin</strong> is how much of the selling price is profit, as a
          percentage of the price. They&apos;re two ways of describing the same pound of profit, but the numbers are never the same.
        </p>
        <ul>
          <li>Markup = profit ÷ cost</li>
          <li>Margin = profit ÷ selling price</li>
          <li>Margin = markup ÷ (1 + markup)</li>
          <li>Markup = margin ÷ (1 − margin)</li>
        </ul>
      </div>

      <div>
        <h2>Why the difference matters</h2>
        <p>
          Say you want a 20% margin on a £40,000 kitchen extension that costs you £40,000 to build. If you add 20% to your cost, you charge £48,000 and make £8,000: a margin of only
          16.7%. To actually make 20% you need to charge £50,000. That&apos;s <strong>£2,000 lost</strong> on one job, just from using the wrong percentage.
        </p>
        <p>Across a year of jobs, that gap is often the difference between a firm that grows and one that&apos;s always busy but short of cash.</p>
      </div>

      <div>
        <h2>Which one should you use?</h2>
        <p>
          Use <strong>markup</strong> when you&apos;re pricing, because you build a price up from your costs. Use <strong>margin</strong> when you&apos;re checking how the business is
          doing, because your overheads and profit come out of the selling price. The trick is knowing the markup that gives you the margin you need: a 25% markup for 20%, a 33.3%
          markup for 25%, a 42.9% markup for 30%.
        </p>
        <p>
          Not sure what margin you need? The <Link href={toolPath("revenue-profit-calculator")}>revenue and profit calculator</Link> works it out from your overheads and the profit
          you want.
        </p>
      </div>
    </ToolPage>
  );
}
