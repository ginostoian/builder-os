"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type SearchEntry = { slug: string; title: string; summary: string; category: string; text: string };

/** Search every article as you type: title and summary matches first, then anything mentioned in the text. */
export function HelpSearch({ entries }: { entries: SearchEntry[] }) {
  const [q, setQ] = React.useState("");
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const results = words.length
    ? entries
        .map((e) => {
          const head = `${e.title} ${e.summary}`.toLowerCase();
          if (!words.every((w) => e.text.includes(w))) return null;
          return { e, score: words.filter((w) => head.includes(w)).length * 10 + (e.title.toLowerCase().includes(q.toLowerCase()) ? 20 : 0) };
        })
        .filter((r): r is { e: SearchEntry; score: number } => r !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
    : [];
  return (
    <div className="relative mx-auto w-full max-w-[600px]">
      <label className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-ring focus-within:shadow-[0_0_0_2px_var(--color-ink)]">
        <Search className="size-5 flex-none text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the help centre, e.g. stage payments"
          aria-label="Search the help centre"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-subtle"
        />
      </label>
      {words.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl bg-white text-left shadow-pop">
          {results.length === 0 ? (
            <p className="px-5 py-4 text-ink-2">Nothing matches &ldquo;{q}&rdquo;. Try a different word, or browse the topics below.</p>
          ) : (
            <ul className="py-1.5">
              {results.map(({ e }) => (
                <li key={e.slug}>
                  <Link href={`/help/${e.slug}`} className="block px-5 py-2.5 hover:bg-surface">
                    <span className="block font-medium text-ink">{e.title}</span>
                    <span className="block text-[13.5px] text-ink-2">
                      <span className="text-subtle">{e.category} · </span>
                      {e.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
