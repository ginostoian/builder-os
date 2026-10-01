"use client";

import { cn } from "@/lib/utils";

/** Underlined tab strip (quote tabs, project tabs). */
export function TabStrip({
  tabs,
  active,
  onSelect,
  className,
}: {
  tabs: { label: string; count?: number }[];
  active: string;
  onSelect?: (label: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex items-center gap-0.5", className)}>
      {tabs.map((t) => {
        const isActive = t.label === active;
        return (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect?.(t.label)}
            className={cn(
              "flex gap-1.5 px-2.5 py-[9px] font-medium transition-colors duration-[120ms]",
              isActive ? "text-ink shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-subtle hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="font-normal text-subtle">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
