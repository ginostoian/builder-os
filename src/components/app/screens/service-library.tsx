"use client";

import * as React from "react";
import { Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serviceCategories, serviceCategoryCounts, services } from "@/lib/demo-data";
import { formatGBP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ScreenTitle } from "../app-shell";

const kinds = ["All", "Services", "Bundles"] as const;

export function ServiceLibraryScreen() {
  const [category, setCategory] = React.useState("All services");
  const [kind, setKind] = React.useState<(typeof kinds)[number]>("All");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState("s2");

  const q = query.trim().toLowerCase();
  const visible = services.filter(
    (s) =>
      (category === "All services" || s.category === category) &&
      (kind === "All" || (kind === "Bundles") === (s.kind === "bundle")) &&
      (!q || `${s.name} ${s.description}`.toLowerCase().includes(q)),
  );

  return (
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Categories" className="flex w-[200px] flex-none flex-col gap-px border-r border-hairline px-2.5 py-[18px]">
        <div className="px-2.5 pb-2 text-[11px] font-medium text-subtle">Categories</div>
        {["All services", ...serviceCategories].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
            className={cn(
              "flex justify-between rounded-[7px] px-2.5 py-[7px] text-left transition-colors duration-[120ms]",
              c === category ? "bg-line font-medium" : "hover:bg-surface",
            )}
          >
            <span>{c}</span>
            <span className="text-subtle tabular">{serviceCategoryCounts[c]}</span>
          </button>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-5">
        <ScreenTitle title="Service library" subtitle="142 priced services and 12 bundles. Drop any into a quote and adjust.">
          <Button variant="secondary">
            <Upload className="text-ink-2" />
            Import CSV
          </Button>
          <Button>
            <Plus />
            New service
          </Button>
        </ScreenTitle>
        <div className="flex items-center gap-2">
          <label className="flex h-[34px] max-w-[360px] flex-1 items-center gap-2 rounded-md bg-white px-2.5 text-subtle shadow-ring">
            <Search className="size-3.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search services, e.g. "skim"'
              className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-subtle"
            />
          </label>
          <div className="flex gap-1.5">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === kind}
                onClick={() => setKind(k)}
                className={cn("flex h-[34px] items-center rounded-md px-3", k === kind ? "bg-ink text-white" : "bg-white shadow-ring hover:bg-surface")}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-subtle">Sorted by most used</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              aria-pressed={s.id === selected}
              className={cn(
                "flex flex-col gap-2.5 rounded-xl bg-white px-4 py-3.5 text-left transition-shadow duration-[120ms]",
                s.id === selected ? "shadow-[0_0_0_1.5px_#111110,0_8px_20px_-10px_rgb(16_16_15/0.2)]" : "shadow-card-soft hover:shadow-pop",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-ink-2">{s.category}</span>
                <span className="text-[11.5px] text-subtle">{s.kind === "bundle" ? `Bundle · ${s.bundleCount} items` : "Service"}</span>
              </div>
              <div>
                <div className="font-semibold tracking-[-0.01em]">{s.name}</div>
                <div className="mt-[3px] text-xs leading-[1.45] text-subtle">{s.description}</div>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                <span>
                  <span className="text-[17px] font-semibold tabular">{formatGBP(s.rate, s.rate % 100 === 0 && s.rate >= 10000 ? 0 : 2)}</span>
                  <span className="text-xs text-subtle"> / {s.unit}</span>
                </span>
                <span className="text-xs text-subtle">Used in {s.usedIn} quotes</span>
              </div>
            </button>
          ))}
          {visible.length === 0 && (
            <div className="col-span-3 flex flex-col items-center gap-2.5 rounded-xl bg-white py-12 shadow-ring">
              <div className="font-medium">No services match that yet.</div>
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setKind("All");
                  setCategory("All services");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
