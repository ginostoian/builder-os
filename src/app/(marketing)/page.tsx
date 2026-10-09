import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CalendarRange,
  ChartColumn,
  Check,
  Contact,
  FileDiff,
  Globe,
  HardHat,
  Library,
  Link as LinkIcon,
  PenLine,
  Receipt,
  SquareKanban,
} from "lucide-react";
import { Avatar, Eyebrow, Placeholder } from "@/components/brand";
import { Screenshot } from "@/components/app/screenshot";
import { siteLinks } from "@/components/marketing/links";
import { ArrowLink, Container, DarkCtaBand, H1, H2, PrimaryCta } from "@/components/marketing/pieces";
import { ProductTour } from "@/components/marketing/product-tour";
import { Button } from "@/components/ui/button";
import { plans } from "@/lib/content/pricing";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/seo/json-ld";
import { graph, organizationSchema, pageMetadata, softwareSchema, webPageSchema, websiteSchema } from "@/lib/seo";

const library = [
  { name: "Plaster skim, walls", unit: "m²", rate: "£14.00", selected: true },
  { name: "Standard bathroom refit", unit: "bundle", rate: "£6,850" },
  { name: "Double socket, new circuit", unit: "point", rate: "£145" },
];

const activity = [
  { text: "Sarah signed the quote", when: "Just now", dot: "bg-success" },
  { text: "Ben commented on 3.2 Worktops", when: "2h ago", dot: "bg-brand" },
  { text: "Opened for the third time", when: "Yesterday", dot: "bg-faint" },
];

const pdfPlan = [
  ["Deposit", "£6,970"],
  ["Groundworks", "£10,455"],
  ["Watertight", "£10,455"],
  ["Completion", "£6,970"],
];

const variationFlow = [
  "Log the change on site, with photos",
  "Client approves in their portal",
  "Task lands on the right person's phone",
  "Added to the next stage invoice",
];

const modules = [
  { icon: FileDiff, name: "Variations", desc: "Capture changes on site and get them signed off the same day.", href: "/features#variations" },
  { icon: Globe, name: "Client portal", desc: "Progress photos, documents and approvals in one tidy link.", href: "/features#portal" },
  { icon: CalendarRange, name: "Payment plans", desc: "Deposit, stages, retention — set once from the quote.", href: "/features#payments" },
  { icon: Receipt, name: "Invoicing", desc: "VAT-ready invoices with card and bank payments, and polite auto-chasers.", href: "/features#payments" },
  { icon: SquareKanban, name: "Projects", desc: "A board for every job, with tasks, files and site diary.", href: "/features#projects" },
  { icon: HardHat, name: "Team & employee app", desc: "Who's where, what they're doing, hours and certificates.", href: "/features#team" },
  { icon: ChartColumn, name: "Reporting", desc: "Win rates, cash flow and margin by job, without a spreadsheet.", href: "/features#crm" },
  { icon: Contact, name: "CRM", desc: "Every enquiry and follow-up, so good leads don't go cold.", href: "/features#crm" },
];

const testimonials = [
  {
    text: "“We used to lose two evenings a week to quotes. Now I do them on the iPad after the site visit, and they're out before I'm home.”",
    name: "Leanne Hughes",
    co: "Director, Northgate Lofts · Leeds",
    initials: "LH",
    tint: "#E3E0EE",
  },
  {
    text: "“Variations were where we bled money. Now the client signs on their phone and it's on the next invoice. Not one argument since.”",
    name: "Marcus Reid",
    co: "Owner, Reid & Co Build · Manchester",
    initials: "MR",
    tint: "#DCE5DF",
  },
  {
    text: "“Clients actually comment on how professional the quotes look. Our win rate went up and we haven't dropped our prices.”",
    name: "Priya Nair",
    co: "Operations, Fernbrook Interiors · Surrey",
    initials: "PN",
    tint: "#E9E3D6",
  },
];

function FeatureCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[22px] overflow-hidden rounded-[18px] bg-white p-7 shadow-card-soft">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.015em]">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-2">{body}</p>
      </div>
      {children}
    </div>
  );
}

function MiniGridRow({ code, item, qty, rate, total, selected }: { code: string; item: string; qty: string; rate: string; total: string; selected?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[40px_1fr_54px_76px_84px] border-b border-line px-3 py-[9px] last:border-0", selected && "bg-brand-tint")}>
      <span className="font-mono text-[11.5px] text-subtle">{code}</span>
      <span>{item}</span>
      <span className={cn("text-right", selected && "rounded-[3px] bg-white shadow-[0_0_0_2px_var(--color-brand)]")}>{qty}</span>
      <span className="text-right">{rate}</span>
      <span className="text-right font-medium">{total}</span>
    </div>
  );
}

const HOME_TITLE = "Builder OS: quoting and job software for UK renovation firms";
const HOME_DESCRIPTION =
  "Quote in minutes, get clients to sign online, take stage payments and run every job from one place. Software built for UK renovation and building firms. Start free.";

export const metadata: Metadata = pageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/", absoluteTitle: true });

export default function HomePage() {
  return (
    <>
      <JsonLd data={graph(organizationSchema(), websiteSchema(), softwareSchema(), webPageSchema({ path: "/", name: HOME_TITLE, description: HOME_DESCRIPTION }))} />
      {/* Hero */}
      <section className="relative px-6 pt-[88px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[linear-gradient(#ECEBE7_1px,transparent_1px),linear-gradient(90deg,#ECEBE7_1px,transparent_1px)] bg-[size:56px_56px] bg-[position:center_-1px] opacity-70 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,#000_30%,transparent_75%)]"
        />
        <div className="relative mx-auto flex max-w-[900px] flex-col items-center text-center">
          <Link
            href="/features#variations"
            className="inline-flex items-center gap-2 rounded-full bg-white py-[5px] pr-3 pl-1.5 text-[13px] text-ink-3 shadow-[0_0_0_1px_#E2E1DC,0_1px_2px_rgb(16_16_15/0.04)] hover:text-ink"
          >
            <span className="rounded-full bg-ink px-2 py-0.5 text-[11.5px] font-medium text-white">New</span>
            Variations your clients sign from their phone
            <ArrowRight className="size-[13px] text-subtle" />
          </Link>
          <H1 className="mt-7 text-[clamp(42px,6.6vw,78px)]">
            Quotes that win the job,
            <br />
            <span className="text-subtle">built in minutes.</span>
          </H1>
          <p className="mt-6 max-w-[640px] text-[clamp(17px,1.6vw,19px)] leading-[1.55] text-pretty text-ink-2">
            Builder OS is the operating system for UK renovation companies. Spreadsheet-fast quoting, client sign-off, stage payments and invoicing — with your projects, team and pipeline in the same place.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <PrimaryCta href={siteLinks.pricing}>Start free</PrimaryCta>
            <Button asChild variant="outline" size="lg" className="shadow-[0_0_0_1px_#E2E1DC,0_1px_2px_rgb(16_16_15/0.05)]">
              <Link href={siteLinks.demo}>
                <Calendar className="text-ink-2" />
                Book a 20-min demo
              </Link>
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-subtle">
            {["Free plan, forever", "No card needed", "UK VAT built in"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="size-[13px]" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative mx-auto mt-16 max-w-[1200px]">
          <div className="rounded-[22px] bg-white/60 p-2.5 shadow-[0_0_0_1px_rgb(16_16_15/0.06)]">
            <Screenshot screen="quote" url="app.builderos.co.uk/quotes/Q-1042" />
          </div>
          <div className="absolute bottom-14 -left-2 flex w-[300px] max-w-[70%] items-start gap-3 rounded-[14px] bg-white px-4 py-3.5 shadow-[0_0_0_1px_#E8E7E3,0_20px_40px_-16px_rgb(16_16_15/0.25)]">
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-success-soft text-success">
              <PenLine className="size-[15px]" />
            </span>
            <div className="text-[13.5px] leading-[1.45]">
              <div className="font-semibold">Sarah Okafor accepted Q-1042</div>
              <div className="text-subtle">Signed on mobile · deposit invoice sent</div>
            </div>
          </div>
        </div>
      </section>

      {/* 01 Quoting */}
      <section className="px-6 pt-32">
        <Container>
          <div className="flex max-w-[680px] flex-col gap-4">
            <Eyebrow className="tracking-[0.02em]">01 — Quoting</Eyebrow>
            <H2 className="text-[clamp(32px,4vw,48px)] leading-[1.05]">Everything you liked about Excel. None of the Sunday nights.</H2>
            <p className="text-[17px] leading-[1.6] text-pretty text-ink-2">
              Build a quote the way you already think: rows, sections, quantities, rates. Builder OS does the maths, keeps your margins honest, and turns it into something your client actually enjoys reading.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <FeatureCard title="Type, tab, done" body="Keyboard-first grid with formulas, sections and per-line markup. Paste straight in from your old spreadsheet.">
              <div className="overflow-hidden rounded-xl text-[13px] shadow-ring tabular">
                <div className="grid grid-cols-[40px_1fr_54px_76px_84px] border-b border-hairline bg-surface px-3 py-2 text-[11.5px] text-subtle">
                  <span>#</span>
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">Total</span>
                </div>
                <MiniGridRow code="2.2" item="Cavity wall, facing brick" qty="28" rate="165.00" total="£5,313" />
                <MiniGridRow code="2.3" item="Warm flat roof, EPDM" qty="22" rate="138.00" total="£3,491" selected />
                <MiniGridRow code="2.4" item="Roof lantern 2.5 × 1m" qty="1" rate="2,400.00" total="£2,592" />
              </div>
            </FeatureCard>
            <FeatureCard title="Price it once, reuse it forever" body="Save services and whole bundles to your library. Pull them into any quote, then tweak the rate for that job.">
              <div className="flex flex-col gap-2">
                {library.map((l) => (
                  <div
                    key={l.name}
                    className={cn("flex items-center gap-3 rounded-xl bg-white px-3.5 py-[11px] text-sm", l.selected ? "shadow-selected" : "shadow-ring")}
                  >
                    <Library className="size-[15px] text-subtle" />
                    <span className="flex-1 font-medium">{l.name}</span>
                    <span className="text-[12.5px] text-subtle">{l.unit}</span>
                    <span className="w-16 text-right font-medium tabular">{l.rate}</span>
                  </div>
                ))}
              </div>
            </FeatureCard>
            <FeatureCard title="Send a link, not an attachment" body="Clients open your quote on any device, ask questions on a line and sign in two taps. You see the moment they open it.">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 rounded-xl bg-muted px-3 py-2.5 font-mono text-[12.5px] text-ink-3">
                  <LinkIcon className="size-3.5 text-subtle" />
                  <span className="flex-1 truncate">builderos.app/q/hale-sons/1042</span>
                  <span className="font-sans text-[13px] font-medium">Copy</span>
                </div>
                {activity.map((a) => (
                  <div key={a.text} className="flex items-center gap-2.5 p-0.5 text-[13.5px]">
                    <span className={cn("size-2 rounded-full", a.dot)} />
                    <span className="flex-1 text-ink-3">{a.text}</span>
                    <span className="text-[12.5px] text-subtle">{a.when}</span>
                  </div>
                ))}
              </div>
            </FeatureCard>
            <FeatureCard title="PDFs that look like you" body="Your logo, your terms, your payment schedule. Line notes come along too, so nothing gets lost between the visit and the build.">
              <div className="flex items-end justify-center gap-3.5 pt-1.5" aria-hidden>
                <div className="flex h-[190px] w-[150px] -rotate-3 flex-col gap-[7px] rounded-lg bg-white p-3.5 shadow-[0_0_0_1px_#E8E7E3,0_14px_28px_-14px_rgb(16_16_15/0.25)]">
                  <div className="flex items-center justify-between">
                    <span className="size-[22px] rounded-[5px] bg-[#2B3A33]" />
                    <span className="font-mono text-[8px] text-subtle">Q-1042</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-4/5 rounded-[3px] bg-ink" />
                  <div className="h-1 w-[55%] rounded-[2px] bg-pebble" />
                  <div className="my-1.5 h-px bg-hairline" />
                  <div className="h-1 rounded-[2px] bg-hairline" />
                  <div className="h-1 rounded-[2px] bg-hairline" />
                  <div className="h-1 w-[70%] rounded-[2px] bg-hairline" />
                  <div className="mt-auto flex items-center justify-between">
                    <span className="h-1 w-[30%] rounded-[2px] bg-pebble" />
                    <span className="text-[10px] font-semibold">£34,851</span>
                  </div>
                </div>
                <div className="flex h-[190px] w-[150px] translate-y-[-8px] rotate-2 flex-col gap-[7px] rounded-lg bg-white p-3.5 shadow-[0_0_0_1px_#E8E7E3,0_14px_28px_-14px_rgb(16_16_15/0.25)]">
                  <div className="text-[9px] font-semibold">Payment schedule</div>
                  {pdfPlan.map(([l, a]) => (
                    <div key={l} className="flex justify-between border-b border-line py-[3px] text-[8.5px] text-ink-2">
                      <span>{l}</span>
                      <span>{a}</span>
                    </div>
                  ))}
                  <div className="mt-auto rounded bg-brand-soft p-1.5 text-[8px] leading-[1.4] text-brand-deep">
                    Note: worktop is a provisional sum until slab is chosen.
                  </div>
                </div>
              </div>
            </FeatureCard>
          </div>
        </Container>
      </section>

      {/* 02 Take a look around */}
      <section className="px-6 pt-32">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-[620px] flex-col gap-4">
              <Eyebrow>02 — Take a look around</Eyebrow>
              <H2 className="text-[clamp(32px,4vw,48px)] leading-[1.05]">One login for the office, the site and the client.</H2>
            </div>
            <ArrowLink href="/app" icon={ArrowUpRight}>
              Open the live demo
            </ArrowLink>
          </div>
          <ProductTour />
        </Container>
      </section>

      {/* 03 After the yes */}
      <section className="mt-32 bg-night px-6 py-28 text-night-ink" data-surface="dark">
        <Container>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14">
            <div className="flex flex-col gap-[18px]">
              <Eyebrow>03 — After the yes</Eyebrow>
              <H2 className="text-[clamp(32px,4vw,48px)] leading-[1.05] text-white">Variations signed before the plaster&apos;s dry.</H2>
              <p className="max-w-[520px] text-[17px] leading-[1.6] text-night-text">
                Client wants the socket moved? Log it on site in thirty seconds. They get a notification, approve it in their portal, and it lands on the next stage invoice automatically. No more arguments at final account.
              </p>
              <ol className="mt-2.5 flex flex-col gap-3">
                {variationFlow.map((t, i) => (
                  <li key={t} className="flex items-center gap-3.5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-night-well font-mono text-xs text-night-text shadow-[inset_0_0_0_1px_#2E2E2B]">{i + 1}</span>
                    <span className="text-[15.5px] text-night-ink">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative flex min-h-[560px] items-center justify-center">
              <div aria-hidden className="absolute inset-x-0 inset-y-10 rounded-3xl bg-[radial-gradient(ellipse_at_50%_40%,#2A2A27,#111110_70%)]" />
              <div className="relative w-[290px] rounded-[46px] bg-black p-[9px] shadow-[0_0_0_1px_#34342F,0_40px_80px_-30px_rgb(0_0_0/0.8)]">
                <div className="overflow-hidden rounded-[38px]">
                  <Screenshot screen="mobile" chrome={false} baseWidth={390} baseHeight={844} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-24 mb-16 h-px bg-night-edge" />
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <h3 className="max-w-[560px] text-[clamp(26px,3vw,36px)] leading-[1.1] font-semibold tracking-[-0.03em] text-white">
              The whole job, from first call to final invoice.
            </h3>
            <ArrowLink href={siteLinks.features} className="text-night-ink hover:text-white">
              All features
            </ArrowLink>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-px overflow-hidden rounded-[18px] bg-night-edge shadow-[0_0_0_1px_#262624]">
            {modules.map((m) => (
              <Link
                key={m.name}
                href={m.href}
                className="flex min-h-[170px] flex-col gap-3 bg-night-tile px-6 py-[26px] text-night-ink transition-colors duration-[120ms] hover:bg-night-raised hover:text-night-ink"
              >
                <m.icon className="size-5" strokeWidth={1.5} />
                <div className="mt-auto text-base font-semibold tracking-[-0.01em]">{m.name}</div>
                <div className="text-sm leading-normal text-night-text">{m.desc}</div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Founder note */}
      <section className="px-6 pt-32">
        <div className="mx-auto grid max-w-[1060px] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-14">
          <Placeholder label="founder photo, on site" className="aspect-[4/5] rounded-[18px] shadow-ring" />
          <div className="flex flex-col gap-[22px] pt-2">
            <Eyebrow>A note from the founder</Eyebrow>
            <p className="text-[clamp(22px,2.4vw,28px)] leading-[1.35] font-medium tracking-[-0.02em] text-pretty">
              &ldquo;I ran a renovation firm for twelve years. The building was the easy part. It was the quotes at midnight, the variations nobody wrote down, and chasing the last 10% that wore me out.&rdquo;
            </p>
            <p className="text-base leading-[1.65] text-ink-2">
              We built Builder OS for firms like the one I had — five to fifty people, great at the work, held together by spreadsheets, WhatsApp groups and a lot of goodwill. It&apos;s the tool I wish I&apos;d had: quick enough to use in the van, and tidy enough that your clients notice.
            </p>
            <p className="text-base leading-[1.65] text-ink-2">If you try it and something&apos;s missing, email me. I read every one.</p>
            <div className="mt-1.5 flex items-center gap-3.5">
              <Avatar initials="TA" size={44} className="text-base" />
              <div>
                <div className="font-semibold">Tom Ashworth</div>
                <div className="text-sm text-subtle">Co-founder · tom@builderos.co.uk</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 pt-32">
        <Container>
          <H2 className="mb-10 max-w-[560px] text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Firms that switched, in their own words.</H2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
            {testimonials.map((q) => (
              <figure key={q.name} className="flex flex-col gap-6 rounded-[18px] bg-white p-7 shadow-card-soft">
                <blockquote className="text-[16.5px] leading-[1.55] text-pretty text-ink-4">{q.text}</blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <Avatar initials={q.initials} tint={q.tint} size={38} className="text-[13px] text-ink-3" />
                  <div>
                    <div className="text-[14.5px] font-semibold">{q.name}</div>
                    <div className="text-[13.5px] text-subtle">{q.co}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
          <ArrowLink href={siteLinks.customers} className="mt-6">
            Read customer stories
          </ArrowLink>
        </Container>
      </section>

      {/* Pricing teaser */}
      <section className="px-6 pt-32">
        <Container>
          <div className="mx-auto mb-11 max-w-[620px] text-center">
            <H2 className="text-[clamp(28px,3.4vw,40px)] leading-[1.1]">Simple pricing. Per company, not per head.</H2>
            <p className="mt-3.5 text-[16.5px] text-ink-2">Start free. Upgrade when the jobs start rolling in.</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
            {plans.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col gap-[18px] rounded-[18px] p-7",
                  p.featured ? "bg-ink text-white shadow-[0_20px_40px_-20px_rgb(16_16_15/0.45)]" : "bg-white text-ink shadow-ring",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{p.name}</span>
                  <span className={cn("rounded-full px-[9px] py-[3px] text-xs font-medium", p.featured ? "bg-night-edge text-night-ink" : "bg-line text-ink-2")}>
                    {p.homeTag}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[44px] font-semibold tracking-[-0.04em]">{p.price}</span>
                  <span className={cn("text-sm", p.featured ? "text-night-text" : "text-ink-2")}>{p.id === "free" ? "forever" : "/ month"}</span>
                </div>
                <div className={cn("min-h-11 text-[14.5px] leading-[1.55]", p.featured ? "text-night-text" : "text-ink-2")}>{p.homeDesc}</div>
                <Link
                  href={siteLinks.pricing}
                  className={cn(
                    "flex h-[42px] items-center justify-center rounded-[11px] text-[14.5px] font-medium",
                    p.featured ? "bg-white text-ink hover:text-ink" : "bg-ink text-white hover:text-white",
                  )}
                >
                  {p.homeCta}
                </Link>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="px-6 pt-32 pb-28">
        <DarkCtaBand
          grid
          className="py-[clamp(48px,7vw,88px)]"
          title="Your next quote could go out tonight."
          body="Import your price list, send your first quote, and see what your clients make of it. Free while you try."
        />
      </section>
    </>
  );
}
