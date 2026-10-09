import type { Metadata } from "next";
import Link from "next/link";
import { DocumentTemplate } from "@/components/tools/document-template";
import { ToolPage, type Faq } from "@/components/tools/tool-page";
import { toolBySlug, toolPath } from "@/lib/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = toolBySlug("builders-quote-template")!;

export const metadata: Metadata = pageMetadata({ title: tool.title, description: tool.description, path: toolPath(tool.slug) });

const faqs: Faq[] = [
  {
    q: "What should a builder's quote include?",
    a: "Your business details and contact, the client and job address, a clear description of the work broken into lines with quantities and prices, VAT, the total, what's not included, how long the price is valid for, payment stages, and a space for the client to accept it.",
  },
  {
    q: "What's the difference between a quote and an estimate?",
    a: "A quote is a fixed price for the work described: if the client accepts it, that's the price, unless the work changes. An estimate is a best guess that can go up or down. If you can't fix a price for part of the job, say so and use a provisional sum for that part.",
  },
  {
    q: "How long should a quote be valid for?",
    a: "Usually 30 days. Material prices change, so a shorter period protects you. Put the date it expires on the quote, and re-check prices if the client comes back after it.",
  },
  {
    q: "Should I ask for a deposit?",
    a: "For domestic work it's common to ask for a deposit to book the start date, then payments at stages as the work goes on, with a final payment on completion. Tie each stage to a clear milestone so there's no argument about when it's due.",
  },
  {
    q: "Is this template really free?",
    a: "Yes. Fill it in, download it as a PDF and send it however you like. Nothing is sent to us: your details stay in your browser. If you want quotes clients can accept online, with your price list built in, try Builder OS.",
  },
];

export default function QuoteTemplatePage() {
  return (
    <ToolPage
      tool={tool}
      heading="Free builder's quote template"
      intro={
        <p>
          Fill in your quote on the left and watch it take shape on the right: your logo, the work line by line, VAT or the reverse charge, payment stages and what&apos;s not
          included. Then download it as a PDF. Free, with nothing to sign up for.
        </p>
      }
      calculator={<DocumentTemplate kind="quote" />}
      printOnlyCalculator
      cta={{
        title: "Quotes clients can accept from their phone.",
        body: "In Builder OS your quotes are built from your own price list in minutes, sent as a link your client can read and accept online, and turned into stage invoices automatically.",
        points: ["Your price list and markups built in", "Clients accept and sign online", "See when a quote's been opened", "Payment stages become invoices"],
      }}
      faqs={faqs}
    >
      <div>
        <h2>What makes a quote win the job</h2>
        <ul>
          <li>
            <strong>Break the work down.</strong> A single figure looks expensive. Lines for each stage of the work show the client what they&apos;re paying for, and make changes easy
            to price later.
          </li>
          <li>
            <strong>Say what&apos;s not included.</strong> Most disputes start with an assumption. List the things the client might expect but you haven&apos;t priced.
          </li>
          <li>
            <strong>Set out the payment stages.</strong> Agree the deposit and stages now, tied to clear milestones, and you won&apos;t be chasing money later.
          </li>
          <li>
            <strong>Send it fast.</strong> The first professional quote through the door often wins, even when it isn&apos;t the cheapest.
          </li>
        </ul>
      </div>
      <div>
        <h2>Pricing it right</h2>
        <p>
          Work out your labour from a day rate that covers your costs with the <Link href={toolPath("day-rate-calculator")}>day rate calculator</Link>, and check the margin on
          each line with the <Link href={toolPath("markup-margin-calculator")}>markup vs margin calculator</Link>. When the job&apos;s done, use the{" "}
          <Link href={toolPath("builders-invoice-template")}>free invoice template</Link>.
        </p>
      </div>
    </ToolPage>
  );
}
