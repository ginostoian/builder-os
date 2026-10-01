import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteLinks } from "./links";

/** Outer section wrapper: 24px gutter, 1200px max width. */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto max-w-[1200px]", className)} {...props} />;
}

export function H1({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 className={cn("m-0 leading-none font-semibold tracking-[-0.045em] text-balance", className)} {...props} />;
}

export function H2({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("m-0 font-semibold tracking-[-0.035em] text-balance", className)} {...props} />;
}

/** Tick list item used across Features, Pricing, Book a demo and articles. */
export function CheckItem({ children, className, iconClassName }: { children: React.ReactNode; className?: string; iconClassName?: string }) {
  return (
    <div className={cn("flex gap-2.5 text-[15px] leading-[1.45] text-ink-4", className)}>
      <Check className={cn("mt-0.5 size-[15px] flex-none", iconClassName)} />
      <span>{children}</span>
    </div>
  );
}

/** Marketing primary CTA: ink fill, soft drop shadow, trailing arrow. */
export function PrimaryCta({ href, children, className, lifted = true }: { href: string; children: React.ReactNode; className?: string; lifted?: boolean }) {
  return (
    <Button asChild size="lg" cta={lifted} className={cn("hover:text-white", className)}>
      <Link href={href}>
        {children}
        <ArrowRight />
      </Link>
    </Button>
  );
}

export function SecondaryCta({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Button asChild variant="outline" size="lg" className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/** Text link with a trailing arrow ("Read customer stories →"). */
export function ArrowLink({ href, children, className, icon: Icon = ArrowRight }: { href: string; children: React.ReactNode; className?: string; icon?: typeof ArrowRight }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 text-[15px] font-medium text-ink hover:text-ink-2", className)}>
      {children}
      <Icon className="size-[15px]" />
    </Link>
  );
}

/** Closing dark band with a grid texture, used at the bottom of Home and Pricing. */
export function DarkCtaBand({
  title,
  body,
  primaryHref = siteLinks.pricing,
  grid = false,
  className,
  titleClassName,
}: {
  title: string;
  body: string;
  primaryHref?: string;
  grid?: boolean;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-night px-8 text-center text-white", className)}>
      {grid && (
        <div
          aria-hidden
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_100%,#000,transparent_70%)] bg-[linear-gradient(#1E1E1C_1px,transparent_1px),linear-gradient(90deg,#1E1E1C_1px,transparent_1px)] bg-[size:56px_56px]"
        />
      )}
      <div className="relative flex flex-col items-center gap-5">
        <H2 className={cn("text-[clamp(34px,5vw,60px)] leading-none tracking-[-0.045em]", titleClassName)}>{title}</H2>
        <p className="m-0 max-w-[520px] text-[17px] text-night-text">{body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2.5">
          <Button asChild variant="inverse" size="lg" className="hover:text-ink">
            <Link href={primaryHref}>
              Start free
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="night" size="lg" className="hover:text-white">
            <Link href={siteLinks.demo}>Book a demo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** White closing card with two CTAs (Features, Customers). */
export function LightCtaCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-[1200px] rounded-[28px] bg-white px-8 shadow-ring", className)}>{children}</div>;
}
