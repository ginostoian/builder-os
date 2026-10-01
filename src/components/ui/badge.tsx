import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Status pill: fully rounded, soft fill + strong text from the same hue. Always a word, never colour alone. */
const badgeVariants = cva("inline-flex items-center whitespace-nowrap font-medium", {
  variants: {
    tone: {
      grey: "bg-line text-ink-2",
      green: "bg-success-soft text-success",
      amber: "bg-warning-soft text-warning",
      red: "bg-danger-soft text-danger",
      blue: "bg-info-soft text-info",
      brand: "bg-brand-soft text-brand-ink",
      muted: "bg-muted text-ink-2",
      ink: "bg-ink text-white",
    },
    shape: {
      pill: "rounded-full px-2 py-0.5 text-[11.5px]",
      tag: "rounded-[5px] px-[7px] py-px text-[11px]",
    },
  },
  defaultVariants: { tone: "grey", shape: "pill" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

function Badge({ className, tone, shape, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone, shape }), className)} {...props} />;
}

export { Badge, badgeVariants };
