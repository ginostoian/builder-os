"use client";

import { useEffect, useRef, useState } from "react";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We now send cleaner quotes, and clients understand what is included before work starts.",
    name: "Liam Carter",
    role: "Director",
    company: "Northline Renovations",
  },
  {
    quote:
      "Acceptance is much clearer. We are not chasing old email threads to confirm decisions.",
    name: "Sophie Patel",
    role: "Operations Lead",
    company: "Oak & Stone Build",
  },
  {
    quote:
      "Variation approvals are finally structured. It is obvious what changed and when it was signed.",
    name: "Daniel Murray",
    role: "Project Manager",
    company: "Murray Design & Build",
  },
  {
    quote:
      "Our team quotes faster with fewer mistakes because the format is consistent across projects.",
    name: "Hannah Reid",
    role: "Commercial Manager",
    company: "Elm Renovation Co.",
  },
  {
    quote:
      "Clients like the summary-first view. They can review quickly and still open the detail when needed.",
    name: "George Walton",
    role: "Founder",
    company: "Walton Living Spaces",
  },
  {
    quote:
      "Once a quote is accepted, scope is locked. That has improved conversations on site.",
    name: "Maya Collins",
    role: "Contracts Manager",
    company: "Foundry Refurbishments",
  },
  {
    quote:
      "BuilderOS gives us a better paper trail without adding unnecessary steps for the team.",
    name: "Ethan Brooks",
    role: "General Manager",
    company: "Brooks & Finch Build",
  },
];

export function TestimonialsSection() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let raf = 0;
    let previous = performance.now();
    const speedPxPerMs = 0.03;

    const tick = (now: number) => {
      const elapsed = now - previous;
      previous = now;

      if (!isPaused) {
        scroller.scrollLeft += elapsed * speedPxPerMs;
        if (scroller.scrollLeft >= scroller.scrollWidth / 2) {
          scroller.scrollLeft = 0;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPaused]);

  const looped = [...testimonials, ...testimonials];

  return (
    <section className="border-y bg-[#fafafa]">
      <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="section-head space-y-4">
          <span className="section-label">Testimonials</span>
          <h2>What teams say after moving off ad-hoc quoting</h2>
          <p className="max-w-[54ch]">
            A few examples from renovation businesses using a more structured quote and variation
            process.
          </p>
        </div>

        <div
          ref={scrollerRef}
          className="hide-scrollbar overflow-x-auto scroll-smooth pb-2"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div className="flex w-max gap-5">
            {looped.map((item, index) => (
              <article
                key={`${item.name}-${index}`}
                className="panel-card w-[min(78vw,440px)] shrink-0 snap-start"
              >
                <p className="text-[1.28rem] font-semibold leading-[1.35] tracking-[-0.01em] text-[var(--foreground)]">
                  “{item.quote}”
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-[#f3f4f6] text-sm font-semibold text-[var(--foreground)]">
                    {item.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {item.role}, {item.company}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
