import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Percent, ReceiptText, TrendingUp } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { Container, DarkCtaBand, H1 } from "@/components/marketing/pieces";
import { siteLinks } from "@/components/marketing/links";
import { JsonLd } from "@/components/seo/json-ld";
import { TOOLS, toolPath } from "@/lib/content/tools";
import { absoluteUrl, breadcrumbSchema, graph, pageMetadata, webPageSchema } from "@/lib/seo";

const TITLE = "Free calculators for builders and renovation firms";
const DESCRIPTION = "Free tools for UK builders: a CIS deduction calculator, a VAT reverse charge checker, markup vs margin, and the turnover you need for the profit you want. No sign-up.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: siteLinks.tools });

const ICONS: Record<string, typeof Calculator> = {
  "cis-calculator": Calculator,
  "reverse-charge-vat-checker": ReceiptText,
  "markup-margin-calculator": Percent,
  "revenue-profit-calculator": TrendingUp,
};

/** The free tools hub: every calculator, with a line on what each one answers. */
export default function ToolsPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageSchema({ path: siteLinks.tools, name: TITLE, description: DESCRIPTION, type: "CollectionPage" }),
          {
            "@type": "ItemList",
            name: TITLE,
            itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: absoluteUrl(toolPath(t.slug)) })),
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Free tools", path: siteLinks.tools },
          ]),
        )}
      />
      <section className="px-6 pt-[72px] text-center">
        <div className="mx-auto flex max-w-[760px] flex-col items-center gap-[18px]">
          <Eyebrow>Free tools · no sign-up</Eyebrow>
          <H1 className="text-[clamp(36px,5.2vw,60px)]">Free calculators for builders.</H1>
          <p className="max-w-[580px] text-lg leading-[1.55] text-ink-2">
            The sums every UK building and renovation firm has to get right: CIS, VAT, pricing and profit. Free to use, nothing to sign up for.
          </p>
        </div>
      </section>
      <section className="px-6 pt-14">
        <Container className="grid max-w-[1000px] gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => {
            const Icon = ICONS[t.slug] ?? Calculator;
            return (
              <Link key={t.slug} href={toolPath(t.slug)} className="group flex flex-col gap-3 rounded-[20px] bg-white p-7 shadow-ring transition-shadow hover:shadow-[0_0_0_1px_#E2E1DC,0_12px_32px_-16px_rgb(16_16_15/0.25)]">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-5" />
                </span>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{t.name}</h2>
                <p className="text-[15px] leading-[1.55] text-ink-2">{t.summary}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[15px] font-medium text-ink group-hover:text-ink-2">
                  Open the calculator
                  <ArrowRight className="size-[15px]" />
                </span>
              </Link>
            );
          })}
        </Container>
      </section>
      <section className="px-6 pt-28 pb-28">
        <DarkCtaBand
          className="py-[clamp(48px,7vw,80px)] [&>div]:gap-[18px]"
          titleClassName="text-[clamp(32px,4.6vw,54px)]"
          title="Stop doing the sums by hand."
          body="Builder OS works out VAT, CIS, markup and job profit for you, from the quote to the final invoice."
          primaryHref={siteLinks.startFree}
        />
      </section>
    </>
  );
}
