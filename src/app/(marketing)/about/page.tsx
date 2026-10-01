import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { Eyebrow, Placeholder } from "@/components/brand";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container, H1, H2 } from "@/components/marketing/pieces";

export const metadata: Metadata = {
  title: "About & contact",
  description: "Builder OS started in a site office in Bristol. Talk to a human about pricing, moving your data across, or whether it suits your firm.",
};

const values = [
  ["01", "Faster than a spreadsheet", "If it takes longer in Builder OS than in Excel, that's a bug. Speed in the van matters more than features in a demo."],
  ["02", "Your client sees your brand", "We stay out of the way. Quotes, portals and invoices carry your name and your logo, not ours."],
  ["03", "Straight talking", "Clear prices, no lock-in, and support from people who know what a padstone is."],
];

const team = [
  ["Tom Ashworth", "Co-founder · ex-renovation firm owner"],
  ["Hannah Cole", "Co-founder · product"],
  ["Dev Mistry", "Engineering lead"],
  ["Priya Nair", "Customer success"],
  ["Marcus Reid", "Head of onboarding · ex-site manager"],
  ["Sophie Lane", "Design"],
];

const contacts = [
  { icon: Mail, label: "Email", value: "hello@builderos.co.uk", href: "mailto:hello@builderos.co.uk" },
  { icon: Phone, label: "Phone", value: "0117 496 0123", href: "tel:+441174960123" },
  { icon: MapPin, label: "Office", value: "Bristol, United Kingdom" },
];

export default function AboutPage() {
  return (
    <>
      <section className="px-6 pt-[88px]">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-end gap-x-16 gap-y-10">
          <div className="flex flex-col gap-[18px]">
            <Eyebrow>About</Eyebrow>
            <H1 className="text-[clamp(40px,5.6vw,64px)]">Made by people who&apos;ve priced a loft at midnight.</H1>
          </div>
          <p className="text-lg leading-[1.6] text-pretty text-ink-2">
            Builder OS started in a site office in Bristol. We&apos;re a small team of former builders, project managers and software people, building the tool we needed when we were running jobs ourselves.
          </p>
        </Container>
        <Container className="mt-14 grid grid-cols-[2fr_1fr] gap-4">
          <Placeholder label="team photo · Bristol studio" className="aspect-[16/10] rounded-[22px] shadow-ring" />
          <Placeholder label="on site with a customer" className="rounded-[22px] p-3 shadow-ring" />
        </Container>
      </section>

      <section className="px-6 pt-28">
        <Container>
          <H2 className="mb-9 text-[clamp(28px,3.4vw,40px)] leading-[1.1]">What we care about</H2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-px overflow-hidden rounded-[18px] bg-border shadow-ring">
            {values.map(([n, t, b]) => (
              <div key={n} className="flex flex-col gap-2.5 bg-white px-7 py-8">
                <Eyebrow>{n}</Eyebrow>
                <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.015em]">{t}</h3>
                <p className="text-[15.5px] leading-[1.6] text-ink-2">{b}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="px-6 pt-28">
        <Container>
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <H2 className="text-[clamp(28px,3.4vw,40px)] leading-[1.1]">The team</H2>
            <span className="text-[15px] text-ink-2">We&apos;re hiring in Bristol and remote across the UK.</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-x-4 gap-y-6">
            {team.map(([name, role]) => (
              <div key={name} className="flex flex-col gap-3">
                <Placeholder label="portrait" variant="sm" className="aspect-square rounded-2xl text-[11px] shadow-ring" />
                <div>
                  <div className="text-[15px] font-semibold">{name}</div>
                  <div className="text-[13.5px] leading-[1.4] text-subtle">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="contact" className="scroll-mt-20 px-6 py-28">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-start gap-x-16 gap-y-12">
          <div className="flex flex-col gap-5">
            <Eyebrow>Contact</Eyebrow>
            <H2 className="text-[clamp(30px,3.6vw,44px)] leading-[1.05]">Talk to a human.</H2>
            <p className="max-w-[440px] text-[16.5px] leading-[1.6] text-ink-2">
              Questions about pricing, moving your data across, or whether Builder OS suits your firm? We usually reply within the hour, Monday to Friday.
            </p>
            <div className="mt-2 flex flex-col gap-0.5 border-t border-border">
              {contacts.map((c) => (
                <div key={c.label} className="flex items-center gap-3.5 border-b border-border py-4">
                  <c.icon className="size-[17px] text-ink-2" />
                  <div className="flex-1">
                    <div className="text-[13px] text-subtle">{c.label}</div>
                    {c.href ? (
                      <a href={c.href} className="text-[15.5px] font-medium text-ink hover:text-ink-2">
                        {c.value}
                      </a>
                    ) : (
                      <div className="text-[15.5px] font-medium">{c.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] bg-white p-[clamp(24px,4vw,36px)] shadow-[0_0_0_1px_#E8E7E3,0_20px_40px_-24px_rgb(16_16_15/0.18)]">
            <ContactForm />
          </div>
        </Container>
      </section>
    </>
  );
}
