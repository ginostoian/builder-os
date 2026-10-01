import * as React from "react";
import { cn } from "@/lib/utils";

/** Single-select chip used for filters and form choices. Active = ink fill, inactive = white with a ring. */
function ToggleChip({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-[7px] font-medium transition-colors duration-[120ms]",
        active ? "bg-ink text-white" : "bg-white text-ink-3 shadow-ring-input hover:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleChip };
