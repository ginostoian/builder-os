import type { Metadata } from "next";
import Link from "next/link";
import { CisCalculator } from "@/components/tools/cis-calculator";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("cis-calculator")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "What are the CIS deduction rates?",
    a: "20% for subcontractors registered for CIS, 30% for subcontractors who aren't registered (or whom HMRC can't match when you verify them), and 0% for subcontractors with gross payment status.",
  },
  {
    q: "Is CIS deducted from materials?",
    a: "No. The deduction is only taken from the labour part of the payment. Materials the subcontractor bought for the job, plant hire, fuel for plant and the CITB levy are taken off first. Ask for the materials cost to be shown on the invoice so you can prove it.",
  },
  {
    q: "Is CIS deducted from VAT?",
    a: "No. The deduction is worked out on the amount before VAT. If the subcontractor charges VAT normally you pay them the VAT in full. If the domestic reverse charge applies, they don't charge you VAT at all and you account for it on your own VAT return.",
  },
  {
    q: "When do I pay CIS deductions to HMRC?",
    a: "Tax months run from the 6th of one month to the 5th of the next. Your CIS300 monthly return is due by the 19th after the tax month ends, and the deductions must reach HMRC by the 22nd (or the 19th if you pay by post).",
  },
  {
    q: "What happens if I file my CIS return late?",
    a: "HMRC charges a £100 penalty as soon as the return is late, with more after 2, 6 and 12 months. You still have to file a return for months when you paid subcontractors, and you can tell HMRC when you've paid nobody so you don't get penalties for those months.",
  },
  {
    q: "Do I have to give my subcontractors a statement?",
    a: "Yes. Every subcontractor you made a deduction from needs a payment and deduction statement within 14 days of the end of the tax month. It shows what you paid them, the materials, and what you deducted, so they can claim it against their tax bill.",
  },
  {
    q: "How do I work out what to charge so I take home a set amount?",
    a: "Divide the take-home you want by 0.8 if you're registered (20%), or by 0.7 if you're not (30%). So to take home £800 of labour as a registered subcontractor you invoice £1,000. Switch the calculator to 'What to charge for a take-home' to do it for you.",
  },
];

export default function CisCalculatorPage() {
  return (
    <ToolPage
      tool={tool}
      heading="CIS deduction calculator"
      intro={
        <p>
          Work out the Construction Industry Scheme deduction on a subcontractor&apos;s invoice, what to pay them, and when the money is due to HMRC. Materials and VAT are handled
          properly, and you can work backwards from the amount a subcontractor wants to take home.
        </p>
      }
      calculator={<CisCalculator />}
      cta={{
        title: "Let Builder OS do your CIS every month.",
        body: "Record a subcontractor payment and the deduction is worked out from their verified status. At the end of the month the figures for your return and every statement are ready.",
        points: ["Deductions worked out on every payment", "Monthly CIS300 figures in one click", "Payment and deduction statements for each subcontractor", "The due date on every month's report"],
      }}
      faqs={faqs}
      disclaimer="This calculator follows HMRC's CIS rules as of October 2026. It's a guide, not tax advice: check anything unusual with your accountant or HMRC."
    >
      <div>
        <h2>How CIS deductions work</h2>
        <p>
          Under the Construction Industry Scheme, a contractor who pays a subcontractor for construction work takes a deduction from the payment and passes it to HMRC. It counts as an
          advance payment towards the subcontractor&apos;s tax and National Insurance, so they get it back through their tax return.
        </p>
        <p>The deduction depends on the subcontractor&apos;s status, which you find out by verifying them with HMRC before you first pay them:</p>
        <table>
          <thead>
            <tr>
              <th>Subcontractor status</th>
              <th>Deduction</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Registered for CIS</td>
              <td>20%</td>
            </tr>
            <tr>
              <td>Not registered, or can&apos;t be verified</td>
              <td>30%</td>
            </tr>
            <tr>
              <td>Gross payment status</td>
              <td>0%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <h2>What the deduction is taken from</h2>
        <p>
          Only the labour. Start with the amount before VAT, then take off what the subcontractor spent on materials for the job, plant hire, fuel for plant and any CITB levy. The
          deduction is the rate applied to what&apos;s left.
        </p>
        <h3>A worked example</h3>
        <p>
          A registered subcontractor invoices £1,000 for labour and £250 for materials, plus VAT under the domestic reverse charge. The deduction is 20% of £1,000, which is{" "}
          <strong>£200</strong>. You pay the subcontractor <strong>£1,050</strong> (the £1,250 gross less £200), pay the £200 to HMRC with your monthly return, and account for the
          £250 of VAT on your own VAT return.
        </p>
      </div>

      <div>
        <h2>Your monthly CIS jobs as a contractor</h2>
        <ol>
          <li>Verify every new subcontractor with HMRC before you pay them, and record their verification number.</li>
          <li>Take the right deduction from each payment and keep a record of the labour, materials and deduction.</li>
          <li>File your CIS300 return by the 19th after each tax month ends (tax months run from the 6th to the 5th).</li>
          <li>Pay the deductions to HMRC by the 22nd, or the 19th if you pay by post.</li>
          <li>Give each subcontractor a payment and deduction statement within 14 days of the end of the tax month.</li>
        </ol>
      </div>

      <div>
        <h2>CIS and the VAT reverse charge</h2>
        <p>
          Most payments between VAT-registered builders that fall under CIS also fall under the VAT domestic reverse charge. The subcontractor&apos;s invoice shows the VAT but doesn&apos;t
          charge it, and you account for it to HMRC instead. Not sure if it applies? Use our <Link href={toolPath("reverse-charge-vat-checker")}>reverse charge VAT checker</Link>.
        </p>
      </div>
    </ToolPage>
  );
}
