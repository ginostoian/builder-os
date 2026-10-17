import type { Metadata } from "next";
import { BadgeCheck, BookCheck, ChartColumn, Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { ReverseChargeInvoice, XeroFlow } from "@/components/marketing/books";
import { siteLinks } from "@/components/marketing/links";
import { Container, DarkCtaBand, H1, H2, PrimaryCta, SecondaryCta } from "@/components/marketing/pieces";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, faqSchema, graph, pageMetadata, softwareSchema, webPageSchema } from "@/lib/seo";

const PATH = "/integrations/xero";
const TITLE = "Xero integration for builders: invoices and payments, synced";
const DESCRIPTION =
  "Builder OS sends every invoice and payment to Xero with the right VAT codes, the reverse charge included, tags each job for profit per job, and marks invoices paid when they're reconciled.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const outcomes = [
  {
    icon: ReceiptText,
    title: "Nothing typed twice",
    body: "Raise an invoice and it's in Xero seconds later: the client, every line, the VAT and the due date. Your existing Xero contacts are reused, not duplicated.",
  },
  {
    icon: Landmark,
    title: "Bank reconciliation in minutes",
    body: "Payments you mark, and card payments clients make online, are recorded in Xero against the right account. Online payments go through a Stripe account, so the payout is never counted twice.",
  },
  {
    icon: BadgeCheck,
    title: "Know the moment you're paid",
    body: "When your bookkeeper matches a bank transfer in Xero, the invoice is marked paid in Builder OS and the payment reminders stop on their own.",
  },
  {
    icon: BookCheck,
    title: "The reverse charge, right first time",
    body: "Work for main contractors goes across with Xero's domestic reverse charge VAT codes, and your invoice carries HMRC's wording. No rejected invoices, no credit notes.",
  },
  {
    icon: ChartColumn,
    title: "Profit per job you can trust",
    body: "Every invoice is tagged with its job. Tag supplier bills too and see real profit for each job, alongside cash in the bank and what you're owed.",
  },
  {
    icon: ShieldCheck,
    title: "Your accountant stays happy",
    body: "Send invoices approved or as drafts for review. Lock dates are respected, nothing in Xero is ever deleted, and every sync is logged with a plain-English fix if something needs you.",
  },
];

const steps = [
  ["Click Connect to Xero", "In Settings, sign in to Xero and pick your organisation."],
  ["Check the choices", "We set your sales account, bank account, Stripe account and a Jobs tracking category for you."],
  ["Carry on as normal", "From now on, invoices and payments look after themselves. Send older invoices across in one click if you like."],
];

const faqs = [
  {
    q: "Which plans include Xero?",
    a: "Essentials and Pro. Profit per job, cash and money owed from Xero appear on the Reports page, which is part of Pro. Every plan starts with a 14-day free trial of Pro.",
  },
  {
    q: "Will it duplicate anything in my Xero?",
    a: "No. Builder OS checks Xero before every step. Existing contacts are matched by email or name, an invoice that's already there is linked rather than created again, and a payment is only recorded if the invoice still has money owing.",
  },
  {
    q: "I already take card payments through Stripe. Won't they be counted twice?",
    a: "Not if you choose a Stripe account in Xero for online payments (Builder OS picks one for you if it finds it). The payment is recorded there, and the Stripe payout to your bank is a transfer between the two.",
  },
  {
    q: "What about the VAT domestic reverse charge?",
    a: "Mark the client as a reverse charge contractor in Builder OS and their invoices go to Xero with the domestic reverse charge tax codes. Xero needs those rates switched on once (Accounting, Advanced, Tax rates); Builder OS tells you if they aren't.",
  },
  {
    q: "Do my old invoices go across?",
    a: "Only from the date you choose. Set an earlier date and press Send invoices from, and earlier invoices go across too. Anything already in Xero is matched, not copied.",
  },
  {
    q: "What if Xero is down or busy?",
    a: "Nothing is lost. Each change waits in a queue and is tried again automatically. If something needs you, like a lock date, Settings shows exactly what to do and a Retry button.",
  },
  { q: "Can I disconnect?", a: "Any time, in Settings. Everything already in Xero stays there." },
];

export default function XeroIntegrationPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageSchema({ path: PATH, name: TITLE, description: DESCRIPTION }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Features", path: "/features" },
            { name: "Xero integration", path: PATH },
          ]),
          faqSchema(faqs),
          softwareSchema(),
        )}
      />
      <section className="px-6 pt-[88px] pb-12">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-12">
          <div className="flex flex-col gap-5">
            <Eyebrow>Builder OS + Xero</Eyebrow>
            <H1 className="text-[clamp(40px,5.2vw,64px)]">Stop typing invoices into Xero.</H1>
            <p className="max-w-[560px] text-lg leading-[1.55] text-ink-2">
              Raise an invoice in Builder OS and it&apos;s in Xero seconds later, with the right VAT and the job it belongs to. Payments follow, and anything paid in Xero is marked
              paid here. Your books stay up to date while you&apos;re on site.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <PrimaryCta href={siteLinks.pricing}>Start free</PrimaryCta>
              <SecondaryCta href={siteLinks.demo}>Book a demo</SecondaryCta>
            </div>
          </div>
          <div className="rounded-[22px] bg-line p-[clamp(16px,3vw,28px)] shadow-[inset_0_0_0_1px_#E8E7E3]">
            <XeroFlow />
          </div>
        </Container>
      </section>

      <section className="px-6 pt-20">
        <Container>
          <H2 className="mb-10 max-w-[640px] text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Less admin, fewer mistakes, and you always know where the money is.</H2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
            {outcomes.map((o) => (
              <div key={o.title} className="flex flex-col gap-2 rounded-[18px] bg-white p-6 shadow-ring">
                <o.icon className="size-[19px]" strokeWidth={1.5} />
                <h3 className="mt-1.5 text-[16.5px] font-semibold tracking-[-0.01em]">{o.title}</h3>
                <p className="text-[14.5px] leading-[1.55] text-ink-2">{o.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="px-6 pt-24">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-12">
          <div className="flex flex-col gap-4">
            <Eyebrow>For main contractor work</Eyebrow>
            <H2 className="text-[clamp(28px,3.4vw,40px)] leading-[1.1]">The VAT reverse charge, without looking anything up.</H2>
            <p className="text-[17px] leading-[1.6] text-ink-2">
              Tick one box on the client. Every quote, variation and invoice then shows the VAT without charging it, adds the wording HMRC expects, and goes to Xero with the
              domestic reverse charge codes. Your customer pays the VAT to HMRC, exactly as the rules say.
            </p>
          </div>
          <ReverseChargeInvoice className="max-w-[460px] justify-self-center" />
        </Container>
      </section>

      <section className="px-6 pt-24">
        <Container>
          <H2 className="mb-8 text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Set up in about a minute.</H2>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
            {steps.map(([title, body], i) => (
              <li key={title} className="flex flex-col gap-2 rounded-[18px] bg-white p-6 shadow-ring">
                <span className="flex size-7 items-center justify-center rounded-lg bg-muted font-mono text-xs text-ink-2">{i + 1}</span>
                <h3 className="mt-1 text-[16.5px] font-semibold">{title}</h3>
                <p className="text-[14.5px] leading-[1.55] text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="px-6 pt-24">
        <Container className="max-w-[820px]">
          <H2 className="mb-6 text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Questions builders ask</H2>
          <div className="flex flex-col divide-y divide-hairline rounded-[18px] bg-white shadow-ring">
            {faqs.map((f) => (
              <details key={f.q} className="group px-6 py-4">
                <summary className="cursor-pointer list-none text-[16px] font-semibold">{f.q}</summary>
                <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="px-6 pt-28 pb-28">
        <DarkCtaBand className="py-[clamp(56px,8vw,96px)]" title="Get your evenings back." body="Quote, invoice and get paid in Builder OS. Your Xero keeps itself up to date." />
      </section>
    </>
  );
}
