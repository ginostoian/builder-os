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
  primaryLabel = "Get started",
  secondaryHref = "/product",
  secondaryLabel = "View product",
}: FinalCtaSectionProps) {
  return (
    <section className="border-t bg-[#f4f5f7]">
      <div className="mx-auto w-full max-w-7xl px-4 py-[var(--spacing-section-y)] sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border bg-white p-8 shadow-[var(--card-shadow)] sm:p-12">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(17,24,39,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(17,24,39,0.04) 1px, transparent 1px)",
              backgroundSize: "140px 140px",
            }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <h2 className="text-[clamp(2.2rem,5vw,4.4rem)] leading-[1.06] tracking-[-0.03em] text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mx-auto mt-5 max-w-[58ch] text-[1.35rem] leading-[1.45] text-[var(--muted-foreground)]">
              {description}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex items-center rounded-2xl bg-[#121316] px-7 py-3.5 text-xl font-medium !text-white"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex items-center rounded-2xl border bg-white px-7 py-3.5 text-xl font-medium text-[var(--foreground)]"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
