type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We now send clearer quotes, and clients understand what is included before work starts.",
    name: "Liam Carter",
    role: "Director",
    company: "Northline Renovations",
  },
  {
    quote:
      "Acceptance is easier to verify. We are not searching old email chains to confirm decisions.",
    name: "Sophie Patel",
    role: "Operations Lead",
    company: "Oak & Stone Build",
  },
  {
    quote:
      "Variation approvals are now structured. It is clear what changed and when it was signed.",
    name: "Daniel Murray",
    role: "Project Manager",
    company: "Murray Design & Build",
  },
];

export function TestimonialsSection() {
  return (
    <section className="border-y bg-[#fcfcfc]">
      <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="section-head space-y-5">
          <span className="section-label">Field notes</span>
          <h2>Examples from teams running the same workflow</h2>
          <p className="max-w-[56ch]">
            Short comments from renovation businesses using structured quotes, acceptance, and variations.
          </p>
        </div>
        <div className="mt-10 border-t">
          {testimonials.map((item) => (
            <article key={item.name} className="grid gap-3 border-b py-6 md:grid-cols-[1fr_auto] md:items-start md:gap-8">
              <p className="text-[1.05rem] leading-[1.6] text-[var(--foreground)]">&quot;{item.quote}&quot;</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {item.name}
                <br />
                {item.role}, {item.company}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
