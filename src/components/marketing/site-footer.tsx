import Link from "next/link";
import { Logo } from "@/components/brand";
import { siteLinks } from "./links";

const cols = [
  {
    title: "Product",
    links: [
      ["Quoting", "/features#quoting"],
      ["Variations", "/features#variations"],
      ["Client portal", "/features#portal"],
      ["Payments & invoicing", "/features#payments"],
      ["Projects", "/features#projects"],
      ["Team app", "/features#team"],
      ["CRM & reporting", "/features#crm"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", siteLinks.about],
      ["Customers", siteLinks.customers],
      ["Blog", siteLinks.blog],
      ["Contact", siteLinks.contact],
    ],
  },
  {
    title: "Get started",
    links: [
      ["Pricing", siteLinks.pricing],
      ["Book a demo", siteLinks.demo],
      ["Sign in", siteLinks.signIn],
      ["Help centre", "#"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-surface text-ink">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-6 pt-16 pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-10">
          <div className="flex min-w-[220px] flex-col gap-3.5">
            <Logo />
            <p className="max-w-[260px] text-sm leading-[1.55] text-ink-2">
              The operating system for UK renovation companies. Quote it, build it, get paid.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title} className="flex flex-col gap-2.5">
              <div className="mb-1 text-[13px] font-medium text-subtle">{c.title}</div>
              {c.links.map(([label, href]) => (
                <Link key={label} href={href} className="text-sm text-ink-3 hover:text-ink-2">
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6 text-[13px] text-subtle">
          <span>© 2026 Builder OS Ltd · Registered in England &amp; Wales</span>
          <div className="flex gap-5">
            {["Privacy", "Terms", "Cookies", "Status"].map((l) => (
              <Link key={l} href="#" className="text-subtle hover:text-ink-2">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
