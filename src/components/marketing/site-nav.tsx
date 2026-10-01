"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteLinks } from "./links";

const links = [
  { label: "Features", href: siteLinks.features },
  { label: "Pricing", href: siteLinks.pricing },
  { label: "Customers", href: siteLinks.customers },
  { label: "Blog", href: siteLinks.blog },
  { label: "About", href: siteLinks.about },
];

export function SiteNav() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-50 border-b border-ink/[0.06] bg-surface/[0.82] backdrop-blur-[14px] backdrop-saturate-[1.6]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-7 px-6">
        <Link href={siteLinks.home} className="flex-none text-ink hover:text-ink" aria-label="Builder OS home">
          <Logo />
        </Link>
        <nav className="hidden flex-1 gap-1 min-[900px]:flex" aria-label="Main">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-[11px] py-[7px] text-sm font-medium transition-colors duration-[120ms]",
                  active ? "bg-ink/5 text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 min-[900px]:flex">
          <Link href={siteLinks.signIn} className="px-[11px] py-[7px] text-sm font-medium text-ink-2 hover:text-ink">
            Sign in
          </Link>
          <Button asChild variant="outline" size="nav" className="shadow-[0_0_0_1px_#E2E1DC,0_1px_2px_rgb(16_16_15/0.05)]">
            <Link href={siteLinks.demo}>Book a demo</Link>
          </Button>
          <Button asChild size="nav" className="shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:text-white">
            <Link href={siteLinks.pricing}>Start free</Link>
          </Button>
        </div>
        <div className="flex flex-1 justify-end gap-2 min-[900px]:hidden">
          <Button asChild size="nav" className="hover:text-white">
            <Link href={siteLinks.pricing}>Start free</Link>
          </Button>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpenOn(open ? null : pathname)}
            className="flex size-[38px] flex-col items-center justify-center gap-1 rounded-[10px] bg-white shadow-ring-input"
          >
            <span className="h-[1.5px] w-4 bg-ink" />
            <span className="h-[1.5px] w-4 bg-ink" />
          </button>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-0.5 border-t border-hairline bg-surface px-6 pt-3 pb-5 min-[900px]:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="border-b border-line px-1 py-3 text-base font-medium text-ink">
              {l.label}
            </Link>
          ))}
          <Button asChild variant="outline" className="mt-3 h-11 rounded-[10px] text-[15px]">
            <Link href={siteLinks.demo}>Book a demo</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
