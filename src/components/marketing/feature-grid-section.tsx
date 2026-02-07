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
    <section
      className={`${background === "muted" ? "border-y bg-[#fafafa]" : ""}`}
    >
      <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-4">
            <span className="section-label">{label}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {primaryCta || secondaryCta ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {primaryCta ? (
                <Link
                  href={primaryCta.href}
                  className="inline-flex items-center rounded-xl bg-[#121316] px-5 py-3 text-base font-medium !text-white"
                >
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="inline-flex items-center rounded-xl border bg-white px-5 py-3 text-base font-medium text-[var(--foreground)]"
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.title} className="panel-card">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] text-[var(--foreground)]">
                  ✓
                </span>
                <h3 className="text-[var(--foreground)]">{item.title}</h3>
              </div>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
