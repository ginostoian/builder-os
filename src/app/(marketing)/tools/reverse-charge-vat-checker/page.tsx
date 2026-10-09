import type { Metadata } from "next";
import Link from "next/link";
import { ReverseChargeChecker } from "@/components/tools/reverse-charge-checker";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { DRC_WORDING } from "@/core/tools/reverse-charge";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("reverse-charge-vat-checker")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "What is the VAT domestic reverse charge for construction?",
    a: "Since 1 March 2021, when a VAT-registered builder supplies construction services covered by CIS to another VAT and CIS registered business that isn't an end user, the customer pays the VAT straight to HMRC instead of paying it to the builder. It was brought in to stop fraud where VAT was collected and never paid over.",
  },
  {
    q: "Does the reverse charge apply to homeowners?",
    a: "No. Homeowners aren't VAT registered, so work for them is always invoiced with VAT in the normal way (if you're VAT registered).",
  },
  {
    q: "What should a reverse charge invoice say?",
    a: `It must say that the reverse charge applies, for example "${DRC_WORDING}". It should still show the VAT rate and the amount of VAT, but the VAT isn't added to the total the customer pays you.`,
  },
  {
    q: "What is an end user?",
    a: "A VAT and CIS registered business that uses the construction work itself rather than selling it on, such as a developer, a landlord, or a business having its own premises built or refurbished. If they tell you in writing that they're an end user, you charge VAT as normal.",
  },
  {
    q: "What is an intermediary supplier?",
    a: "A business that buys construction work and passes it on, without changing it, to an end user it's connected or linked to (in the same group, or a landlord and tenant). Like an end user, it should tell you in writing, and then you charge VAT as normal.",
  },
  {
    q: "Does the reverse charge apply to materials?",
    a: "When materials are supplied as part of construction work, the reverse charge covers the whole supply, materials included. A supply of materials only (with no work) isn't covered.",
  },
  {
    q: "Does the reverse charge apply to zero-rated work?",
    a: "No. It only covers work that's standard rated (20%) or reduced rated (5%). Zero-rated work, such as building a new home, is invoiced at 0% as normal.",
  },
  {
    q: "What if only a small part of the job is covered?",
    a: "If a single supply mixes reverse charge services with other services, the reverse charge applies to the whole supply. HMRC's 5% disregard is different: it lets a customer who is mostly an end user still tell you they're an end user when 5% or less of what they buy, by value over the contract, is sold on. Both sides must agree it at the start of the contract.",
  },
];

export default function ReverseChargeCheckerPage() {
  return (
    <ToolPage
      tool={tool}
      heading="VAT domestic reverse charge checker for construction"
      intro={
        <p>
          Not sure whether to charge VAT or put &ldquo;reverse charge&rdquo; on your invoice? Answer up to six quick questions to find out, see why, and get the exact wording and
          figures your invoice needs.
        </p>
      }
      calculator={<ReverseChargeChecker />}
      cta={{
        title: "Quotes and invoices with the sums done for you.",
        body: "Builder OS adds the VAT to every quote and invoice, works out CIS on subcontractor payments and lets clients pay online, so the figures are right before anything goes out.",
        points: ["VAT worked out on every quote and invoice", "CIS deductions on subcontractor payments", "Invoices paid online by card or bank", "Automatic payment reminders"],
      }}
      faqs={faqs}
      disclaimer="This checker follows HMRC's VAT domestic reverse charge guidance as of October 2026. It's a guide, not tax advice: for unusual cases, check HMRC's technical guide or ask your accountant."
    >
      <div>
        <h2>When the reverse charge applies</h2>
        <p>The domestic reverse charge applies to a supply of building and construction services when all of these are true:</p>
        <ul>
          <li>you&apos;re VAT registered;</li>
          <li>your customer is VAT registered and registered for CIS;</li>
          <li>the work is covered by CIS (most building, alteration, repair, decorating and installation work is);</li>
          <li>the work is standard rated (20%) or reduced rated (5%), not zero rated; and</li>
          <li>your customer isn&apos;t an end user or intermediary supplier (or hasn&apos;t told you they are).</li>
        </ul>
        <p>Supplying staff or labour only, as an employment business does, is excluded.</p>
      </div>

      <div>
        <h2>What changes on your invoice</h2>
        <p>
          With the reverse charge, you don&apos;t collect VAT from your customer. Your invoice still shows the VAT rate and the VAT amount, but the total due is the net figure. Add a
          note such as <strong>&ldquo;{DRC_WORDING}&rdquo;</strong>.
        </p>
        <h3>Example</h3>
        <p>
          You invoice another builder £10,000 for standard-rated work under the reverse charge. The invoice shows VAT at 20% of £2,000, marked as reverse charge, and the amount due is{" "}
          <strong>£10,000</strong>. Your customer accounts for the £2,000 on their VAT return, and in most cases claims it back on the same return.
        </p>
      </div>

      <div>
        <h2>What changes on your VAT return</h2>
        <p>
          As the supplier, you don&apos;t include reverse charge VAT in your output tax, but you do include the net value of the sale. As the customer, you add the VAT to your output
          tax and, if you&apos;re entitled to, reclaim it as input tax. Many subcontractors find they get regular VAT refunds once the reverse charge applies, so monthly VAT returns
          can help your cash flow.
        </p>
      </div>

      <div>
        <h2>The reverse charge and CIS</h2>
        <p>
          The reverse charge follows CIS, so if you&apos;re paying a subcontractor under CIS you&apos;ll usually be dealing with both. CIS deductions are worked out on the amount before
          VAT. Our <Link href={toolPath("cis-calculator")}>CIS deduction calculator</Link> handles both together.
        </p>
      </div>
    </ToolPage>
  );
}
