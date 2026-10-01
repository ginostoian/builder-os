"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** "On this page" list that tracks the heading currently in view. */
export function ArticleToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = React.useState(items[0]?.id);

  React.useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="flex flex-col gap-1">
      <div className="mb-2 font-mono text-[12.5px] text-subtle">On this page</div>
      {items.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          aria-current={t.id === active ? "location" : undefined}
          className={cn(
            "py-1.5 pl-3 text-sm leading-[1.4] transition-colors duration-[120ms]",
            t.id === active ? "text-ink shadow-[inset_2px_0_0_var(--color-ink)]" : "text-subtle shadow-[inset_1px_0_0_#E2E1DC] hover:text-ink-2",
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
