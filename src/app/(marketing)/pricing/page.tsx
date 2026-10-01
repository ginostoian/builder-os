import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { siteLinks } from "@/components/marketing/links";
import { Container, DarkCtaBand, H1, H2 } from "@/components/marketing/pieces";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { comparison, faqs, plans, type Cell } from "@/lib/content/pricing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One price for the whole company. Free, Essentials £49 and Pro £119 a month, plus VAT. No per-seat maths.",
};

function CompareCell({ value }: { value: Cell }) {
  if (value === true)
    return (
      <span className="flex justify-center text-ink">
        <Check className="size-4" aria-label="Included" />
      </span>
    );
  if (value === false)
    return (
      <span className="flex justify-center text-faint">
        <Minus className="size-4" aria-label="Not included" />
      </span>
    );
  return <span className="text-center text-ink-4">{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      <section className="px-6 pt-[88px] text-center">
        <div className="mx-auto flex max-w-[760px] flex-col items-center gap-[18px]">
          <Eyebrow>Pricing</Eyebrow>
          <H1 className="text-[clamp(40px,5.6vw,64px)]">One price for the whole company.</H1>
          <p className="max-w-[560px] text-lg leading-[1.55] text-ink-2">No per-seat maths. Start free, upgrade when you need more, cancel any time.</p>
        </div>
      </section>

      <section className="px-6 pt-14">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-4">
          {plans.map((p) => {
            const dark = p.featured;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col gap-[22px] rounded-[20px] p-8",
                  dark ? "bg-ink text-white shadow-[0_24px_48px_-24px_rgb(16_16_15/0.5)]" : "bg-white text-ink shadow-ring",
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] font-semibold">{p.name}</h2>
                  <span className={cn("rounded-full px-[9px] py-[3px] text-xs font-medium", dark ? "bg-night-edge text-night-ink" : "bg-line text-ink-2")}>{p.tag}</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[52px] leading-none font-semibold tracking-[-0.045em]">{p.price}</span>
                    <span className={cn("text-[14.5px]", dark ? "text-night-text" : "text-ink-2")}>/ month</span>
                  </div>
                  <div className={cn("mt-2 text-[13px]", dark ? "text-night-text" : "text-ink-2")}>{p.vat}</div>
                </div>
                <div className={cn("text-[15px] leading-[1.55]", dark ? "text-night-text" : "text-ink-2")}>{p.desc}</div>
                <Link
                  href={siteLinks.startFree}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-xl text-[15px] font-medium",
                    dark ? "bg-white text-ink hover:text-ink" : "bg-ink text-white hover:text-white",
                  )}
                >
                  {p.cta}
                </Link>
                <div className={cn("h-px", dark ? "bg-night-edge" : "bg-hairline")} />
                <div className="flex flex-col gap-[11px]">
                  <div className={cn("text-[13px] font-medium", dark ? "text-night-text" : "text-ink-2")}>{p.includesLabel}</div>
                  {p.includes.map((i) => (
                    <div key={i} className="flex gap-2.5 text-[14.5px] leading-[1.4]">
                      <Check className="mt-px size-[15px] flex-none" />
                      {i}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Container>
        <Container className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-white px-8 py-6 shadow-ring">
          <div>
            <div className="text-base font-semibold">Moving from spreadsheets or another tool?</div>
            <div className="mt-1 text-[14.5px] text-ink-2">We&apos;ll import your price list, clients and open jobs for free on any paid plan.</div>
          </div>
          <Link
            href={siteLinks.demo}
            className="flex h-10 items-center gap-1.5 rounded-[11px] px-4 text-[14.5px] font-medium text-ink shadow-ring-input hover:bg-surface"
          >
            Talk to us
            <ArrowRight className="size-3.5" />
          </Link>
        </Container>
      </section>

      <section className="px-6 pt-28">
        <Container>
          <H2 className="mb-8 text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Compare plans</H2>
          <div className="overflow-x-auto rounded-[18px] bg-white shadow-ring">
            <table className="w-full min-w-[720px] border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b border-hairline text-[15px]">
                  <th className="w-1/2 px-6 py-[18px]" />
                  {plans.map((p) => (
                    <th key={p.id} className="py-[18px] text-center font-semibold">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              {comparison.map((g) => (
                <tbody key={g.group}>
                  <tr>
                    <th colSpan={4} className="px-6 pt-[22px] pb-2 text-left font-mono text-[12.5px] font-medium text-subtle">
                      {g.group}
                    </th>
                  </tr>
                  {g.rows.map(([label, ...cells]) => (
                    <tr key={label} className="border-t border-line">
                      <th scope="row" className="px-6 py-3 text-left font-normal text-ink-4">
                        {label}
                      </th>
                      {cells.map((c, i) => (
                        <td key={i} className="py-3 text-center">
                          <CompareCell value={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
              <tbody>
                <tr>
                  <td colSpan={4} className="h-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section className="px-6 pt-28">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-16 gap-y-10">
          <div className="flex flex-col gap-3.5">
            <H2 className="text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Questions</H2>
            <p className="max-w-[360px] text-base leading-[1.55] text-ink-2">
              Can&apos;t find what you&apos;re after? Email{" "}
              <Link href={siteLinks.contact} className="text-ink underline">
                hello@builderos.co.uk
              </Link>{" "}
              — a real person replies, usually within the hour.
            </p>
          </div>
          <Accordion type="single" collapsible defaultValue="0" className="border-t border-border">
            {faqs.map(([q, a], i) => (
              <AccordionItem key={q} value={String(i)}>
                <AccordionTrigger>{q}</AccordionTrigger>
                <AccordionContent>{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </section>

      <section className="px-6 pt-32 pb-28">
        <DarkCtaBand
          className="py-[clamp(48px,7vw,80px)] [&>div]:gap-[18px]"
          titleClassName="text-[clamp(32px,4.6vw,54px)]"
          title="Start with your next quote."
          body="Free plan, no card. Takes about five minutes."
          primaryHref={siteLinks.startFree}
        />
      </section>
    </>
  );
}
