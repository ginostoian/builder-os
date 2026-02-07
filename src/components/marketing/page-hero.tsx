import Link from "next/link";
import type { ReactNode } from "react";

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type PageHeroProps = {
  label: string;
  title: string;
  description: string;
  primaryAction: HeroAction;
  secondaryAction?: HeroAction;
  note?: string;
  visual?: ReactNode;
};

export function PageHero({
  label,
  title,
  description,
  primaryAction,
  secondaryAction,
  note,
  visual,
}: PageHeroProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
      <div className="rounded-3xl border bg-white p-6 shadow-[var(--card-shadow)] sm:p-8 lg:p-10">
        <div className={`grid gap-8 ${visual ? "lg:grid-cols-[1fr_1.05fr] lg:items-center" : ""}`}>
          <div className="space-y-5">
            <span className="section-label">{label}</span>
            <h1 className="max-w-[14ch]">{title}</h1>
            <p className="max-w-[50ch]">{description}</p>
            <div className="flex flex-col gap-3 sm:max-w-sm">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center justify-center rounded-xl bg-[#121316] px-5 py-3 text-base font-medium !text-white"
              >
                {primaryAction.label}
              </Link>
              {secondaryAction ? (
                <Link
                  href={secondaryAction.href}
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-5 py-3 text-base font-medium text-[var(--foreground)]"
                >
                  {secondaryAction.label}
                </Link>
              ) : null}
            </div>
            {note ? <p className="text-sm text-[var(--muted-foreground)]">{note}</p> : null}
          </div>
          {visual ? <div className="hero-card">{visual}</div> : null}
        </div>
      </div>
    </section>
  );
}
