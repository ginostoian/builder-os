import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ChartColumn,
  Check,
  Clock,
  FileDiff,
  FileSpreadsheet,
  Globe,
  HardHat,
  Library,
  Receipt,
  SquareKanban,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow, Placeholder } from "@/components/brand";
import { Screenshot } from "@/components/app/screenshot";
import type { ScreenId } from "@/components/app/routes";
import { siteLinks } from "@/components/marketing/links";
import { CheckItem, Container, H1, H2, LightCtaCard, PrimaryCta, SecondaryCta } from "@/components/marketing/pieces";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Features",
  description: "Quoting, variations, client portal, payment plans, invoicing, projects, team app, CRM and reporting for UK renovation companies.",
};

type Module = {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  screen: ScreenId | "phone";
  url?: string;
};

const before: Module[] = [
  {
    id: "quoting",
    icon: FileSpreadsheet,
    eyebrow: "Quoting",
    title: "A quote builder that thinks like a spreadsheet.",
    body: "Sections, quantities, units and rates in a grid you can fly through with the keyboard. Set markup per line or per section, add notes clients can see, and watch your margin update as you type.",
    points: ["Formulas and per-line markup", "Notes and attachments on any line", "Duplicate past quotes in one click", "Provisional and prime cost sums"],
    screen: "quote",
    url: "app.builderos.co.uk/quotes/Q-1042",
  },
  {
    id: "library",
    icon: Library,
    eyebrow: "Service library",
    title: "Your price list, finally in one place.",
    body: "Save every service you price — with units, rates and descriptions — and group them into bundles like a standard bathroom refit. Start typing in a quote and the right item appears.",
    points: ["Services and multi-item bundles", "Import your rates from CSV", "Adjust the rate per job", "See which services win the most work"],
    screen: "templates",
    url: "app.builderos.co.uk/library",
  },
  {
    id: "portal",
    icon: Globe,
    eyebrow: "Client links & portal",
    title: "Quotes your clients can read on the sofa.",
    body: "Every quote is a private link that looks great on a phone. Clients can expand each section, ask about a line and accept with an e-signature. Once you win the job, the same link becomes their project portal with progress photos.",
    points: ["Branded link and PDF export", "Know when it's opened", "Comments on individual lines", "Progress photos and documents"],
    screen: "client",
    url: "builderos.app/q/hale-sons/1042",
  },
];

const after: Module[] = [
  {
    id: "payments",
    icon: Receipt,
    eyebrow: "Payment plans & invoicing",
    title: "Stage payments that invoice themselves.",
    body: "Set the payment plan on the quote — deposit, stages, retention — and Builder OS raises each invoice when the stage is ticked off. Clients pay by card or bank transfer, and polite reminders go out for you.",
    points: ["Deposit, stage and retention plans", "VAT and reverse-charge ready", "Card and open-banking payments", "Automatic payment reminders"],
    screen: "invoices",
    url: "app.builderos.co.uk/payments",
  },
  {
    id: "projects",
    icon: SquareKanban,
    eyebrow: "Project management",
    title: "Every job on one board.",
    body: "Turn an accepted quote into a project with tasks already laid out by section. Assign work, set dates, attach drawings and keep a site diary — the office and the site finally see the same thing.",
    points: ["Board and timeline views", "Tasks created from the quote", "Site diary and photo log", "Files and drawings per job"],
    screen: "board",
    url: "app.builderos.co.uk/projects/elm-road",
  },
  {
    id: "team",
    icon: HardHat,
    eyebrow: "Team & employee app",
    title: "Your team knows where to be and what to do.",
    body: "Each employee gets their own app with today's site, their tasks and anything that changed overnight. They check in, tick things off and upload photos — you see it all in the office.",
    points: ["Daily site and task list", "Check-in and timesheets", "Photo uploads to the project", "Certificates and holiday tracking"],
    screen: "phone",
  },
  {
    id: "crm",
    icon: ChartColumn,
    eyebrow: "CRM & reporting",
    title: "Know which jobs make you money.",
    body: "Track every enquiry from first call to signed contract, with reminders so nothing goes cold. Then see win rate, cash position and margin by job on a dashboard that updates itself.",
    points: ["Pipeline by stage and source", "Follow-up reminders and email automations", "Win rate and margin by job type", "Cash flow forecast from payment plans"],
    screen: "crm",
    url: "app.builderos.co.uk/clients",
  },
];

const jump: [string, LucideIcon, string][] = [
  ["Quoting", FileSpreadsheet, "quoting"],
  ["Library", Library, "library"],
  ["Client portal", Globe, "portal"],
  ["Variations", FileDiff, "variations"],
  ["Payments", Receipt, "payments"],
  ["Projects", SquareKanban, "projects"],
  ["Team", HardHat, "team"],
  ["CRM & reporting", ChartColumn, "crm"],
];

const teamCards = [
  { icon: Users, title: "Employees tab", body: "Contact details, day rates, trades, CSCS cards and certificates with expiry reminders." },
  { icon: CalendarDays, title: "Who's where this week", body: "A simple schedule across all jobs so you can see gaps and double-bookings at a glance." },
  { icon: Clock, title: "Timesheets", body: "Check-ins become timesheets, ready to export for payroll at the end of the week." },
];

function ModuleSection({ m }: { m: Module }) {
  return (
    <section id={m.id} className="scroll-mt-[100px] px-6 pt-28">
      <Container>
        <div className="mb-11 grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-16 gap-y-6">
          <div className="flex flex-col gap-3.5">
            <Eyebrow className="flex items-center gap-2">
              <m.icon className="size-3.5" />
              {m.eyebrow}
            </Eyebrow>
            <H2 className="text-[clamp(30px,3.6vw,44px)] leading-[1.05]">{m.title}</H2>
          </div>
          <div className="flex flex-col gap-[18px] pt-1">
            <p className="text-[17px] leading-[1.6] text-pretty text-ink-2">{m.body}</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-2.5">
              {m.points.map((p) => (
                <CheckItem key={p} iconClassName="text-ink">
                  {p}
                </CheckItem>
              ))}
            </div>
          </div>
        </div>
        {m.screen === "phone" ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-stretch gap-4">
            <div className="flex justify-center overflow-hidden rounded-[22px] bg-line px-5 pt-10 shadow-[inset_0_0_0_1px_#E8E7E3]">
              <div className="h-[520px] w-[300px] overflow-hidden rounded-t-[46px] bg-ink px-[9px] pt-[9px]">
                <div className="overflow-hidden rounded-t-[38px]">
                  <Screenshot screen="mobile" chrome={false} baseWidth={390} baseHeight={844} />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {teamCards.map((t) => (
                <div key={t.title} className="flex flex-1 flex-col gap-2 rounded-[18px] bg-white p-6 shadow-ring">
                  <t.icon className="size-[19px]" strokeWidth={1.5} />
                  <div className="mt-1.5 text-[16.5px] font-semibold tracking-[-0.01em]">{t.title}</div>
                  <div className="text-[14.5px] leading-[1.55] text-ink-2">{t.body}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Screenshot screen={m.screen} url={m.url} />
        )}
      </Container>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <section className="px-6 pt-[88px] pb-12">
        <Container className="flex flex-col gap-5">
          <Eyebrow>Features</Eyebrow>
          <H1 className="max-w-[900px] text-[clamp(40px,5.6vw,68px)]">Built around the way a renovation job actually runs.</H1>
          <p className="max-w-[640px] text-lg leading-[1.55] text-ink-2">
            Quote, agree changes, schedule the work, get paid. Each module works on its own, and they&apos;re better together.
          </p>
        </Container>
      </section>

      <nav aria-label="Modules" className="sticky top-16 z-40 border-y border-hairline bg-surface/[0.88] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] gap-1.5 overflow-x-auto px-6 py-2.5">
          {jump.map(([label, Icon, id]) => (
            <Link
              key={id}
              href={`#${id}`}
              className="flex h-8 flex-none items-center gap-[7px] rounded-[9px] bg-white px-3 text-[13.5px] font-medium text-ink-3 shadow-ring hover:text-ink"
            >
              <Icon className="size-3.5 text-subtle" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {before.map((m) => (
        <ModuleSection key={m.id} m={m} />
      ))}

      <section id="variations" className="mt-28 scroll-mt-[100px] bg-night px-6 py-28 text-night-ink">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14">
          <div className="flex flex-col gap-4">
            <Eyebrow className="flex items-center gap-2">
              <FileDiff className="size-3.5" />
              Variations
            </Eyebrow>
            <H2 className="text-[clamp(30px,3.6vw,44px)] leading-[1.05] text-white">Every change, priced and agreed in writing.</H2>
            <p className="text-[17px] leading-[1.6] text-night-text">
              Add a variation from the office or the van. Your client gets a notification, sees the price and photos, and approves with one tap. Approved variations flow straight into the payment plan.
            </p>
            <div className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-2.5">
              {["Create on mobile with photos", "Client approves in their portal", "Full audit trail with timestamps", "Feeds the next stage invoice"].map((p) => (
                <CheckItem key={p} className="text-night-ink">
                  {p}
                </CheckItem>
              ))}
            </div>
          </div>
          <div className="flex w-full max-w-[460px] flex-col gap-3 justify-self-center">
            <div className="rounded-[18px] bg-white p-[22px] text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.7)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-subtle">V-03 · 14 Elm Road</span>
                <Badge tone="amber" className="px-[9px] py-[3px] text-xs">
                  Awaiting you
                </Badge>
              </div>
              <div className="mt-2.5 mb-1.5 text-[19px] font-semibold tracking-[-0.015em]">Move island socket 600mm left</div>
              <div className="text-[14.5px] leading-[1.55] text-ink-2">
                To line up with the new hob position you chose on Friday. Re-route under the slab before the screed goes down.
              </div>
              <div className="my-4 grid grid-cols-2 gap-2">
                <Placeholder label="site photo" variant="xs" className="aspect-[4/3] rounded-[10px] text-[11px]" />
                <Placeholder label="marked-up plan" variant="xs" className="aspect-[4/3] rounded-[10px] text-[11px]" />
              </div>
              <div className="flex items-baseline justify-between border-t border-hairline py-3">
                <span className="text-sm text-ink-2">Change to contract</span>
                <span className="text-[22px] font-semibold tracking-[-0.02em]">+£102.00</span>
              </div>
              <div className="flex gap-2">
                <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[11px] bg-ink font-medium text-white">
                  <Check className="size-4" />
                  Approve
                </span>
                <span className="flex h-11 flex-1 items-center justify-center rounded-[11px] font-medium shadow-ring-input">Discuss</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[14px] bg-[#1A1A18] px-4 py-3 text-sm text-night-text shadow-[inset_0_0_0_1px_#2A2A27]">
              <Receipt className="size-[15px] text-night-ink" />
              Added to stage 3 invoice when approved
            </div>
          </div>
        </Container>
      </section>

      {after.map((m) => (
        <ModuleSection key={m.id} m={m} />
      ))}

      <section className="px-6 pt-32 pb-28">
        <LightCtaCard className="flex flex-wrap items-center justify-between gap-7 py-[clamp(40px,6vw,72px)]">
          <div className="max-w-[560px]">
            <H2 className="text-[clamp(28px,3.4vw,40px)] leading-[1.08]">See it with your own jobs.</H2>
            <p className="mt-3 text-[16.5px] leading-[1.55] text-ink-2">Send us an old quote and we&apos;ll rebuild it in Builder OS on a 20-minute call.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <PrimaryCta href={siteLinks.demo} lifted={false}>
              Book a demo
            </PrimaryCta>
            <SecondaryCta href={siteLinks.pricing}>Start free</SecondaryCta>
          </div>
        </LightCtaCard>
      </section>
    </>
  );
}
