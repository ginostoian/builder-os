"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar, Placeholder } from "@/components/brand";
import { cn } from "@/lib/utils";
import { siteLinks } from "./links";

const filters = ["All", "Extensions", "Bathrooms", "Kitchens", "Full renovations"] as const;

const stories = [
  { type: "Extensions", initials: "RC", co: "Reid & Co Build", meta: "Manchester · 22 people", title: "How Reid & Co stopped losing money on variations", stat: "£38k", statLabel: "variations recovered in year one", image: "rear extension, Didsbury", tint: "#DCE5DF" },
  { type: "Bathrooms", initials: "FI", co: "Fernbrook Interiors", meta: "Surrey · 9 people", title: "Better-looking quotes, higher prices, more wins", stat: "+13pts", statLabel: "quote win rate", image: "finished bathroom", tint: "#E9E3D6" },
  { type: "Full renovations", initials: "HS", co: "Hale & Sons", meta: "Bristol · 31 people", title: "Running seven sites from one board", stat: "7", statLabel: "live jobs, one weekly meeting", image: "Victorian terrace strip-out", tint: "#E6E1D8" },
  { type: "Kitchens", initials: "OK", co: "Oak & Kiln Kitchens", meta: "Edinburgh · 6 people", title: "From WhatsApp chaos to a client portal clients love", stat: "−70%", statLabel: "client “just checking” calls", image: "kitchen install", tint: "#E3E0EE" },
  { type: "Extensions", initials: "BW", co: "Brightwell Builders", meta: "Cardiff · 18 people", title: "Stage payments that turned up on time", stat: "9 days", statLabel: "average time to get paid", image: "site team at work", tint: "#E7EEF9" },
  { type: "Bathrooms", initials: "TW", co: "Tidewater Bathrooms", meta: "Brighton · 4 people", title: "A two-van firm that quotes like a big one", stat: "25 min", statLabel: "average time to build a quote", image: "wet room tiling", tint: "#FBF1DE" },
];

export function CustomerStories() {
  const [filter, setFilter] = React.useState<(typeof filters)[number]>("All");
  const visible = stories.filter((s) => filter === "All" || s.type === filter);
  return (
    <>
      <div className="mb-7 flex flex-wrap gap-1.5" role="group" aria-label="Filter by job type">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
            className={cn(
              "h-[34px] rounded-full px-3.5 text-sm font-medium transition-colors duration-[120ms]",
              f === filter ? "bg-ink text-white" : "bg-white text-ink-3 shadow-ring-input hover:bg-surface",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
        {visible.map((s) => (
          <Link key={s.co} href={siteLinks.article} className="flex flex-col overflow-hidden rounded-[18px] bg-white text-ink shadow-card-soft transition-shadow duration-[120ms] hover:text-ink hover:shadow-pop">
            <Placeholder label={s.image} variant="sm" className="aspect-video text-[11.5px]" />
            <div className="flex flex-1 flex-col gap-3 px-6 pt-[22px] pb-6">
              <div className="flex items-center gap-2.5">
                <Avatar initials={s.initials} tint={s.tint} size={32} rounded="md" className="text-[11.5px] text-ink-3" />
                <div>
                  <div className="text-[14.5px] font-semibold">{s.co}</div>
                  <div className="text-[13px] text-subtle">{s.meta}</div>
                </div>
              </div>
              <h3 className="text-lg leading-[1.3] font-semibold tracking-[-0.02em] text-pretty">{s.title}</h3>
              <div className="mt-auto flex items-baseline justify-between border-t border-line pt-3.5">
                <span className="text-[22px] font-semibold tracking-[-0.03em]">{s.stat}</span>
                <span className="text-right text-[13px] text-subtle">{s.statLabel}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
