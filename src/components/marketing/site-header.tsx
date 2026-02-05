import Link from "next/link";

const navItems = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/who-its-for", label: "Who it's for" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="px-4 pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center justify-between rounded-3xl border bg-white px-4 py-3 shadow-[var(--card-shadow)] sm:px-6">
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
            <Link
              href="/request-access"
              className="inline-flex items-center rounded-xl bg-[#121316] px-4 py-2 text-sm font-medium !text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
