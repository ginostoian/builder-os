import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { HelpSearch } from "@/components/help/help-search";
import { Container, H1 } from "@/components/marketing/pieces";
import { ARTICLES, CATEGORIES, articlesIn, categoryOf, searchText } from "@/lib/content/help";
import { LEGAL } from "@/lib/content/legal";
import { breadcrumbSchema, graph, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = pageMetadata({ title: "Help centre", description: "Friendly guides to everything in Builder OS: quotes, the client portal, invoices, projects, your team, job costs and winning more work.", path: "/help" });

export default function HelpPage() {
  const entries = ARTICLES.map((a) => ({ slug: a.slug, title: a.title, summary: a.summary, category: categoryOf(a.category).title, text: searchText(a) }));
  return (
    <>
      <JsonLd
        data={graph(
          webPageSchema({ path: "/help", name: "Builder OS help centre", description: "Guides to everything in Builder OS.", type: "CollectionPage" }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Help centre", path: "/help" },
          ]),
        )}
      />
      <section className="px-6 pt-[72px] pb-12 text-center">
        <Container className="flex flex-col items-center gap-4">
          <Eyebrow>Help centre</Eyebrow>
          <H1 className="text-[clamp(36px,5vw,56px)]">How can we help?</H1>
          <p className="max-w-[560px] text-[17px] leading-[1.6] text-ink-2">
            Plain-English guides to every part of Builder OS, from your first quote to getting paid. Search, or pick a topic below.
          </p>
          <div className="mt-3 w-full">
            <HelpSearch entries={entries} />
          </div>
        </Container>
      </section>
      <section className="px-6 pb-24">
        <Container className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-4">
          {CATEGORIES.map((c) => {
            const list = articlesIn(c.id);
            if (list.length === 0) return null;
            return (
              <div key={c.id} id={c.id} className="flex flex-col rounded-[20px] bg-white p-6 shadow-ring">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{c.title}</h2>
                <p className="mt-1 text-[14.5px] text-ink-2">{c.description}</p>
                <ul className="mt-4 flex flex-col">
                  {list.map((a) => (
                    <li key={a.slug} className="border-t border-line first:border-0">
                      <Link href={`/help/${a.slug}`} className="group flex items-center gap-2 py-2.5 text-[15px] text-ink-3 hover:text-ink">
                        <span className="flex-1">{a.title}</span>
                        <ArrowRight className="size-3.5 flex-none text-faint-2 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Container>
        <Container className="mt-10 flex max-w-[760px] flex-col items-center gap-2 rounded-[20px] bg-white px-6 py-8 text-center shadow-ring">
          <Mail className="size-5 text-subtle" />
          <h2 className="text-[19px] font-semibold">Can&apos;t find what you need?</h2>
          <p className="text-ink-2">
            Email us at{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="font-medium text-ink underline underline-offset-2">
              {LEGAL.supportEmail}
            </a>
            . A real person who knows building work will get back to you.
          </p>
        </Container>
      </section>
    </>
  );
}
