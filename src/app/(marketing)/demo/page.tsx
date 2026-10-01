import type { Metadata } from "next";
import { Avatar, Eyebrow } from "@/components/brand";
import { DemoBooking } from "@/components/marketing/demo-booking";
import { CheckItem, Container, H1 } from "@/components/marketing/pieces";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "Twenty minutes on video. Bring an old quote or spreadsheet and we'll rebuild it in Builder OS live.",
};

const cover = [
  "Rebuild one of your real quotes, live",
  "Import your price list into the service library",
  "Variations, stage payments and invoicing",
  "Honest advice on which plan fits",
];

export default function DemoPage() {
  return (
    <section className="px-6 pt-[72px] pb-28">
      <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-start gap-x-16 gap-y-12">
        <div className="flex flex-col gap-5 pt-3">
          <Eyebrow>Book a demo</Eyebrow>
          <H1 className="text-[clamp(36px,4.8vw,56px)] leading-[1.02]">See Builder OS with one of your own jobs.</H1>
          <p className="max-w-[480px] text-[17px] leading-[1.6] text-ink-2">
            Twenty minutes, on video. Bring an old quote or spreadsheet and we&apos;ll rebuild it live, then show you how variations, payments and the client portal fit around it.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {cover.map((c) => (
              <CheckItem key={c} className="gap-3 text-[15.5px] text-ink" iconClassName="size-4">
                {c}
              </CheckItem>
            ))}
          </div>
          <figure className="mt-5 flex max-w-[480px] flex-col gap-3.5 rounded-2xl bg-white p-[22px] shadow-ring">
            <blockquote className="text-[15.5px] leading-[1.55] text-ink-4">
              &ldquo;Marcus rebuilt our worst bathroom quote in about ten minutes on the call. We signed up that afternoon.&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-2.5 text-sm">
              <Avatar initials="JW" tint="#FBF1DE" size={32} className="text-[11.5px] text-ink-3" />
              <span>
                <b className="font-medium">Jess Walker</b>
                <span className="text-subtle"> · Tidewater Bathrooms</span>
              </span>
            </figcaption>
          </figure>
        </div>
        <DemoBooking />
      </Container>
    </section>
  );
}
