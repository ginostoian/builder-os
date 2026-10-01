import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * One primary action per view (Design Guidelines §05). Primary is ink, never orange.
 * Sizes: `app` 32px for the dense app, `nav` 36px, `lg` 46px for marketing.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,opacity] duration-[120ms] ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-ink/90",
        secondary: "bg-white text-ink shadow-ring hover:bg-surface",
        outline: "bg-white text-ink shadow-ring-input hover:bg-surface",
        ghost: "text-ink-2 hover:bg-accent hover:text-ink",
        destructive: "bg-danger-soft text-danger hover:bg-danger-soft/80",
        inverse: "bg-white text-ink hover:bg-white/90",
        night: "bg-night-well text-white shadow-[inset_0_0_0_1px_var(--color-night-ring)] hover:bg-night-line",
      },
      size: {
        app: "h-8 rounded-md px-3 text-[13px] [&_svg]:size-3.5",
        nav: "h-9 rounded-[10px] px-3.5 text-sm",
        md: "h-11 rounded-xl px-[18px] text-[15px] [&_svg]:size-[15px]",
        lg: "h-[46px] rounded-xl px-5 text-[15px] gap-2 [&_svg]:size-[15px]",
        icon: "size-8 rounded-md [&_svg]:size-4",
      },
      cta: {
        true: "shadow-cta",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "app", cta: false },
  },
);

function Button({
  className,
  variant,
  size,
  cta,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, cta, className }))} {...props} />;
}

export { Button, buttonVariants };
