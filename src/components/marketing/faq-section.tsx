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
    <section className={background === "muted" ? "border-y bg-[#fafafa]" : ""}>
      <div className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-4">
            <span className="section-label">FAQ</span>
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

        <div className="mt-12">
          {items.map((item, index) => {
            const isOpen = index === openIndex;
            return (
              <article key={item.question} className="border-b">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-6 py-6 text-left"
                >
                  <h3 className="text-[1.85rem] leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                    {item.question}
                  </h3>
                  <span
                    className={`text-3xl leading-none text-[var(--foreground)] transition-transform duration-300 ${
                      isOpen ? "rotate-90" : "rotate-0"
                    }`}
                  >
                    {isOpen ? "×" : "+"}
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[80ch] pb-6 text-[1.22rem] leading-[1.5] text-[var(--muted-foreground)]">
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
