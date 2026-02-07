import Link from "next/link";

const productLinks = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/who-its-for", label: "Who it's for" },
  { href: "/request-access", label: "Request access" },
];

const legalLinks = [
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy" },
];

const supportLinks = [
  { href: "/request-access", label: "Talk to us" },
  { href: "/request-access", label: "Request access" },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="border bg-white p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr]">
            <div className="space-y-5">
              <Link href="/" className="inline-block text-[1.5rem] font-semibold leading-none tracking-[-0.02em]">
                BuilderOS
              </Link>
              <p className="max-w-[34ch] text-sm text-[var(--muted-foreground)]">
                Commercial workflow software for UK renovation teams managing quotes, acceptance, and
                approved variations.
              </p>
            </div>

            <FooterColumn title="Product" links={productLinks} />
            <FooterColumn title="Company" links={companyLinks} />
            <FooterColumn title="Legal" links={legalLinks} />
            <FooterColumn title="Support" links={supportLinks} />
          </div>

          <div className="mt-10 border-t pt-5 text-xs text-[var(--muted-foreground)]">
            © {new Date().getFullYear()} BuilderOS. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={`${title}-${link.href}-${link.label}`}>
            <Link href={link.href} className="text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
