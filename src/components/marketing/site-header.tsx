"use client";

import Link from "next/link";
import { useState } from "react";

const navItems = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/who-its-for", label: "Who it's for" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="px-4 pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-3xl border bg-white px-4 py-3 shadow-[var(--card-shadow)] sm:px-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-[2rem] font-semibold leading-none tracking-[-0.03em]">
              BuilderOS
            </Link>

            <nav className="hidden items-center gap-8 text-[1.05rem] font-medium text-[var(--foreground)] lg:flex">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:opacity-70">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-5 lg:flex">
              <Link
                href="/request-access"
                className="text-[1.05rem] font-semibold text-[var(--foreground)] transition hover:opacity-70"
              >
                Sign in
              </Link>
              <Link
                href="/request-access"
                className="inline-flex items-center rounded-2xl bg-[#121316] px-6 py-3 text-[1.05rem] font-medium !text-white"
              >
                Get started
              </Link>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                aria-expanded={isMenuOpen}
                aria-label="Toggle navigation menu"
                onClick={() => setIsMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border text-xl text-[var(--foreground)]"
              >
                {isMenuOpen ? "×" : "☰"}
              </button>
            </div>
          </div>

          {isMenuOpen ? (
            <div className="mt-4 border-t pt-4 lg:hidden">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className="block rounded-lg px-3 py-2 text-base font-medium text-[var(--foreground)] transition hover:bg-[#f4f5f7]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-4 grid gap-2 border-t pt-4">
                <Link
                  href="/request-access"
                  onClick={closeMenu}
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
                >
                  Sign in
                </Link>
                <Link
                  href="/request-access"
                  onClick={closeMenu}
                  className="inline-flex items-center justify-center rounded-xl bg-[#121316] px-4 py-2.5 text-sm font-medium !text-white"
                >
                  Get started
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
