import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The mark: three courses of brickwork in a rounded square: a full course, a stretcher
 * bond with an offset joint, and a single orange course at the base (Design Guidelines §01).
 */
const markSizes = {
  sm: { box: 26, radius: 7, pad: 5.5, bar: 3, gap: 2, barRadius: 1 },
  md: { box: 28, radius: 8, pad: 6, bar: 3, gap: 2, barRadius: 1 },
  xl: { box: 56, radius: 15, pad: 12, bar: 6.5, gap: 4.5, barRadius: 2 },
} as const;

export function LogoMark({ size = "sm", inverse = false, className }: { size?: keyof typeof markSizes; inverse?: boolean; className?: string }) {
  const s = markSizes[size];
  const tile = inverse ? "#FFFFFF" : "#111110";
  const course = inverse ? "#111110" : "#FFFFFF";
  const bar = { height: s.bar, background: course, borderRadius: s.barRadius };
  return (
    <span
      aria-hidden
      className={cn("flex flex-none flex-col justify-center", className)}
      style={{ width: s.box, height: s.box, borderRadius: s.radius, background: tile, gap: s.gap, padding: `0 ${s.pad}px` }}
    >
      <span style={bar} />
      <span className="flex" style={{ gap: s.gap }}>
        <span className="flex-1" style={bar} />
        <span className="flex-[2]" style={bar} />
      </span>
      <span style={{ ...bar, background: "var(--brand)" }} />
    </span>
  );
}

export function Logo({
  size = "sm",
  inverse = false,
  className,
  textClassName,
}: {
  size?: keyof typeof markSizes;
  inverse?: boolean;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-[9px]", size === "xl" && "gap-3.5", className)}>
      <LogoMark size={size} inverse={inverse} />
      <span
        className={cn(
          "font-semibold tracking-[-0.025em]",
          size === "xl" ? "text-[34px] tracking-[-0.03em]" : "text-[17px]",
          inverse ? "text-white" : "text-ink",
          textClassName,
        )}
      >
        Builder<span className="font-medium text-subtle"> OS</span>
      </span>
    </span>
  );
}

export function Avatar({
  initials,
  tint = "#E6E1D8",
  size = 28,
  className,
  rounded = "full",
}: {
  initials: string;
  tint?: string;
  size?: number;
  className?: string;
  rounded?: "full" | "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center text-[11px] font-semibold text-ink-2",
        rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-lg" : "rounded-[10px]",
        className,
      )}
      style={{ width: size, height: size, background: tint }}
    >
      {initials}
    </span>
  );
}

/** Photo placeholder: the 135° stripe with a mono caption describing the shot. */
export function Placeholder({
  label,
  className,
  variant = "md",
  ...props
}: React.ComponentProps<"div"> & { label: string; variant?: "md" | "sm" | "xs" | "night" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-center font-mono text-xs text-subtle",
        variant === "md" && "stripes",
        variant === "sm" && "stripes-sm",
        variant === "xs" && "stripes-xs",
        variant === "night" && "stripes-night",
        className,
      )}
      {...props}
    >
      {label}
    </div>
  );
}

/** Mono eyebrow above section headings: "01 — Quoting". */
export function Eyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-mono text-[12.5px] text-subtle", className)} {...props} />;
}
