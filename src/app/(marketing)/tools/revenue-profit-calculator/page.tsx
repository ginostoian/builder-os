import type { Metadata } from "next";
import Link from "next/link";
import { RevenueProfitCalculator } from "@/components/tools/revenue-profit-calculator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("revenue-profit-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "How do I work out the turnover I need?",
    a: "Add the profit you want to your yearly overheads, then divide by your gross margin. With £60,000 profit, £30,000 overheads and a 30% gross margin: (£60,000 + £30,000) ÷ 0.30 = £300,000 turnover a year.",
  },
  {
    q: "What's the difference between gross margin and net margin?",
    a: "Gross margin is what's left of a job's price after the job's own costs: materials, labour and subcontractors. Net margin is what's left after your overheads too, which is your profit as a share of turnover.",
  },
  {
    q: "What counts as an overhead?",
    a: "Anything the business pays for whether or not you have work on: vans, insurance, premises, software, phones, your accountant, marketing, tools, and office staff or your own salary. Costs that belong to a particular job, like its materials and the labour on it, are direct costs instead.",
  },
  {
    q: "How do I work out my break-even point?",
    a: "Divide your yearly overheads by your gross margin. With £30,000 of overheads and a 30% margin, you break even at £100,000 of turnover. Below that you make a loss; above it, 30p of every pound is profit.",
  },
  {
    q: "What is a good profit margin for a building firm?",
    a: "Many small UK building and renovation firms make a net profit of somewhere between 5% and 15% of turnover, with gross margins of 20% to 35%. Firms that price carefully, control variations and manage cash well tend to do better than that.",
  },
  {
    q: "Should I include VAT in my turnover?",
    a: "No. Work with figures before VAT, because the VAT you collect belongs to HMRC. But remember that homeowners pay VAT on top, so if you're VAT registered, your prices to them are 20% higher than the figures here.",
  },
  {
    q: "How many quotes do I need to send?",
    a: "Divide the number of jobs you need by the share of quotes you usually win. If you need 20 jobs a year and win one quote in four, you need to send 80 quotes a year: about 7 a month.",
  },
];

export default function RevenueProfitPage() {
  return (
    <ToolPage
      tool={tool}
      heading="How much turnover do you need? Revenue and profit calculator for builders"
      intro={
        <p>
          Start with the profit you want to make and work backwards to the turnover, jobs and quotes it takes, by the year, month and week. Or put in your turnover to see the profit
          it leaves. See your break-even point, and what a few more points of margin would be worth.
        </p>
      }
      calculator={<RevenueProfitCalculator />}
      cta={{
        title: "Know your numbers every week, not once a year.",
        body: "Builder OS tracks every quote, job cost and payment, so you can see your turnover, margins and pipeline as you go, instead of waiting for your accountant.",
        points: ["Win rate and pipeline value at a glance", "Job costing and profit on every project", "Payments and cash coming in", "Quotes that are fast to send, so you send more"],
      }}
      faqs={faqs}
    >
      <div>
        <h2>The sum behind it</h2>
        <p>Every pound you invoice goes three ways: into the job&apos;s own costs, into running the business, and whatever&apos;s left is profit.</p>
        <ul>
          <li>
            <strong>Turnover needed</strong> = (profit you want + overheads) ÷ gross margin
          </li>
          <li>
            <strong>Break-even turnover</strong> = overheads ÷ gross margin
          </li>
          <li>
            <strong>Jobs needed</strong> = turnover ÷ your average job value
          </li>
          <li>
            <strong>Quotes needed</strong> = jobs ÷ the share of quotes you win
          </li>
        </ul>
      </div>

      <div>
        <h2>A worked example</h2>
        <p>
          You want to make £60,000 a year. The business costs £30,000 a year to run, and your jobs average a 30% gross margin. You need (£60,000 + £30,000) ÷ 0.30 ={" "}
          <strong>£300,000</strong> of turnover: £25,000 a month. If your average job is £15,000, that&apos;s 20 jobs a year. Win one quote in four and you need to send 80 quotes, about
          7 a month.
        </p>
        <p>
          Now raise the margin to 35%. The same profit needs about £257,000 of turnover, £43,000 less, which is two fewer jobs a year for the same money. That&apos;s why margin
          usually matters more than volume.
        </p>
      </div>

      <div>
        <h2>Three ways to need less turnover</h2>
        <h3>Price with the right margin</h3>
        <p>
          Many firms add a percentage to cost and think of it as their margin. It isn&apos;t: a 20% markup is only a 16.7% margin. Check yours with the{" "}
          <Link href={toolPath("markup-margin-calculator")}>markup vs margin calculator</Link>.
        </p>
        <h3>Charge for every change</h3>
        <p>Variations agreed on site and never invoiced are pure lost margin. Get each one priced and signed before the work is done.</p>
        <h3>Win more of the quotes you send</h3>
        <p>
          Raising your win rate from one in four to one in three cuts the quotes you need by a quarter. Quotes that look professional, arrive quickly and are easy to accept make the
          biggest difference.
        </p>
      </div>
    </ToolPage>
  );
}
