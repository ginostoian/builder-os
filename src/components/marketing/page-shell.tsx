type PageShellProps = {
  title: string;
  description: string;
};

export function PageShell({ title, description }: PageShellProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
      <div className="max-w-2xl space-y-[var(--spacing-stack-md)]">
        <h1 className="text-[var(--foreground)]">{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
