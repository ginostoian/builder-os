import type { Metadata } from "next";
import Link from "next/link";
import { RetentionCalculator } from "@/components/tools/retention-calculator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("retention-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "What is retention money in construction?",
    a: "A percentage of each payment, usually 3% to 5%, that the client or main contractor keeps back as security in case the work has defects. Typically half is paid at practical completion and the other half at the end of the defects period, often 12 months later.",
  },
  {
    q: "Are cash retentions being banned?",
    a: "The government announced in March 2026 that it intends to ban cash retentions in construction contracts, and the ban is in the Commercial Payments Bill going through Parliament. As the bill stands, retention clauses would stop having effect after a transition period of about two years. Until the law changes and that period ends, retention terms in your contracts still apply.",
  },
  {
    q: "When should retention be released?",
    a: "When your contract says. Most say the first half is released at practical completion and the second half when the defects period ends and any defects are put right. Check your contract for the exact trigger, and for whether you need to apply or invoice for it.",
  },
  {
    q: "What happens to my retention if the main contractor goes bust?",
    a: "In most cases cash retention isn't held in a separate protected account, so it becomes part of the insolvent company's money and you join the queue of unsecured creditors. You often get little or nothing back. That's one of the main reasons for the ban.",
  },
  {
    q: "How can I reduce retentions now?",
    a: "Negotiate a lower percentage or a cap before you sign, ask to replace cash retention with a retention bond, ask for the retention to be held in a separate trust account, and make sure the release dates are written into the contract. Then diary the dates and invoice for the release on time.",
  },
  {
    q: "Can I charge interest if retention is paid late?",
    a: "If it's a business customer and the retention is due under the contract, late payment of it is a late commercial debt. Unless your contract sets a fair rate of its own, you can usually claim statutory interest at 8% over the Bank of England reference rate. Our late payment interest calculator works it out.",
  },
];

export default function RetentionCalculatorPage() {
  return (
    <ToolPage
      tool={tool}
      heading="Retention money calculator"
      intro={
        <p>
          See how much cash retention is held back on a job, or across a year of work, when it should come back and what waiting for it really costs you. Plus what the coming ban on
          cash retentions means for your contracts.
        </p>
      }
      calculator={<RetentionCalculator />}
      cta={{
        title: "Never forget a retention release again.",
        body: "Builder OS keeps your payment stages, retention and final account on every project, chases what's due automatically, and shows you exactly who owes you what.",
        points: ["Retention as its own payment stage", "Automatic reminders when payments are due", "Every unpaid invoice in one list", "Clients pay online by card or bank"],
      }}
      faqs={faqs}
      disclaimer="This calculator is a guide based on typical retention terms and the Commercial Payments Bill as it stood in October 2026. Your contract decides when retention is due. It's not legal advice."
    >
      <div>
        <h2>How retention money works</h2>
        <p>
          On most commercial and many larger domestic contracts, the client or main contractor holds back a percentage of every payment, usually <strong>3% to 5%</strong>. It&apos;s
          meant as security in case there are defects to fix. A typical arrangement:
        </p>
        <ol>
          <li>The retention percentage is taken off each interim payment as the job goes on.</li>
          <li>Half is released at practical completion.</li>
          <li>The other half is released at the end of the defects period, commonly 12 months later, once any defects are put right.</li>
        </ol>
        <p>
          On a £200,000 job at 5%, that&apos;s £10,000 of money you&apos;ve earned. Half of it can be held for well over a year from the day the work started, and it&apos;s often
          paid late, or never if the paying party fails.
        </p>
      </div>

      <div>
        <h2>The ban on cash retentions</h2>
        <p>
          In March 2026 the government announced a crackdown on late payment that includes banning cash retentions in construction contracts. It&apos;s in the{" "}
          <strong>Commercial Payments Bill</strong>, which was introduced in the House of Lords in May 2026. As the bill stands:
        </p>
        <ul>
          <li>retention clauses in construction contracts would stop having effect after a transition period of about two years;</li>
          <li>large businesses would have to pay smaller suppliers within 60 days at most; and</li>
          <li>statutory interest on late payments would become mandatory, so it can&apos;t be written out of contracts.</li>
        </ul>
        <p>
          Until the bill becomes law and the transition ends, the retention terms in your contracts still apply. Late payment is a devolved matter, so Scotland, Wales and Northern
          Ireland may follow their own timetable.
        </p>
      </div>

      <div>
        <h2>Getting your retention back today</h2>
        <ul>
          <li>
            <strong>Negotiate before you sign.</strong> Ask for a lower percentage, a cap, a retention bond instead of cash, or for the money to be held in a separate trust account.
          </li>
          <li>
            <strong>Write the release dates into the contract</strong>, including what triggers them and how quickly payment follows.
          </li>
          <li>
            <strong>Diary every release</strong> and invoice for it the day it&apos;s due. Retention is easy for a payer to forget and easy for you to lose track of.
          </li>
          <li>
            <strong>Charge interest when it&apos;s late.</strong> Use the <Link href={toolPath("late-payment-interest-calculator")}>late payment interest calculator</Link> to see what
            you can claim from a business customer.
          </li>
        </ul>
      </div>
    </ToolPage>
  );
}
