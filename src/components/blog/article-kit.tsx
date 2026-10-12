import Image from "next/image";
import Link from "next/link";
import { Check, Lightbulb } from "lucide-react";
import { Avatar } from "@/components/brand";
import { PrimaryCta } from "@/components/marketing/pieces";
import { siteLinks } from "@/components/marketing/links";
import type { BlogArticle } from "@/lib/content/articles";

/**
 * The building blocks long-form blog articles are written with. Article bodies stick to <p>, <h2> and <h3>
 * with these class names, plus the pieces below for the parts that need structure (tables, figures, lists).
 */
export const styles = {
  p: "mb-6",
  h2: "mt-16 mb-4 scroll-mt-24 text-[28px] leading-[1.2] font-semibold tracking-[-0.025em] text-balance text-ink",
  h3: "mt-10 mb-3 scroll-mt-24 text-[21px] leading-[1.3] font-semibold tracking-[-0.02em] text-ink",
  /** The short answer that opens each section, for readers and for answer engines. */
  lead: "mb-6 font-medium text-ink",
  link: "text-ink underline decoration-ink/30 underline-offset-[3px] hover:decoration-ink",
} as const;

/** External source cited in the text. Opens in the same tab: readers come back with the back button. */
export function Cite({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={styles.link} rel="noopener">
      {children}
    </a>
  );
}

/** Internal link in body copy. */
export function In({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={styles.link}>
      {children}
    </Link>
  );
}

/** The 40–60 word answer at the top of the article. No links inside, so it lifts cleanly into a snippet. */
export function AnswerCapsule({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-10 rounded-2xl bg-white p-6 shadow-ring">
      <div className="mb-2 font-mono text-[12.5px] text-subtle">The short answer</div>
      <p className="text-[18px] leading-[1.6] text-ink">{children}</p>
    </div>
  );
}

export function TakeawayList({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <div className="my-10 rounded-2xl bg-surface p-6 shadow-ring">
      <h2 className="mb-4 text-[19px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
      <ul className="flex flex-col gap-3 text-[16.5px] leading-[1.55]">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <Check className="mt-[5px] size-4 flex-none text-brand-ink" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "In this guide": every section, in two columns on wide screens. */
export function TocGrid({ items }: { items: BlogArticle["toc"] }) {
  return (
    <nav aria-label="In this guide" className="mb-12">
      <h2 className="mb-3 text-[19px] font-semibold tracking-[-0.015em] text-ink">In this guide</h2>
      <ol className="grid grid-cols-1 gap-x-8 gap-y-2 text-[15.5px] leading-[1.45] sm:grid-cols-2">
        {items.map((t, i) => (
          <li key={t.id} className="flex gap-2.5">
            <span className="w-5 flex-none text-right font-mono text-[13px] leading-[1.7] text-subtle">{i + 1}</span>
            <Link href={`#${t.id}`} className="text-ink-2 hover:text-ink">
              {t.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** An infographic. Images are 1200px wide; the alt text carries the data for screen readers and search. */
export function Figure({ src, alt, width = 1200, height, caption }: { src: string; alt: string; width?: number; height: number; caption?: React.ReactNode }) {
  return (
    <figure className="my-10">
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 760px) 680px, 100vw" className="h-auto w-full rounded-2xl shadow-ring" />
      {caption && <figcaption className="mt-3 text-[14px] leading-normal text-subtle">{caption}</figcaption>}
    </figure>
  );
}

/** A plain data table that scrolls sideways on a phone instead of squashing. */
export function DataTable({ head, rows, caption }: { head: string[]; rows: React.ReactNode[][]; caption?: string }) {
  return (
    <div className="my-8 overflow-x-auto rounded-2xl bg-white shadow-ring">
      <table className="w-full min-w-[560px] border-collapse text-left text-[14.5px] leading-[1.45] tabular">
        {caption && <caption className="px-[18px] pt-4 text-left text-[13px] text-subtle">{caption}</caption>}
        <thead>
          <tr className="border-b border-hairline text-[12.5px] text-subtle">
            {head.map((h) => (
              <th key={h} scope="col" className="px-[18px] py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-[18px] py-3 font-medium text-ink">
                    {cell}
                  </th>
                ) : (
                  <td key={j} className="px-[18px] py-3">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A dark aside: where Builder OS fits, or a tip worth stopping for. */
export function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-8 flex items-start gap-4 rounded-2xl bg-night px-6 py-[22px] text-night-ink">
      <Lightbulb className="mt-[3px] size-[18px] flex-none" />
      <div className="text-[15.5px] leading-[1.6]">
        <b className="font-semibold text-white">{title}</b> {children}
      </div>
    </div>
  );
}

export function FaqList({ faqs }: { faqs: BlogArticle["faqs"] }) {
  return (
    <section aria-labelledby="faqs">
      <h2 id="faqs" className={styles.h2}>
        Frequently asked questions
      </h2>
      {faqs.map((f) => (
        <div key={f.q}>
          <h3 className={styles.h3}>{f.q}</h3>
          <p className={styles.p}>{f.a}</p>
        </div>
      ))}
    </section>
  );
}

export function References({ items }: { items: BlogArticle["references"] }) {
  return (
    <section aria-labelledby="references" className="mt-14 border-t border-hairline pt-8">
      <h2 id="references" className="mb-4 text-[19px] font-semibold tracking-[-0.015em] text-ink">
        References
      </h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14.5px] leading-normal text-ink-2">
        {items.map((r) => (
          <li key={r.url}>
            <a href={r.url} className={styles.link} rel="noopener">
              {r.title}
            </a>
            {r.publisher && <span className="text-subtle">, {r.publisher}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ArticleCta({ title, body, href = siteLinks.startFree, label = "Start free" }: { title: string; body: string; href?: string; label?: string }) {
  return (
    <div className="my-12 flex flex-wrap items-center justify-between gap-5 rounded-[20px] bg-white p-7 shadow-ring">
      <div className="max-w-[400px]">
        <div className="text-lg font-semibold tracking-[-0.015em]">{title}</div>
        <div className="mt-1.5 text-[15px] leading-normal text-ink-2">{body}</div>
      </div>
      <PrimaryCta href={href} className="h-11 px-[18px]" lifted={false}>
        {label}
      </PrimaryCta>
    </div>
  );
}

export function AuthorBio({ author }: { author: BlogArticle["author"] }) {
  return (
    <div className="mt-12 flex items-center gap-3.5 border-t border-hairline pt-7">
      <Avatar initials={author.initials} size={48} className="text-base" />
      <div className="text-[15px] leading-normal">
        <b className="font-semibold">{author.name}</b> <span className="text-ink-2">{author.bio}</span>
      </div>
    </div>
  );
}
