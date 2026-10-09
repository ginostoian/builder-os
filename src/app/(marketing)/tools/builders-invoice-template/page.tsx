import type { Metadata } from "next";
import Link from "next/link";
import { DocumentTemplate } from "@/components/tools/document-template";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("builders-invoice-template")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "What must a builder's invoice include?",
    a: "A unique invoice number, the date, your business name and address, the customer's name and address, a description of the work, the amount, and when it's due. If you're VAT registered it also needs your VAT number, the VAT rate and amount, and the total including VAT.",
  },
  {
    q: "How do I show the reverse charge on an invoice?",
    a: "Show the VAT rate and the amount of VAT, but don't add it to the total, and add a note such as 'Reverse charge: customer to pay the VAT to HMRC'. Choose 'Reverse charge' in the template and it's done for you.",
  },
  {
    q: "How do I show CIS on an invoice?",
    a: "If you're a subcontractor under CIS, show the labour and materials separately, then the deduction your contractor will make (20% if you're registered, 30% if not) on the labour, and the amount you'll actually be paid. Choose the CIS rate in the template and mark each line as labour or materials.",
  },
  {
    q: "What payment terms should I use?",
    a: "Many builders use 7 or 14 days for homeowners and 30 days for business customers. Whatever you choose, put the due date on the invoice. If a business customer pays late, you can claim statutory interest and compensation.",
  },
  {
    q: "Is this invoice template free?",
    a: "Yes. Fill it in, download it as a PDF and send it. Nothing is sent to us: your details stay in your browser. Builder OS can send invoices that clients pay online, and chase them automatically.",
  },
];

export default function InvoiceTemplatePage() {
  return (
    <ToolPage
      tool={tool}
      heading="Free builder's invoice template"
      intro={
        <p>
          Create a professional invoice in a couple of minutes: your logo and bank details, VAT or the domestic reverse charge, and the CIS deduction if you&apos;re a subcontractor.
          Download it as a PDF and send it. Free, with nothing to sign up for.
        </p>
      }
      calculator={<DocumentTemplate kind="invoice" />}
      printOnlyCalculator
      cta={{
        title: "Invoices that get paid faster.",
        body: "Builder OS turns your quote's payment stages into invoices, lets clients pay online by card or bank, and sends polite reminders until they do.",
        points: ["Invoices straight from your quote", "Online payment by card or bank", "Automatic payment reminders", "CIS deductions worked out for you"],
      }}
      faqs={faqs}
    >
      <div>
        <h2>Getting paid on time</h2>
        <ul>
          <li>
            <strong>Invoice the day the stage is done</strong>, while the client can see the work.
          </li>
          <li>
            <strong>Make it easy to pay:</strong> bank details and the invoice number as the reference, right on the invoice.
          </li>
          <li>
            <strong>Put the due date on it</strong>, not just the terms, and chase the day after it passes.
          </li>
        </ul>
        <p>
          Business customer paying late? Work out the interest and compensation you can claim with the{" "}
          <Link href={toolPath("late-payment-interest-calculator")}>late payment interest calculator</Link>. Not sure whether to charge VAT? Use the{" "}
          <Link href={toolPath("reverse-charge-vat-checker")}>reverse charge VAT checker</Link>.
        </p>
      </div>
    </ToolPage>
  );
}
