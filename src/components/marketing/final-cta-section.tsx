import Link from "next/link";

type FinalCtaSectionProps = {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function FinalCtaSection({
  title,
  description,
  primaryHref = "/request-access",
  primaryLabel = "Request access",
  secondaryHref = "/product",
  secondaryLabel = "Join beta",
}: FinalCtaSectionProps) {
  return (
    <section className="border-t bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-[var(--spacing-section-y)] sm:px-6">
        <div className="border bg-white p-8 sm:p-10">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-[clamp(1.9rem,3.8vw,3rem)] leading-[1.12] tracking-[-0.02em] text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-[58ch] text-[1.06rem] leading-[1.65] text-[var(--muted-foreground)]">
              {description}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link href={primaryHref} className="btn-primary">
                {primaryLabel}
              </Link>
              <Link href={secondaryHref} className="btn-secondary">
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
