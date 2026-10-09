import type { Metadata } from "next";
import Link from "next/link";
import { DayRateCalculator } from "@/components/tools/day-rate-calculator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("day-rate-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "How do I work out my day rate?",
    a: "Add the income you want before tax to your yearly business costs, then divide by the days you can actually bill: 52 weeks, less holidays, bank holidays, sick and weather days, gaps between jobs and the time you spend quoting and on paperwork. Most self-employed builders can bill somewhere between 180 and 210 days a year, not 260.",
  },
  {
    q: "What is a typical builder's day rate in the UK?",
    a: "Published guides put general builders roughly between £180 and £350 a day in 2026, with London and the South East commonly 20% to 35% higher than the rest of the country, and specialist trades at the top of the range. What matters more than the market average is the rate that covers your own costs and income.",
  },
  {
    q: "Should my day rate include VAT?",
    a: "Work out your rate before VAT. If you're VAT registered, add 20% when you charge homeowners. Business customers who are VAT registered can usually reclaim it, and for many building services between VAT-registered businesses the domestic reverse charge applies instead.",
  },
  {
    q: "Should I charge by the day or by the job?",
    a: "Pricing by the job usually earns more once you're experienced, because you're paid for the result, not the hours, and clients prefer knowing the total. Your day rate is still the starting point: it's how you price your labour on each job.",
  },
  {
    q: "How much tax will I pay as a self-employed builder?",
    a: "For 2026/27, a sole trader in England, Wales or Northern Ireland pays no income tax on the first £12,570 of profit, 20% up to £50,270 and 40% above that, plus Class 4 National Insurance of 6% between £12,570 and £50,270 and 2% above. Under CIS, some of this is taken from your payments in advance and counted towards your bill.",
  },
];

export default function DayRatePage() {
  return (
    <ToolPage
      tool={tool}
      heading="Day rate calculator for builders and trades"
      intro={
        <p>
          Work out the day rate you need to charge, starting from what you want to earn, the costs of running your business and the days you can actually bill. See your hourly
          rate, your take-home after tax, and how far short the simple &ldquo;salary divided by 260&rdquo; method leaves you.
        </p>
      }
      calculator={<DayRateCalculator />}
      cta={{
        title: "Put your rate into every quote.",
        body: "Save your day rates and prices in Builder OS once, and every quote uses them. Track the real hours and costs on each job to see whether your rate is working.",
        points: ["Your rates and price list built in", "Quotes in minutes, not evenings", "Timesheets from the site app", "Profit per job as costs come in"],
      }}
      faqs={faqs}
      disclaimer="Tax and National Insurance are rough estimates for a sole trader in England, Wales or Northern Ireland at 2026/27 rates, with no other income or reliefs. Ask your accountant for your own figures."
    >
      <div>
        <h2>Why 260 days is the wrong number</h2>
        <p>
          There are 260 weekdays in a year, so it&apos;s tempting to divide the income you want by 260. But you won&apos;t be paid for all of them. Take off four weeks&apos; holiday,
          eight bank holidays, a couple of weeks for illness, bad weather and gaps between jobs, and half a day a week for quoting, buying and paperwork, and you&apos;re left with
          around <strong>198 days</strong> you can bill.
        </p>
        <p>
          Then your rate has to cover the costs of being in business: a van, fuel, tools, insurance, phone, software and an accountant easily add up to £10,000 to £20,000 a year
          before you&apos;ve paid yourself anything.
        </p>
      </div>

      <div>
        <h2>A worked example</h2>
        <p>
          You want £45,000 a year before tax and your business costs are £15,000. You need £60,000 of turnover from your labour. Over 198 billable days that&apos;s{" "}
          <strong>£304 a day</strong>, or about £38 an hour. The &ldquo;salary ÷ 260&rdquo; method would have said £173, leaving you about £26,000 a year short.
        </p>
      </div>

      <div>
        <h2>From day rate to profitable jobs</h2>
        <p>
          Your day rate covers your own labour. On a job you&apos;ll also have materials, subcontractors and hire, each with its own markup. See how much turnover your business needs
          in total with the <Link href={toolPath("revenue-profit-calculator")}>revenue and profit calculator</Link>, and price each line properly with the{" "}
          <Link href={toolPath("markup-margin-calculator")}>markup vs margin calculator</Link>.
        </p>
      </div>
    </ToolPage>
  );
}
