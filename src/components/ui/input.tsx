import * as React from "react";
import { cn } from "@/lib/utils";

/** Marketing form field: 42px, ring instead of border, Surface fill. */
function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-[10px] bg-surface px-3 text-[15px] text-ink shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
