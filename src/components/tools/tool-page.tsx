import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Info } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { siteLinks } from "@/components/marketing/links";
import { NewsletterSignup } from "@/components/marketing/newsletter";
import { Container, H1 } from "@/components/marketing/pieces";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { TOOLS, toolPath, type Tool } from "@/lib/content/tools";
import { breadcrumbSchema, faqSchema, graph, toolSchema, webPageSchema } from "@/lib/seo";

export type Faq = { q: string; a: string };

/**
 * The frame every free tool shares: breadcrumbs, a keyword-rich heading, the calculator, a "do this in
 * Builder OS" card, a useful explanation, questions and answers (all in the page's HTML, so search
 * engines read them), related tools and a newsletter sign-up. Structured data describes the page as a
 * free web app with breadcrumbs and FAQs.
 */
export function ToolPage({
  tool,
  heading,
  intro,
  calculator,
  cta,
  children,
  faqs,
  disclaimer,
}: {
  tool: Tool;
  heading: string;
  intro: React.ReactNode;
  calculator: React.ReactNode;
  cta: { title: string; body: string; points: string[] };
  children: React.ReactNode;
  faqs: Faq[];
  disclaimer?: string;
}) {
  const path = toolPath(tool.slug);
  const related = TOOLS.filter((t) => t.slug !== tool.slug);
  return (
    <>
      <JsonLd
        data={graph(
          webPageSchema({ path, name: tool.title, description: tool.description, dateModified: tool.updated }),
          toolSchema({ path, name: tool.name, description: tool.description }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Free tools", path: siteLinks.tools },
            { name: tool.name, path },
          ]),
          faqSchema(faqs),
        )}
      />

      <section className="px-6 pt-8 sm:pt-12">
        <Container className="max-w-[1120px]">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[13px] text-subtle">
            <Link href="/" className="hover:text-ink-2">
              Home
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={siteLinks.tools} className="hover:text-ink-2">
              Free tools
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page" className="text-ink-2">
              {tool.name}
            </span>
          </nav>
          <div className="mt-6 max-w-[780px]">
            <Eyebrow>Free tool · no sign-up</Eyebrow>
            <H1 className="mt-3 text-[clamp(32px,4.6vw,52px)] leading-[1.05]">{heading}</H1>
            <div className="mt-4 text-[17px] leading-[1.6] text-ink-2">{intro}</div>
          </div>
        </Container>
      </section>

      <section className="px-4 pt-8 sm:px-6 sm:pt-10" aria-label={tool.name}>
        <Container className="max-w-[1120px]">{calculator}</Container>
      </section>

      <section className="px-6 pt-12 print:hidden">
        <Container className="max-w-[1120px]">
          <div className="grid gap-6 rounded-[24px] bg-ink p-7 text-white sm:p-9 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <div className="font-mono text-[12.5px] text-night-text">Builder OS</div>
              <h2 className="mt-2 text-[clamp(22px,2.6vw,30px)] leading-[1.15] font-semibold tracking-[-0.03em]">{cta.title}</h2>
              <p className="mt-2.5 text-[15.5px] leading-[1.55] text-night-text">{cta.body}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button asChild variant="inverse" size="lg" className="hover:text-ink">
                  <Link href={siteLinks.startFree}>
                    Start free
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="night" size="lg" className="hover:text-white">
                  <Link href={siteLinks.features}>See how it works</Link>
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5">
              {cta.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-[15px] leading-[1.45] text-night-ink">
                  <Check className="mt-0.5 size-4 flex-none text-brand" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="px-6 pt-16 print:hidden">
        <Container className="grid max-w-[1120px] gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="flex max-w-[760px] flex-col gap-8 text-[16px] leading-[1.7] text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:leading-[1.2] [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-1.5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:font-semibold [&_strong]:text-ink [&_table]:mt-3 [&_table]:w-full [&_table]:text-[14.5px] [&_td]:border-b [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_th]:border-b [&_th]:border-hairline [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
            {children}

            <div>
              <h2 id="faq">Questions people ask</h2>
              <div className="mt-2 border-t border-hairline">
                {faqs.map((f) => (
                  <details key={f.q} className="group border-b border-hairline py-1">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-3 text-[16.5px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronRight className="mt-1 size-4 flex-none text-subtle transition-transform group-open:rotate-90" aria-hidden />
                    </summary>
                    <p className="pb-4 text-[15.5px] leading-[1.65] text-ink-2">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>

            {disclaimer && (
              <p className="flex gap-2 rounded-xl bg-muted px-4 py-3 text-[13.5px] leading-[1.55] text-ink-2">
                <Info className="mt-0.5 size-4 flex-none text-subtle" aria-hidden />
                {disclaimer}
              </p>
            )}
          </article>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[20px] bg-white p-5 shadow-ring">
              <div className="text-[13px] font-medium text-subtle">More free tools</div>
              <ul className="mt-3 flex flex-col gap-3">
                {related.map((t) => (
                  <li key={t.slug}>
                    <Link href={toolPath(t.slug)} className="group block">
                      <span className="flex items-center gap-1 text-[15px] font-medium text-ink group-hover:text-ink-2">
                        {t.name}
                        <ArrowRight className="size-3.5" />
                      </span>
                      <span className="mt-0.5 block text-[13.5px] leading-[1.45] text-ink-2">{t.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[20px] bg-white p-5 shadow-ring">
              <div className="text-[15px] font-semibold text-ink">New tools and guides, once a month</div>
              <p className="mt-1 mb-3 text-[13.5px] leading-[1.5] text-ink-2">Practical help for running a building firm. No spam, unsubscribe any time.</p>
              <NewsletterSignup />
            </div>
          </aside>
        </Container>
      </section>
      <div className="h-24 print:hidden" />
    </>
  );
}
