"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EmbeddedScreen } from "./app-screen";
import type { ScreenId } from "./routes";

const screenNames: Record<ScreenId, string> = {
  dashboard: "the reporting dashboard",
  quote: "the quote builder",
  templates: "the service library",
  board: "a project board",
  invoices: "payments and invoicing",
  crm: "the CRM pipeline",
  client: "the client quote page",
  mobile: "the employee app",
};

/**
 * A real app screen rendered at its native size (default 1280×800) and scaled to fit,
 * optionally framed in browser chrome. Product shots are always real screens, never fake UI.
 */
export function Screenshot({
  screen,
  url = "app.builderos.co.uk",
  chrome = true,
  baseWidth = 1280,
  baseHeight = 800,
  className,
}: {
  screen: ScreenId;
  url?: string;
  chrome?: boolean;
  baseWidth?: number;
  baseHeight?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / baseWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div
      role="img"
      aria-label={`Screenshot of ${screenNames[screen]} in Builder OS`}
      className={cn("w-full overflow-hidden bg-white", chrome && "rounded-[14px] shadow-shot", className)}
    >
      {chrome && (
        <div className="flex h-9 items-center gap-3 border-b border-border bg-muted px-3.5" aria-hidden>
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-pebble" />
            <span className="size-2.5 rounded-full bg-pebble" />
            <span className="size-2.5 rounded-full bg-pebble" />
          </div>
          <div className="flex flex-1 justify-center">
            <div className="flex h-[22px] max-w-[60%] items-center overflow-hidden rounded-md bg-white px-3.5 font-mono text-[11px] font-medium whitespace-nowrap text-subtle shadow-ring">
              {url}
            </div>
          </div>
          <div className="w-[42px]" />
        </div>
      )}
      <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: `${baseWidth} / ${baseHeight}` }}>
        <div
          inert
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 origin-top-left select-none"
          style={{
            width: baseWidth,
            height: baseHeight,
            transform: `scale(${scale ?? 1})`,
            opacity: scale === null ? 0 : 1,
          }}
        >
          <EmbeddedScreen screen={screen} />
        </div>
      </div>
    </div>
  );
}
