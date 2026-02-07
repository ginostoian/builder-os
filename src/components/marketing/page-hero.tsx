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
      <div className="border bg-white p-6 sm:p-8 lg:p-10">
        <div className={`grid gap-10 ${visual ? "lg:grid-cols-[1fr_1.05fr] lg:items-center" : ""}`}>
          <div className="space-y-6">
            <span className="section-label">{label}</span>
            <h1 className="max-w-[18ch]">{title}</h1>
            <p className="max-w-[50ch]">{description}</p>
            <div className="flex flex-col gap-2 sm:max-w-sm sm:flex-row sm:items-center">
              <Link
                href={primaryAction.href}
                className="btn-primary"
              >
                {primaryAction.label}
              </Link>
              {secondaryAction ? (
                <Link
                  href={secondaryAction.href}
                  className="btn-secondary"
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
