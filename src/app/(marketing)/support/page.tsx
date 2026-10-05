import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { Container, H1 } from "@/components/marketing/pieces";
import { SupportForm } from "@/components/marketing/support-form";
import { LEGAL } from "@/lib/content/legal";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Builder OS: guides to every part of the app, or send us a message and a person will reply.",
};

const ways = [
  { icon: BookOpen, title: "Read the guides", body: "Step-by-step help for every part of Builder OS, from your first quote to CIS.", href: "/help", cta: "Open the help centre" },
  { icon: Mail, title: "Email us", body: "Prefer your own email? Write to us and attach screenshots if they help.", href: `mailto:${LEGAL.supportEmail}`, cta: LEGAL.supportEmail },
  { icon: ShieldCheck, title: "Privacy and your data", body: "Ask for a copy of your data, or for it to be deleted.", href: `mailto:${LEGAL.privacyEmail}`, cta: LEGAL.privacyEmail },
];

/** Support: the help centre, how to reach us, and a contact form that goes to a person. */
export default function SupportPage() {
  return (
    <section className="px-6 pt-[72px] pb-24">
      <Container className="max-w-[1000px]">
        <Eyebrow>Support</Eyebrow>
        <H1 className="mt-4 text-[clamp(34px,4.6vw,52px)]">How can we help?</H1>
        <p className="mt-3 max-w-[620px] text-[17px] leading-[1.6] text-ink-2">Most answers are in the help centre. If you can&apos;t find yours, send us a message: a real person reads every one, usually within one working day (Monday to Friday).</p>

        <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {ways.map((w) => (
            <Link key={w.title} href={w.href} className="flex flex-col gap-2 rounded-[18px] bg-white p-6 shadow-ring transition-shadow hover:shadow-card">
              <w.icon className="size-5 text-ink-2" />
              <div className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">{w.title}</div>
              <p className="text-[15px] leading-[1.55] text-ink-2">{w.body}</p>
              <span className="mt-auto pt-2 text-[14px] font-medium break-all text-ink underline underline-offset-2">{w.cta}</span>
            </Link>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-10">
          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Send us a message</h2>
            <p className="mt-2 text-[15.5px] leading-[1.6] text-ink-2">Tell us what you were trying to do and what happened. If you&apos;re signed in, mention your company name so we can find your account.</p>
            <ul className="mt-5 flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink-2">
              <li>We never ask for your password.</li>
              <li>We only look at your company&apos;s data if you ask us to, to fix a problem.</li>
              <li>
                Your data is covered by our <Link href="/privacy" className="text-ink underline underline-offset-2">privacy policy</Link> and <Link href="/terms" className="text-ink underline underline-offset-2">terms</Link>.
              </li>
            </ul>
          </div>
          <div className="rounded-[22px] bg-white p-6 shadow-ring sm:p-8">
            <SupportForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
