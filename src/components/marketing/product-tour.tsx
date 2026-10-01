"use client";

import * as React from "react";
import { ChartColumn, Contact, FileSpreadsheet, Globe, Library, Receipt, SquareKanban } from "lucide-react";
import { Screenshot } from "@/components/app/screenshot";
import type { ScreenId } from "@/components/app/routes";
import { cn } from "@/lib/utils";

const tabs: { label: string; icon: typeof Globe; screen: ScreenId; url: string; caption: string }[] = [
  { label: "Quote builder", icon: FileSpreadsheet, screen: "quote", url: "app.builderos.co.uk/quotes/Q-1042", caption: "Sections, formulas, per-line markup and notes — with your margin always in view." },
  { label: "Service library", icon: Library, screen: "templates", url: "app.builderos.co.uk/library", caption: "Your rates and bundles, ready to drop into any quote." },
  { label: "Client quote", icon: Globe, screen: "client", url: "builderos.app/q/hale-sons/1042", caption: "What your client sees: a clear, branded quote they can sign on their phone." },
  { label: "Projects", icon: SquareKanban, screen: "board", url: "app.builderos.co.uk/projects/elm-road", caption: "Every job on a board your whole team can see, from site to office." },
  { label: "Payments", icon: Receipt, screen: "invoices", url: "app.builderos.co.uk/payments", caption: "Stage payments that invoice themselves — variations included." },
  { label: "CRM", icon: Contact, screen: "crm", url: "app.builderos.co.uk/clients", caption: "Every enquiry tracked from first call to signed contract." },
  { label: "Reporting", icon: ChartColumn, screen: "dashboard", url: "app.builderos.co.uk", caption: "Pipeline, cash and margin at a glance, every morning." },
];

/** Home §02: segmented tabs that switch the product screenshot. */
export function ProductTour() {
  const [active, setActive] = React.useState(0);
  const tab = tabs[active];
  return (
    <>
      <div role="tablist" aria-label="Product screens" className="mt-9 mb-5 flex w-fit max-w-full flex-wrap gap-1.5 rounded-[14px] bg-line p-[5px]">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "flex h-9 items-center gap-[7px] rounded-[10px] px-3.5 text-sm font-medium transition-colors duration-[120ms]",
              i === active ? "bg-white text-ink shadow-[0_1px_2px_rgb(16_16_15/0.08),0_0_0_1px_rgb(16_16_15/0.04)]" : "text-ink-2 hover:text-ink",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>
      <Screenshot key={tab.screen} screen={tab.screen} url={tab.url} />
      <p className="mt-[18px] text-center text-[15px] text-ink-2">{tab.caption}</p>
    </>
  );
}
