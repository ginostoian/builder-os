import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/brand";
import { ArticleToc } from "@/components/marketing/article-toc";
import { siteLinks } from "@/components/marketing/links";
import { ArrowLink, Container, H1 } from "@/components/marketing/pieces";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { BLOG_ARTICLES, blogArticlePath, type BlogArticle } from "@/lib/content/articles";
import { articleSchema, breadcrumbSchema, faqSchema, graph } from "@/lib/seo";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** The page around a long-form article: header, sticky contents, the body, then more to read. */
export function ArticleLayout({ article, children }: { article: BlogArticle; children: React.ReactNode }) {
  const path = blogArticlePath(article.slug);
  const related = BLOG_ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <>
      <JsonLd
        data={graph(
          articleSchema({
            path,
            headline: article.title,
            description: article.description,
            datePublished: article.published,
            dateModified: article.modified,
            image: article.hero.src,
            type: "BlogPosting",
            author: { name: article.author.name, jobTitle: article.author.role },
            keywords: article.keywords,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: article.title, path },
          ]),
          faqSchema(article.faqs),
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
              <span className="text-ink-3">{article.category}</span>
            </nav>
            <H1 className="text-[clamp(34px,4.6vw,52px)] leading-[1.06] tracking-[-0.04em]">{article.title}</H1>
            <p className="text-[19px] leading-[1.55] text-pretty text-ink-2">{article.excerpt}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
              <div className="flex items-center gap-2.5">
                <Avatar initials={article.author.initials} size={36} className="text-[13px]" />
                <div>
                  <div className="text-[14.5px] font-medium">{article.author.name}</div>
                  <div className="text-[13px] text-subtle">{article.author.role}</div>
                </div>
              </div>
              <div className="text-sm text-subtle">
                <time dateTime={article.published}>{longDate(article.published)}</time>
                {article.modified !== article.published && (
                  <>
                    {" "}
                    · Updated <time dateTime={article.modified}>{longDate(article.modified)}</time>
                  </>
                )}{" "}
                · {article.readMins} min read
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 pt-14">
          <div className="mx-auto flex max-w-[1200px] items-start justify-center gap-16">
            <aside className="sticky top-24 hidden w-[220px] flex-none flex-col gap-1 min-[1000px]:flex">
              <ArticleToc items={article.toc} />
              <div className="mt-6 flex flex-col gap-2.5 rounded-[14px] bg-white p-[18px] shadow-ring">
                <div className="text-[14.5px] font-semibold">Quote your next job free</div>
                <div className="text-[13.5px] leading-normal text-ink-2">Import your rates from Excel and send a signable quote today.</div>
                <Button asChild className="h-9 rounded-[10px] text-[13.5px] hover:text-white">
                  <Link href={siteLinks.startFree}>Start free</Link>
                </Button>
              </div>
            </aside>
            <div className="max-w-[680px] min-w-0 flex-1 text-[17.5px] leading-[1.72] text-ink-4">{children}</div>
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
            {related.map((a) => (
              <Link key={a.slug} href={blogArticlePath(a.slug)} className="flex flex-col gap-3 text-ink hover:text-ink-2">
                <Image src={a.hero.src} alt={a.hero.alt} width={a.hero.width} height={a.hero.height} sizes="(min-width: 1100px) 380px, 100vw" className="aspect-[16/10] rounded-2xl bg-white object-cover object-top shadow-ring" />
                <div className="text-[13px] text-subtle">
                  <span className="font-medium text-ink-3">{a.category}</span> · {a.readMins} min read
                </div>
                <h3 className="text-lg leading-[1.25] font-semibold tracking-[-0.02em]">{a.title}</h3>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
