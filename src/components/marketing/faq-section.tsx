"use client";

import Link from "next/link";
import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSectionProps = {
  title?: string;
  description?: string;
  items: FaqItem[];
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

export function FaqSection({
  title = "Frequently asked questions",
  description = "Answers to common questions before getting started.",
  items,
  primaryCta,
  secondaryCta,
  background = "default",
}: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className={background === "muted" ? "border-y bg-[#fcfcfc]" : ""}>
      <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-5">
            <span className="section-label">FAQ</span>
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
          {items.map((item, index) => {
            const isOpen = index === openIndex;
            return (
              <article key={item.question} className="border-b">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left"
                >
                  <h3 className="text-[1.1rem] leading-snug tracking-[-0.01em] text-[var(--foreground)]">{item.question}</h3>
                  <span className="text-xl leading-none text-[var(--muted-foreground)]">{isOpen ? "−" : "+"}</span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[80ch] pb-5 text-[1rem] leading-[1.65] text-[var(--muted-foreground)]">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
