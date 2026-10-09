import type { Metadata } from "next";
import Link from "next/link";
import { LatePaymentCalculator } from "@/components/tools/late-payment-calculator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { REFERENCE_RATES } from "@/core/tools/late-payment";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("late-payment-interest-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const latest = REFERENCE_RATES[REFERENCE_RATES.length - 1]!;
const halfYear = (from: string) => {
  const [y, m] = from.split("-");
  return m === "01" ? `January to June ${y}` : `July to December ${y}`;
};

const faqs: Faq[] = [
  {
    q: "How much interest can I charge on a late invoice?",
    a: `For an invoice to another business, statutory interest is 8% a year plus the Bank of England reference rate. For debts that became late from ${halfYear(latest.from)}, the reference rate is ${latest.ratePct}%, so you can charge ${latest.ratePct + 8}% a year, worked out daily.`,
  },
  {
    q: "What is the fixed sum for late payment?",
    a: "As well as interest, you can claim a fixed sum for each late invoice: £40 if the invoice is under £1,000, £70 if it's £1,000 to £9,999.99, and £100 if it's £10,000 or more. You can also claim reasonable extra costs of recovering the debt.",
  },
  {
    q: "Can I charge a homeowner late payment interest?",
    a: "Not under the late payment law, which only covers business-to-business invoices. You can charge a homeowner interest only if your contract with them says so and the rate is fair. Put it in your terms before the job starts.",
  },
  {
    q: "When does late payment interest start?",
    a: "From the day after the payment was due. If you didn't agree a payment date, the law treats it as 30 days after the customer received your invoice or the work was done, whichever is later.",
  },
  {
    q: "What reference rate do I use?",
    a: "The Bank of England base rate on 31 December for debts that became late between January and June, or on 30 June for debts that became late between July and December. That rate stays fixed for the whole time the debt is late.",
  },
  {
    q: "Is late payment interest changing?",
    a: "The Commercial Payments Bill going through Parliament in 2026 would make statutory interest mandatory, so contracts couldn't set a lower rate or rule it out, and would limit payment terms for large businesses paying smaller suppliers to 60 days.",
  },
];

export default function LatePaymentPage() {
  return (
    <ToolPage
      tool={tool}
      heading="Late payment interest calculator"
      intro={
        <p>
          Work out the statutory interest and fixed compensation you can claim on late invoices from business customers, for one invoice or several. It uses the right Bank of
          England reference rate for each invoice and writes the letter for you.
        </p>
      }
      calculator={<LatePaymentCalculator />}
      cta={{
        title: "Get paid on time without the awkward calls.",
        body: "Builder OS sends polite, automatic reminders before and after invoices fall due, and clients can pay online by card or bank the moment they open them.",
        points: ["Automatic payment reminders", "Online payment by card or bank", "Every overdue invoice in one place", "Stage payments agreed up front"],
      }}
      faqs={faqs}
      disclaimer="This calculator follows the Late Payment of Commercial Debts (Interest) Act 1998 and the Bank of England reference rates as of October 2026. It's a guide, not legal advice: your contract may set its own fair rate for late payment."
    >
      <div>
        <h2>Your right to late payment interest</h2>
        <p>
          When another business pays you late, the Late Payment of Commercial Debts (Interest) Act 1998 lets you charge interest and a fixed sum on each late invoice, even if your
          contract doesn&apos;t mention it. It applies to main contractors, developers, landlords and any other business customer. It doesn&apos;t apply to homeowners.
        </p>
        <ul>
          <li>
            <strong>Interest:</strong> 8% a year over the Bank of England reference rate, simple, from the day after the due date until you&apos;re paid.
          </li>
          <li>
            <strong>Fixed sum per invoice:</strong> £40 under £1,000, £70 from £1,000 to £9,999.99, £100 from £10,000.
          </li>
          <li>
            <strong>Recovery costs:</strong> reasonable costs of chasing the debt, such as a debt collector&apos;s fee, on top of the fixed sum.
          </li>
        </ul>
      </div>

      <div>
        <h2>Reference rates</h2>
        <p>The reference rate is fixed for each half-year, and applies to the whole time a debt is late.</p>
        <table>
          <thead>
            <tr>
              <th>Debt became late</th>
              <th>Reference rate</th>
              <th>Statutory interest</th>
            </tr>
          </thead>
          <tbody>
            {[...REFERENCE_RATES].reverse().map((r) => (
              <tr key={r.from}>
                <td>{halfYear(r.from)}</td>
                <td>{r.ratePct}%</td>
                <td>{r.ratePct + 8}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2>A worked example</h2>
        <p>
          You invoice a main contractor £10,000 on 1 July 2026 with 30-day terms, so it&apos;s due on 31 July. It&apos;s paid on 30 September, 61 days late. The rate is 3.75% + 8% ={" "}
          <strong>11.75%</strong>. Interest is £10,000 × 11.75% ÷ 365 × 61 = <strong>£196.37</strong>, plus a fixed sum of <strong>£100</strong>.
        </p>
      </div>

      <div>
        <h2>How to claim it</h2>
        <ol>
          <li>Send a reminder as soon as an invoice is late, saying that you&apos;ll add statutory interest and compensation if it stays unpaid.</li>
          <li>Send a letter or invoice for the interest and fixed sum (the calculator writes one for you).</li>
          <li>If it still isn&apos;t paid, you can include the interest and compensation in a small claim or a claim through the courts.</li>
        </ol>
        <p>
          Retention paid late counts too. See what&apos;s being held back with the <Link href={toolPath("retention-calculator")}>retention money calculator</Link>.
        </p>
      </div>
    </ToolPage>
  );
}
