"use client";

import * as React from "react";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { Avatar, Eyebrow, Placeholder } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { blogCategories, featuredPost, posts } from "@/lib/content/blog";
import { cn } from "@/lib/utils";
import { siteLinks } from "./links";
import { Container, H1, H2 } from "./pieces";

const categories = ["All", ...blogCategories] as const;

/** Counts include the featured article, which sits outside the grid. */
function countFor(cat: (typeof categories)[number]) {
  const all = [...posts, featuredPost];
  return cat === "All" ? all.length : all.filter((p) => p.category === cat).length;
}

export function BlogIndex() {
  const [category, setCategory] = React.useState<(typeof categories)[number]>("All");
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const filtering = category !== "All" || q.length > 0;
  const visible = posts.filter(
    (p) => (category === "All" || p.category === category) && (!q || `${p.title} ${p.excerpt}`.toLowerCase().includes(q)),
  );
  const heading = filtering ? (category === "All" ? "Search results" : category) : "Latest";

  return (
    <>
      <section className="px-6 pt-20">
        <Container className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[640px] flex-col gap-4">
            <Eyebrow>Blog</Eyebrow>
            <H1 className="text-[clamp(40px,5.4vw,60px)]">Notes from the site office.</H1>
            <p className="text-[17px] leading-[1.55] text-ink-2">
              Practical guides on pricing, cash flow and running a renovation firm — plus what&apos;s new in Builder OS.
            </p>
          </div>
          <label className="flex h-[42px] w-[300px] max-w-full items-center gap-2 rounded-xl bg-white px-3.5 shadow-ring-input focus-within:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]">
            <Search className="size-[15px] text-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles"
              aria-label="Search articles"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle focus-visible:shadow-none focus-visible:outline-none"
            />
          </label>
        </Container>
      </section>

      <section className="px-6 pt-9">
        <Container className="flex flex-wrap gap-1.5 border-b border-hairline pb-6" role="group" aria-label="Filter by category">
          {categories.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c)}
                className={cn(
                  "flex h-[34px] items-center gap-[7px] rounded-full px-3.5 text-sm font-medium transition-colors duration-[120ms]",
                  active ? "bg-ink text-white" : "bg-white text-ink-3 shadow-ring-input hover:bg-surface",
                )}
              >
                {c}
                <span className="text-xs opacity-60">{countFor(c)}</span>
              </button>
            );
          })}
        </Container>
      </section>

      {!filtering && (
        <section className="px-6 pt-10">
          <Link
            href={siteLinks.article}
            className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-x-12 gap-y-8 text-ink hover:text-ink"
          >
            <Placeholder label={featuredPost.image} className="aspect-[16/10] rounded-[20px] shadow-ring" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5 text-[13px] text-subtle">
                <span className="rounded-full bg-ink px-2.5 py-[3px] font-medium text-white">Featured</span>
                {featuredPost.category} · {featuredPost.read}
              </div>
              <H2 className="text-[clamp(28px,3.2vw,40px)] leading-[1.08]">{featuredPost.title}</H2>
              <p className="text-[16.5px] leading-[1.6] text-ink-2">{featuredPost.excerpt}</p>
              <div className="mt-1 flex items-center gap-2.5">
                <Avatar initials={featuredPost.authorInitials} size={32} className="text-xs" />
                <span className="text-sm">
                  <b className="font-medium">{featuredPost.author}</b>
                  <span className="text-subtle"> · {featuredPost.date}</span>
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      <section className="px-6 pt-14">
        <Container>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{heading}</h2>
            <span className="text-sm text-subtle" aria-live="polite">
              {visible.length} {visible.length === 1 ? "article" : "articles"}
            </span>
          </div>
          {visible.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-x-5 gap-y-9">
              {visible.map((p) => (
                <Link key={p.title} href={siteLinks.article} className="group flex flex-col gap-3.5 text-ink hover:text-ink">
                  <Placeholder label={p.image} variant="sm" className="aspect-[16/10] rounded-2xl text-[11.5px] shadow-ring" />
                  <div className="flex items-center gap-2 text-[13px] text-subtle">
                    <span className="font-medium text-ink-3">{p.category}</span>·<span>{p.read}</span>
                  </div>
                  <h3 className="text-[19px] leading-[1.25] font-semibold tracking-[-0.02em] text-pretty group-hover:text-ink-2">{p.title}</h3>
                  <p className="text-[15px] leading-[1.55] text-ink-2">{p.excerpt}</p>
                  <div className="text-[13.5px] text-subtle">
                    {p.author} · {p.date}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 rounded-[18px] bg-white px-6 py-16 text-center shadow-ring">
              <SearchX className="size-[22px] text-subtle" />
              <div className="font-semibold">Nothing matches that yet</div>
              <Button
                size="nav"
                onClick={() => {
                  setCategory("All");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
