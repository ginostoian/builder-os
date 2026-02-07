import { FaqSection } from "@/components/marketing/faq-section";

export default function RequestAccessPage() {
  return (
    <div>
      <section className="mx-auto w-full max-w-6xl px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
        <div className="rounded-3xl border bg-white p-6 shadow-[var(--card-shadow)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="space-y-5">
              <span className="section-label">Request access</span>
              <h1 className="max-w-[12ch]">Raise your hand when you&apos;re ready.</h1>
              <p className="max-w-[44ch]">
                Share a few details and we&apos;ll follow up with next steps. No pressure, no pricing
                conversation, and no obligation.
              </p>
              <div className="flex flex-col gap-3 sm:max-w-sm">
                <a
                  href="#request-access-form"
                  className="inline-flex items-center justify-center rounded-xl bg-[#121316] px-5 py-3 text-base font-medium !text-white"
                >
                  Fill out form
                </a>
                <a
                  href="/product"
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-5 py-3 text-base font-medium text-[var(--foreground)]"
                >
                  View product
                </a>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">Simple pricing. No sales pressure.</p>
            </div>

            <div className="panel-card">
              <form id="request-access-form" className="space-y-5" action="#" method="post">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-[var(--foreground)]">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium text-[var(--foreground)]">
                      Company
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      required
                      className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium text-[var(--foreground)]">
                    Optional message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-accent)]"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white"
                >
                  Request access
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <FaqSection
        title="Request access FAQs"
        description="A few practical questions before you submit your details."
        background="muted"
        items={[
          {
            question: "What happens after I submit the form?",
            answer:
              "A member of the BuilderOS team reviews your details and follows up to schedule next steps.",
          },
          {
            question: "Do I need to prepare anything before the call?",
            answer:
              "A short overview of your current quote process is usually enough for an initial conversation.",
          },
          {
            question: "Is there pressure to commit after requesting access?",
            answer:
              "No. The goal is to confirm fit and answer questions before any commitment.",
          },
          {
            question: "Can more than one person from our team attend?",
            answer:
              "Yes. It is often useful to include both operational and commercial stakeholders.",
          },
        ]}
      />
    </div>
  );
}
