import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Lock, Users } from "lucide-react";
import { ArticleBody } from "@/components/help/article-body";
import { ARTICLES, articleBySlug, articlesIn, categoryOf, readingMinutes } from "@/lib/content/help";
import { LEGAL } from "@/lib/content/legal";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/seo/json-ld";
import { articleSchema, breadcrumbSchema, graph, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = articleBySlug((await params).slug);
  return a ? pageMetadata({ title: `${a.title} · Help`, description: a.summary, path: `/help/${a.slug}`, type: "article" }) : {};
}

const PLAN_NOTE = { essentials: "On the Essentials and Pro plans", pro: "On the Pro plan" } as const;

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  const category = categoryOf(a.category);
  const siblings = articlesIn(a.category);
  const at = siblings.findIndex((s) => s.slug === a.slug);
  const prev = siblings[at - 1];
  const next = siblings[at + 1];
  const related = (a.related ?? []).map(articleBySlug).filter((r): r is NonNullable<typeof r> => Boolean(r));
  return (
    <section className="px-6 pt-10 pb-24">
      <JsonLd
        data={graph(
          articleSchema({ path: `/help/${a.slug}`, headline: a.title, description: a.summary, type: "TechArticle" }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Help centre", path: "/help" },
            { name: a.title, path: `/help/${a.slug}` },
          ]),
        )}
      />
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={category.title} className="hidden lg:block">
          <div className="sticky top-24">
            <Link href="/help" className="flex items-center gap-1.5 text-[13.5px] text-ink-2 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              Help centre
            </Link>
            <div className="mt-5 mb-2 text-[12.5px] font-medium text-subtle">{category.title}</div>
            <ul className="flex flex-col gap-0.5">
              {siblings.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/help/${s.slug}`}
                    aria-current={s.slug === a.slug ? "page" : undefined}
                    className={cn("block rounded-lg px-3 py-1.5 text-[14px]", s.slug === a.slug ? "bg-white font-medium text-ink shadow-ring" : "text-ink-2 hover:text-ink")}
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="min-w-0 max-w-[720px]">
          <div className="flex items-center gap-1.5 text-[13.5px] text-subtle">
            <Link href="/help" className="hover:text-ink">
              Help centre
            </Link>
            <span>/</span>
            <Link href={`/help#${category.id}`} className="hover:text-ink">
              {category.title}
            </Link>
          </div>
          <h1 className="mt-3 text-[clamp(30px,4vw,40px)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{a.title}</h1>
          <p className="mt-2 text-[18px] leading-[1.5] text-ink-2">{a.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-ink-2 shadow-ring">
              <Clock className="size-3.5" />
              {readingMinutes(a)} min read
            </span>
            {a.plan && (
              <Link href="/help/plans-and-pricing" className="flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 font-medium text-brand hover:bg-brand/15">
                <Lock className="size-3.5" />
                {PLAN_NOTE[a.plan]}
              </Link>
            )}
            {a.who && (
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-ink-2 shadow-ring">
                <Users className="size-3.5" />
                {a.who}
              </span>
            )}
          </div>
          <div className="mt-8">
            <ArticleBody blocks={a.body} />
          </div>

          {related.length > 0 && (
            <div className="mt-12 rounded-[20px] bg-white p-6 shadow-ring">
              <h2 className="text-[16px] font-semibold">Related guides</h2>
              <ul className="mt-3 flex flex-col">
                {related.map((r) => (
                  <li key={r.slug} className="border-t border-line first:border-0">
                    <Link href={`/help/${r.slug}`} className="group flex items-start gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink group-hover:underline">{r.title}</span>
                        <span className="block text-[14px] text-ink-2">{r.summary}</span>
                      </span>
                      <ArrowRight className="mt-1 size-4 flex-none text-faint-2 group-hover:text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prev ? (
              <Link href={`/help/${prev.slug}`} className="rounded-2xl bg-white p-4 shadow-ring hover:shadow-[0_0_0_1.5px_var(--color-ink)]">
                <span className="text-[12.5px] text-subtle">Previous</span>
                <span className="block font-medium text-ink">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/help/${next.slug}`} className="rounded-2xl bg-white p-4 text-right shadow-ring hover:shadow-[0_0_0_1.5px_var(--color-ink)]">
                <span className="text-[12.5px] text-subtle">Next</span>
                <span className="block font-medium text-ink">{next.title}</span>
              </Link>
            )}
          </div>
          <p className="mt-10 text-[14px] text-ink-2">
            Still stuck? Email{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="font-medium text-ink underline underline-offset-2">
              {LEGAL.supportEmail}
            </a>{" "}
            and we&apos;ll help.
          </p>
        </article>
      </div>
    </section>
  );
}
