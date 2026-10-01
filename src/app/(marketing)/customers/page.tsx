import type { Metadata } from "next";
import { Eyebrow, Placeholder } from "@/components/brand";
import { CustomerStories } from "@/components/marketing/customer-stories";
import { siteLinks } from "@/components/marketing/links";
import { ArrowLink, Container, H1, H2, LightCtaCard, PrimaryCta, SecondaryCta } from "@/components/marketing/pieces";

export const metadata: Metadata = {
  title: "Customers",
  description: "From two-person bathroom fitters to fifty-strong design-and-build firms, here's how they run on Builder OS.",
};

const stats = [
  ["25 min", "to build a quote, down from 3 hours"],
  ["44%", "win rate, up from 31%"],
  ["9 days", "to get paid, down from 24"],
];

export default function CustomersPage() {
  return (
    <>
      <section className="px-6 pt-[88px]">
        <Container className="flex flex-col gap-[18px]">
          <Eyebrow>Customers</Eyebrow>
          <H1 className="max-w-[860px] text-[clamp(40px,5.6vw,64px)]">Renovation firms that got their evenings back.</H1>
          <p className="max-w-[600px] text-lg leading-[1.55] text-ink-2">
            From two-person bathroom fitters to fifty-strong design-and-build firms, here&apos;s how they run on Builder OS.
          </p>
        </Container>
      </section>

      <section className="px-6 pt-14">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] overflow-hidden rounded-3xl bg-night text-night-ink">
          <div className="flex flex-col gap-6 p-[clamp(32px,5vw,56px)]">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-night-line text-[13px] font-semibold text-white">NL</div>
              <div>
                <div className="font-semibold text-white">Northgate Lofts</div>
                <div className="text-sm text-night-text">Leeds · 14 people · lofts &amp; extensions</div>
              </div>
            </div>
            <p className="text-[clamp(22px,2.4vw,28px)] leading-[1.35] font-medium tracking-[-0.02em] text-pretty text-white">
              &ldquo;We used to quote on a Sunday and hope. Now quotes go out the evening of the site visit, and clients sign before our competitors have sent theirs.&rdquo;
            </p>
            <div className="text-[15px] text-night-text">Leanne Hughes, Director</div>
            <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-night-line pt-6">
              {stats.map(([v, l]) => (
                <div key={v}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-[clamp(26px,3vw,36px)] font-semibold tracking-[-0.035em] text-white">{v}</dd>
                  <dd className="mt-1 text-[13.5px] leading-[1.45] text-night-text">{l}</dd>
                </div>
              ))}
            </dl>
            <ArrowLink href={siteLinks.article} className="text-white hover:text-night-ink">
              Read the story
            </ArrowLink>
          </div>
          <Placeholder label="photo · Leanne on a loft conversion" variant="night" className="min-h-[420px]" />
        </Container>
      </section>

      <section className="px-6 pt-24">
        <Container>
          <CustomerStories />
        </Container>
      </section>

      <section className="px-6 pt-32 pb-28">
        <LightCtaCard className="flex flex-col items-center gap-4 py-[clamp(40px,6vw,72px)] text-center">
          <H2 className="max-w-[700px] text-[clamp(28px,4vw,48px)] leading-[1.04] tracking-[-0.04em]">Your firm could be the next story.</H2>
          <p className="text-[16.5px] text-ink-2">Start free, or let us set you up on a call.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            <PrimaryCta href={siteLinks.pricing} lifted={false}>
              Start free
            </PrimaryCta>
            <SecondaryCta href={siteLinks.demo}>Book a demo</SecondaryCta>
          </div>
        </LightCtaCard>
      </section>
    </>
  );
}
