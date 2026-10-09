import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, Lightbulb } from "lucide-react";
import { Avatar, Placeholder } from "@/components/brand";
import { ArticleToc } from "@/components/marketing/article-toc";
import { siteLinks } from "@/components/marketing/links";
import { ArrowLink, Container, H1, PrimaryCta } from "@/components/marketing/pieces";
import { Button } from "@/components/ui/button";
import { featuredPost, posts } from "@/lib/content/blog";
import { quoteSections, VAT_RATE } from "@/lib/demo-data";
import { formatGBP } from "@/core/money";
import { quoteTotals, sectionTotal } from "@/core/quote";
import { JsonLd } from "@/components/seo/json-ld";
import { articleSchema, breadcrumbSchema, graph, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return [{ slug: featuredPost.slug }];
}

const POST_PATH = `/blog/${featuredPost.slug}`;
const isoDay = (text: string) => new Date(`${text} 12:00 UTC`).toISOString().slice(0, 10);

export const metadata: Metadata = pageMetadata({ title: featuredPost.title, description: featuredPost.excerpt, path: POST_PATH, type: "article" });

const toc = [
  { id: "structure", label: "Structure it the way it'll be built" },
  { id: "hidden", label: "Price the lines everyone forgets" },
  { id: "pc", label: "Be honest about provisional sums" },
  { id: "markup", label: "Mark up per line, not per job" },
  { id: "plan", label: "Attach the payment plan" },
  { id: "send", label: "Send it while they're excited" },
];

const forgotten = [
  "Spoil removal — price per load, and say how many loads you've allowed.",
  "Building Control fees and inspection visits.",
  "Temporary kitchen or protection for the client's existing rooms.",
  "Making good where the knock-through meets the old house.",
  "Skip permits and parking suspensions where the council needs them.",
];

const relatedTitles = [
  "Provisional sums vs PC sums: how to show them so clients get it",
  "The payment plan that stopped us chasing the last 10%",
  "Five lines every bathroom quote forgets",
];

/** Whole-number percentages that always add up to 100 (largest remainder). */
function wholePercentages(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  const deficit = 100 - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < deficit; k++) out[order[k][1]]++;
  return out;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 mb-4 scroll-mt-24 text-[28px] leading-[1.2] font-semibold tracking-[-0.025em] text-ink">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-6">{children}</p>;
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== featuredPost.slug) notFound();

  // The breakdown is the real Q-1042 from the demo workspace, so the article and the app agree.
  const { net } = quoteTotals(quoteSections, VAT_RATE);
  const shares = wholePercentages(quoteSections.map(sectionTotal));
  const breakdown = quoteSections.map((s, i) => ({ name: s.name, value: formatGBP(sectionTotal(s), 0), share: `${shares[i]}%` }));
  const related = relatedTitles.map((t) => posts.find((p) => p.title === t)!).filter(Boolean);

  return (
    <>
      <JsonLd
        data={graph(
          articleSchema({ path: POST_PATH, headline: featuredPost.title, description: featuredPost.excerpt, datePublished: isoDay(featuredPost.longDate), type: "BlogPosting" }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: featuredPost.title, path: POST_PATH },
          ]),
        )}
      />
      <article>
        <header className="px-6 pt-16">
          <div className="mx-auto flex max-w-[880px] flex-col gap-5">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-subtle">
              <Link href={siteLinks.blog} className="text-subtle hover:text-ink-2">
                Blog
              </Link>
              <ChevronRight className="size-[13px]" />
              <span className="text-ink-3">{featuredPost.category}</span>
            </nav>
            <H1 className="text-[clamp(36px,5vw,56px)] leading-[1.04] tracking-[-0.04em]">{featuredPost.title}</H1>
            <p className="text-[19px] leading-[1.55] text-pretty text-ink-2">{featuredPost.excerpt}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
              <div className="flex items-center gap-2.5">
                <Avatar initials={featuredPost.authorInitials} size={36} className="text-[13px]" />
                <div>
                  <div className="text-[14.5px] font-medium">{featuredPost.author}</div>
                  <div className="text-[13px] text-subtle">{featuredPost.authorRole}</div>
                </div>
              </div>
              <div className="text-sm text-subtle">
                {featuredPost.longDate} · {featuredPost.read}
              </div>
            </div>
          </div>
          <Placeholder label="hero image · rear extension, steel going in" className="mx-auto mt-11 aspect-[21/9] max-w-[1200px] rounded-[22px] shadow-ring" />
        </header>

        <div className="px-6 pt-16">
          <div className="mx-auto flex max-w-[1200px] items-start justify-center gap-16">
            <aside className="sticky top-24 hidden w-[220px] flex-none flex-col gap-1 min-[1000px]:flex">
              <ArticleToc items={toc} />
              <div className="mt-6 flex flex-col gap-2.5 rounded-[14px] bg-white p-[18px] shadow-ring">
                <div className="text-[14.5px] font-semibold">Use this quote as a template</div>
                <div className="text-[13.5px] leading-normal text-ink-2">Every line below, ready to load into your Builder OS library.</div>
                <Button asChild className="h-9 rounded-[10px] text-[13.5px] hover:text-white">
                  <Link href={siteLinks.pricing}>Start free</Link>
                </Button>
              </div>
            </aside>

            <div className="max-w-[680px] min-w-0 flex-1 text-[17.5px] leading-[1.72] text-ink-4">
              <P>
                Most extension quotes I see are priced well on the big stuff — steel, brickwork, the roof — and quietly lose money on everything around it. The spoil removal that turned into three grab lorries. The worktop the client upgraded twice. The building control visit nobody priced.
              </P>
              <P>
                This guide walks through a real quote we built for a rear kitchen extension in Bristol: roughly 22m², flat roof with a lantern, knock-through to the existing kitchen. Contract value about £35k including VAT.
              </P>

              <H2 id="structure">1. Structure it the way it&apos;ll be built</H2>
              <P>
                Group your quote into the sections you&apos;ll actually work through on site: groundworks, structure and envelope, kitchen fit, electrics and heating. It reads better for the client, and it means each section can become a payment stage later without rework.
              </P>
              <div className="my-8 overflow-hidden rounded-2xl bg-white text-[14.5px] leading-[1.4] shadow-ring">
                <table className="w-full border-collapse tabular">
                  <thead>
                    <tr className="border-b border-hairline bg-surface text-[12.5px] text-subtle">
                      <th className="px-[18px] py-3 text-left font-normal">Section</th>
                      <th className="w-[110px] py-3 text-right font-normal">Ex VAT</th>
                      <th className="w-[90px] px-[18px] py-3 text-right font-normal">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((b) => (
                      <tr key={b.name} className="border-b border-line">
                        <td className="px-[18px] py-3">{b.name}</td>
                        <td className="py-3 text-right font-medium">{b.value}</td>
                        <td className="px-[18px] py-3 text-right text-subtle">{b.share}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="px-[18px] py-3">Total</td>
                      <td className="py-3 text-right">{formatGBP(net, 0)}</td>
                      <td className="px-[18px] py-3 text-right text-subtle">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <H2 id="hidden">2. Price the lines everyone forgets</H2>
              <p className="mb-5">
                These are the items that most often go missing from extension quotes we review. None of them are big on their own. Together they&apos;re often your whole margin.
              </p>
              <ul className="mb-6 flex flex-col gap-2.5">
                {forgotten.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Check className="mt-1.5 size-4 flex-none" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <H2 id="pc">3. Be honest about provisional sums</H2>
              <P>
                If the client hasn&apos;t chosen their worktop, don&apos;t guess and absorb the difference. Put in a clearly labelled provisional sum with a note explaining what it covers and when it&apos;ll be confirmed. Clients trust a quote more when it tells them where the uncertainty is.
              </P>
              <blockquote className="my-9 pl-6 text-2xl leading-[1.4] font-medium tracking-[-0.02em] text-ink shadow-[inset_2px_0_0_var(--color-ink)]">
                A quote that admits what it doesn&apos;t know yet is a quote the client believes about everything else.
              </blockquote>

              <H2 id="markup">4. Mark up per line, not per job</H2>
              <P>
                A flat 15% across everything sounds tidy, but it over-prices client-supplied items and under-prices the risky ones. On this job we ran 0% on fitting client-supplied units, 8% on the roof lantern (a supplied item with little risk), and 15% on groundworks, where surprises live.
              </P>
              <div className="my-8 flex items-start gap-4 rounded-2xl bg-night px-6 py-[22px] text-night-ink">
                <Lightbulb className="mt-[3px] size-[18px] flex-none" />
                <div className="text-[15.5px] leading-[1.6]">
                  <b className="font-semibold text-white">In Builder OS:</b> set a default markup on the quote, then override any line. Your gross margin updates live in the summary panel as you type.
                </div>
              </div>

              <H2 id="plan">5. Attach the payment plan to the quote</H2>
              <P>
                The time to agree how you&apos;ll get paid is before the client signs, not after. We used four stages tied to visible milestones — deposit on booking, groundworks complete, watertight, practical completion — so nobody can argue a stage hasn&apos;t been reached.
              </P>

              <H2 id="send">6. Send it while they&apos;re still excited</H2>
              <P>
                Speed wins work. A clear quote the evening after the site visit beats a slightly cheaper one a fortnight later. Send it as a link so you can see when it&apos;s been opened, and follow up the day after they&apos;ve read it — not before.
              </P>

              <div className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-[20px] bg-white p-7 shadow-ring">
                <div className="max-w-[380px]">
                  <div className="text-lg font-semibold tracking-[-0.015em]">Build your next extension quote in Builder OS</div>
                  <div className="mt-1.5 text-[15px] leading-normal text-ink-2">Free plan, no card. Load this exact quote as a starting point.</div>
                </div>
                <PrimaryCta href={siteLinks.pricing} className="h-11 px-[18px]" lifted={false}>
                  Start free
                </PrimaryCta>
              </div>
              <div className="mt-12 flex items-center gap-3.5 border-t border-hairline pt-7">
                <Avatar initials="TA" size={48} className="text-base" />
                <div className="text-[15px] leading-normal">
                  <b className="font-semibold">Tom Ashworth</b> ran a renovation firm in Bristol for twelve years before co-founding Builder OS.{" "}
                  <span className="text-ink-2">He still prices the odd loft for friends.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="px-6 py-28">
        <Container>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-[26px] font-semibold tracking-[-0.025em]">Keep reading</h2>
            <ArrowLink href={siteLinks.blog}>All articles</ArrowLink>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
            {related.map((p) => (
              <Link key={p.title} href={siteLinks.article} className="flex flex-col gap-3 text-ink hover:text-ink-2">
                <Placeholder label={p.image} variant="sm" className="aspect-[16/10] rounded-2xl text-[11.5px] shadow-ring" />
                <div className="text-[13px] text-subtle">
                  <span className="font-medium text-ink-3">{p.category}</span> · {p.read}
                </div>
                <h3 className="text-lg leading-[1.25] font-semibold tracking-[-0.02em]">{p.title}</h3>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
