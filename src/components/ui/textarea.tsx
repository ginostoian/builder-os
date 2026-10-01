import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[120px] w-full resize-y rounded-[10px] bg-surface p-3 text-[15px] leading-normal text-ink shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
