import { Eyebrow } from "@/components/brand";
import { Container, H1 } from "./pieces";

/** A plain, readable page for policies: title, date, then sections of prose. */
export function LegalPage({ eyebrow, title, updated, intro, children }: { eyebrow: string; title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-6 pt-[72px] pb-24">
      <Container className="max-w-[760px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <H1 className="mt-4 text-[clamp(34px,4.6vw,48px)]">{title}</H1>
        <p className="mt-3 text-sm text-subtle">Last updated {updated}</p>
        <div className="mt-6 text-[17px] leading-[1.6] text-ink-2">{intro}</div>
        <div className="legal mt-10 flex flex-col gap-9 text-[15.5px] leading-[1.65] text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2.5 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_li]:mt-1.5 [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </Container>
    </section>
  );
}
