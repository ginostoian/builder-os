import Link from "next/link";

type FeatureItem = {
  title: string;
  description: string;
};

type FeatureGridSectionProps = {
  label: string;
  title: string;
  description: string;
  items: FeatureItem[];
  primaryCta?: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
  background?: "default" | "muted";
};

export function FeatureGridSection({
  label,
  title,
  description,
  items,
  primaryCta,
  secondaryCta,
  background = "default",
}: FeatureGridSectionProps) {
  return (
    <section className={`${background === "muted" ? "border-y bg-[#fcfcfc]" : ""}`}>
      <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-5">
            <span className="section-label">{label}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {primaryCta || secondaryCta ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              {primaryCta ? (
                <Link href={primaryCta.href} className="btn-primary">
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link href={secondaryCta.href} className="btn-secondary">
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-12 border-t">
          {items.map((item) => (
            <article
              key={item.title}
              className="grid gap-3 border-b py-6 md:grid-cols-[minmax(0,280px)_1fr] md:items-start md:gap-8"
            >
              <h3 className="text-[var(--foreground)]">{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
