import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import {
  ArrowRight,
  Camera,
  ChartColumn,
  Check,
  Contact,
  Dot,
  Download,
  FileDiff,
  FileSpreadsheet,
  Globe,
  HardHat,
  Library,
  PenLine,
  Receipt,
  Search,
  Send,
  SquareKanban,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { Logo, Placeholder } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Design guidelines",
  description: "How Builder OS looks, sounds and behaves: logo, colour, type, components, UK formats, voice and tokens.",
  robots: { index: false },
};

const toc = [
  ["brand", "Brand & logo"],
  ["colour", "Colour"],
  ["type", "Typography"],
  ["layout", "Space, radius & elevation"],
  ["components", "Core components"],
  ["icons", "Icons & imagery"],
  ["data", "Numbers & UK formats"],
  ["voice", "Voice & tone"],
  ["motion", "Motion & accessibility"],
  ["tokens", "Tokens for shadcn/ui"],
];

const principles = [
  ["01", "Faster than Excel", "Keyboard first. If it takes longer than a spreadsheet, it's a bug."],
  ["02", "Their brand, not ours", "Client-facing surfaces put the contractor's name first."],
  ["03", "Money is legible", "Totals, margins and due dates are always one glance away."],
  ["04", "Quiet by default", "Ink and warm greys. Colour only means something."],
];

const logoRules: [boolean, string][] = [
  [true, "Clear space equals the height of one course on every side."],
  [true, "Minimum size 16px for the mark, 80px wide for the lockup."],
  [false, "Don't recolour the courses, rotate the mark or add effects."],
  [false, "Don't put the mark on photography without a solid tile behind it."],
];

const neutrals = [
  ["Ink", "#111110", "Text, primary buttons, dark sections"],
  ["Ink 2", "#5C5B57", "Body copy, secondary text"],
  ["Subtle", "#8A8984", "Metadata, placeholders"],
  ["Faint", "#C9C8C2", "Disabled icons, empty dots"],
  ["Input", "#E2E1DC", "Control rings"],
  ["Border", "#E8E7E3", "Card rings, dividers"],
  ["Line", "#F1F0ED", "Row dividers, chips"],
  ["Muted", "#F6F5F2", "Tinted wells, tags"],
  ["Surface", "#FAFAF9", "Page & sidebar"],
  ["White", "#FFFFFF", "Cards, app canvas"],
];

const statusColours = [
  ["Brand", "oklch(0.66 0.17 42)", "#FCEBE2", "Variation", "Selection, live dots, variations"],
  ["Success", "#2F7A4B", "#E8F3EC", "Paid", "Paid, accepted, on track"],
  ["Warning", "#93630F", "#FBF1DE", "Due", "Due soon, awaiting client"],
  ["Danger", "#B13B22", "#FBE9E5", "Overdue", "Overdue, destructive"],
  ["Info", "#2F5DA8", "#E7EEF9", "Booked", "Scheduled, compliance"],
];

const typeScale: [string, string, string, string][] = [
  ["Display", "78 / 1.0 · 600 · −4.5%", "text-[56px] leading-none font-semibold tracking-[-0.045em]", "Quotes that win."],
  ["H1", "64 / 1.0 · 600 · −4.5%", "text-[44px] leading-none font-semibold tracking-[-0.045em]", "One price per company"],
  ["H2", "48 / 1.05 · 600 · −3.5%", "text-[34px] leading-[1.05] font-semibold tracking-[-0.035em]", "After the yes"],
  ["H3", "19–24 · 600 · −2%", "text-[22px] font-semibold tracking-[-0.02em]", "Kitchen extension & rear knock-through"],
  ["Lead", "18 / 1.55 · 400", "text-lg leading-[1.55] text-ink-2", "Spreadsheet-fast quoting for renovation firms."],
  ["Body", "16 / 1.6 · 400", "text-base leading-[1.6] text-ink-3", "Clients open your quote on any device and sign in two taps."],
  ["App body", "13 / 1.4 · 400–500", "text-[13px] leading-[1.4]", "Excavate strip foundations, 600×900mm"],
  ["Caption", "11.5–12 · 500", "text-xs font-medium text-subtle", "Saved just now · 3 opened today"],
  ["Mono", "11.5–12.5 · 400", "font-mono text-[12.5px] text-ink-2", "INV-0231 · builderos.app/q/1042"],
];

const spacing = [
  ["4", 4, "icon gap"],
  ["8", 8, "control gap"],
  ["12", 12, "card grid gap"],
  ["16", 16, "card padding (app)"],
  ["24", 24, "page gutter (app)"],
  ["32", 32, "card padding (mktg)"],
  ["64", 64, "block spacing"],
  ["128", 128, "section spacing"],
] as const;

const radii = [
  ["5px", "tags"],
  ["8px", "buttons, inputs"],
  ["10px", "cards (app)"],
  ["14px", "screens, panels"],
  ["20px", "cards (mktg)"],
  ["999px", "pills, avatars"],
];

const shadows = [
  ["Ring", "shadow-ring", "Default edge for every card & control"],
  ["Card", "shadow-card", "Resting cards"],
  ["Popover", "shadow-pop", "Menus, autocomplete, notes"],
  ["Screenshot", "shadow-shot", "Product shots on marketing"],
];

const compRules = [
  ["Primary button", "Ink fill, white text. One per view. Marketing adds a soft drop shadow and a trailing arrow."],
  ["Secondary button", "White with a 1px ring. Use for PDF, Library, Preview and other supporting actions."],
  ["Status pill", "Fully rounded, soft fill + strong text from the same hue. Words, not colours alone."],
  ["Tables & grids", "Row height 34px, header 32px on a #FCFCFB well. Money right-aligned, codes in mono."],
  ["Sidebar nav", "32px rows. Active = white tile with ring. Counts in Subtle, never red badges."],
  ["Empty states", "One line of what's missing, one button to fix it. No illustrations."],
];

const icons = [
  [FileSpreadsheet, "Quotes"],
  [Library, "Library"],
  [FileDiff, "Variations"],
  [SquareKanban, "Projects"],
  [Receipt, "Payments"],
  [Contact, "Clients"],
  [HardHat, "Team"],
  [ChartColumn, "Reports"],
  [Globe, "Client portal"],
  [Camera, "Photos"],
  [StickyNote, "Line note"],
  [PenLine, "Sign"],
] as const;

const formats = [
  ["Currency", "£34,851.36 · £1,850", "$34851.36 · 34851 GBP"],
  ["Compact money", "£34.9k (cards only)", "£34,9K · 34.9K£"],
  ["Dates", "14 Oct 2026 · Tue 6 Oct", "10/14/2026 · 2026-10-14"],
  ["Times", "09:30 · 16:30", "9:30am · 4:30 PM"],
  ["Percentages", "20% · 24% margin", "20 % · .2"],
  ["Units", "m · m² · m³ · item · job", "sqm · M2 · units"],
  ["References", "Q-1042 · INV-0231 · V-03", "quote #1042 · Inv231"],
  ["VAT", "+ VAT · inc. VAT · VAT 20%", "+tax · incl. sales tax"],
  ["Addresses", "14 Elm Road, Bristol BS6 5AB", "14 Elm Rd., Bristol"],
];

const voice = [
  ["Warm", "not chummy", "Talk like a good site manager: friendly, direct, respectful of their time."],
  ["Plain", "not dumbed-down", "Short words, short sentences. Trade terms are fine. SaaS jargon isn't."],
  ["Confident", "not hype", 'Say what it does. No "revolutionary", "seamless", "supercharge".'],
  ["British", "not twee", 'UK spelling, £, VAT. No forced slang or "cheeky" jokes.'],
];

const copy = [
  ["Headline", "Quotes that win the job, built in minutes.", "Supercharge your quoting workflow with AI-powered efficiency"],
  ["Button", "Send quote", "Submit"],
  ["Empty state", "No quotes yet. Start one from a past job or the library.", "Oops! Nothing to see here 🙈"],
  ["Error", "We couldn't send that. Check the client's email and try again.", "Error 422: Unprocessable entity"],
  ["Success toast", "Sent to Sarah. We'll tell you when she opens it.", "Success! Your quote was sent successfully!"],
  ["Client-facing", "Here's everything we talked through, priced line by line.", "Please find attached the quotation as discussed."],
  ["Reminder email", "A quick nudge: stage 2 (£10,959) was due on 14 Oct.", "FINAL NOTICE: Payment overdue"],
  ["Upgrade prompt", "Projects come with Pro. Try it free for 14 days.", "Unlock premium features now!"],
];

const copyRules = [
  "Sentence case everywhere: headings, buttons, menu items.",
  'Use "you" and "your clients". We say "we" on marketing, never inside the product UI.',
  'Lead with the outcome, then the feature: "Get paid on time with stage payments".',
  "Numbers as numerals: 3 quotes, 14 days, £49.",
  "No exclamation marks in product UI. One per page max on marketing, ideally none.",
  "No emoji in product or marketing.",
];

const a11y = [
  ["Durations", "120ms for hover/press, 200ms for popovers and drawers, ease-out. Nothing loops."],
  ["What moves", "Opacity and small translate/scale only. No parallax, no bouncing numbers."],
  ["Reduced motion", "Respect prefers-reduced-motion: remove transitions, keep state changes instant."],
  ["Focus", "2px Ink ring + 4px 8% Ink halo on every focusable element. Never remove outlines."],
  ["Targets", "32px minimum in the dense app, 44px in the employee app and client portal (used on phones, often with gloves)."],
  ["Colour alone", "Status always pairs colour with a word or icon. The orange selection ring is backed by an aria-selected cell."],
];

const card = "rounded-[14px] bg-white shadow-ring";

function Section({ id, n, title, intro, children, last }: { id: string; n: string; title: string; intro?: React.ReactNode; children: React.ReactNode; last?: boolean }) {
  return (
    <section id={id} className={last ? "scroll-mt-6 pt-16" : "scroll-mt-6 border-b border-hairline py-16"}>
      <div className="font-mono text-[12.5px] text-subtle">{n}</div>
      <h2 className="mt-2 mb-3 text-[32px] leading-[1.1] font-semibold tracking-[-0.035em]">{title}</h2>
      {intro && <p className="mb-7 max-w-[640px] text-base leading-[1.6] text-ink-2">{intro}</p>}
      {children}
    </section>
  );
}

export default async function DesignGuidelinesPage() {
  // Show the real tokens file so this page can never drift from the code.
  const css = await readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const tokensCss = css.slice(0, css.indexOf("@layer base")).trimEnd();

  return (
    <div className="flex min-h-screen bg-surface text-ink">
      <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col gap-7 overflow-y-auto border-r border-hairline px-5 py-7 min-[1000px]:flex">
        <Logo textClassName="text-base" />
        <nav className="flex flex-col gap-0.5" aria-label="Sections">
          <div className="mb-2 font-mono text-[11.5px] text-subtle">Design guidelines · v1.0</div>
          {toc.map(([id, label], i) => (
            <a key={id} href={`#${id}`} className="flex gap-2.5 rounded-[7px] px-2 py-1.5 text-sm text-ink-3 hover:bg-accent hover:text-ink">
              <span className="w-[18px] pt-0.5 font-mono text-[11.5px] text-faint-2">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-[clamp(20px,5vw,72px)] pb-[120px]">
        <div className="mx-auto max-w-[960px]">
          <header className="border-b border-hairline pt-[72px] pb-14">
            <div className="font-mono text-[12.5px] text-subtle">Builder OS · Design guidelines · October 2026</div>
            <h1 className="mt-4 text-[clamp(40px,5.4vw,64px)] leading-none font-semibold tracking-[-0.045em] text-balance">Calm software for people who build things.</h1>
            <p className="mt-5 max-w-[640px] text-lg leading-[1.6] text-ink-2">
              This is the single source of truth for how Builder OS looks, sounds and behaves, on the marketing site, in the app and in the documents our customers send their clients. If something isn&apos;t covered here, pick the quieter option.
            </p>
            <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              {principles.map(([n, t, b]) => (
                <div key={n} className={`${card} p-[18px]`}>
                  <div className="font-mono text-[11.5px] text-subtle">{n}</div>
                  <div className="mt-2.5 text-[15.5px] font-semibold tracking-[-0.01em]">{t}</div>
                  <div className="mt-1 text-sm leading-normal text-ink-2">{b}</div>
                </div>
              ))}
            </div>
          </header>

          <Section
            id="brand"
            n="01"
            title="Brand & logo"
            intro="The mark is three courses of brickwork in a rounded square: a full course, a stretcher bond with an offset joint, and a single orange course at the base. It stands for the job being built up in layers, and it reads at 16px."
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
              <div className="flex h-[200px] items-center justify-center rounded-2xl bg-white shadow-ring">
                <Logo size="xl" />
              </div>
              <div className="flex h-[200px] items-center justify-center rounded-2xl bg-ink">
                <Logo size="xl" inverse />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {logoRules.map(([ok, t]) => (
                <div key={t} className={`${card} flex gap-2.5 px-[18px] py-4`}>
                  {ok ? <Check className="mt-0.5 size-4 flex-none text-success" /> : <X className="mt-0.5 size-4 flex-none text-danger" />}
                  <div className="text-sm leading-normal text-ink-3">{t}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[14px] bg-muted px-[18px] py-4 text-[14.5px] leading-[1.55] text-ink-3">
              <b className="font-semibold">Name &amp; tagline.</b> Always &ldquo;Builder OS&rdquo;: two words, capital B, capital O and S. Never &ldquo;BuilderOS&rdquo; or &ldquo;Builder O.S.&rdquo;. Primary line: <i>Quotes that win the job, built in minutes.</i> Descriptor: <i>The operating system for UK renovation companies.</i>
            </div>
          </Section>

          <Section
            id="colour"
            n="02"
            title="Colour"
            intro="Warm, near-neutral greys with a single ink colour. Orange is our only brand accent. Use it like a highlighter, not a paint roller: for the selected cell, a live notification dot, one course of the logo. Never use it for large fills or primary buttons."
          >
            <h3 className="mb-3 text-[15px] font-semibold">Neutrals</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {neutrals.map(([name, hex, use]) => (
                <div key={name} className="overflow-hidden rounded-xl bg-white shadow-ring">
                  <div className="h-[72px] shadow-[inset_0_-1px_0_rgb(16_16_15/0.06)]" style={{ background: hex }} />
                  <div className="px-3 py-2.5">
                    <div className="text-[13.5px] font-semibold">{name}</div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-ink-2">{hex}</div>
                    <div className="mt-1 text-xs leading-[1.4] text-subtle">{use}</div>
                  </div>
                </div>
              ))}
            </div>
            <h3 className="mt-7 mb-3 text-[15px] font-semibold">Accent &amp; status</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
              {statusColours.map(([name, fg, bg, pill, use]) => (
                <div key={name} className="flex flex-col gap-2.5 rounded-xl bg-white p-3 shadow-ring">
                  <div className="flex gap-1.5">
                    <div className="h-11 flex-1 rounded-lg" style={{ background: fg }} />
                    <div className="h-11 flex-1 rounded-lg shadow-[inset_0_0_0_1px_rgb(16_16_15/0.04)]" style={{ background: bg }} />
                  </div>
                  <span className="self-start rounded-full px-[9px] py-0.5 text-xs font-medium" style={{ background: bg, color: fg }}>
                    {pill}
                  </span>
                  <div>
                    <div className="text-[13.5px] font-semibold">{name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-2">
                      {fg} · {bg}
                    </div>
                    <div className="mt-1 text-xs leading-[1.4] text-subtle">{use}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
              <div className="rounded-[14px] bg-ink p-5 text-night-ink">
                <div className="text-[14.5px] font-semibold text-white">Dark sections</div>
                <div className="mt-1.5 text-[13.5px] leading-[1.55] text-night-text">
                  Marketing only. One or two per page for rhythm. Surface #111110, raised #1B1B19, border #262624, body text #A3A29C, headings #FFFFFF.
                </div>
              </div>
              <div className={`${card} p-5`}>
                <div className="text-[14.5px] font-semibold">Contrast</div>
                <div className="mt-1.5 text-[13.5px] leading-[1.55] text-ink-2">
                  Body text is Ink 2 (#5C5B57) or darker on light surfaces, which passes 4.5:1 on white. Muted #8A8984 is for metadata at 12px+ only, never for anything someone needs to act on.
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="type"
            n="03"
            title="Typography"
            intro={
              <>
                Two families. <b className="font-semibold text-ink">Geist</b> for everything. <b className="font-semibold text-ink">Geist Mono</b> for codes, references, URLs and section eyebrows. Headings are tight (negative tracking scales with size). Numbers in tables and totals always use tabular figures.
              </>
            }
          >
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
              <div className="rounded-2xl bg-white p-6 shadow-ring">
                <div className="text-[64px] leading-none font-semibold tracking-[-0.045em]">Aa</div>
                <div className="mt-3.5 font-semibold">Geist</div>
                <div className="text-[13.5px] text-ink-2">400 · 500 · 600 · interface &amp; display</div>
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-ring">
                <div className="font-mono text-[56px] leading-[1.1]">Q-1042</div>
                <div className="mt-3.5 font-semibold">Geist Mono</div>
                <div className="text-[13.5px] text-ink-2">400 · 500 · references, codes, eyebrows</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-ring">
              {typeScale.map(([name, spec, cls, sample]) => (
                <div key={name} className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-4 border-b border-line px-[22px] py-4 last:border-0">
                  <div>
                    <div className="text-[13.5px] font-semibold">{name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-subtle">{spec}</div>
                  </div>
                  <div className={cls}>{sample}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="layout"
            n="04"
            title="Space, radius & elevation"
            intro="A 4px base grid. The app is dense (13px body, 32–36px controls). Marketing is airy (16–18px body, 112–128px between sections, 1200px max width). We draw edges with a 1px ring shadow instead of borders, so cards can sit edge to edge without doubling up."
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
              <div className="rounded-2xl bg-white p-[22px] shadow-ring">
                <div className="mb-3.5 text-[14.5px] font-semibold">Spacing scale</div>
                <div className="flex flex-col gap-2">
                  {spacing.map(([n, w, use]) => (
                    <div key={n} className="flex items-center gap-3 font-mono text-[11.5px] text-ink-2">
                      <span className="w-7">{n}</span>
                      <span className="h-2.5 rounded-[2px] bg-ink" style={{ width: w }} />
                      <span className="text-subtle">{use}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-[22px] shadow-ring">
                <div className="mb-3.5 text-[14.5px] font-semibold">Radius</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {radii.map(([v, use]) => (
                    <div key={v} className="flex flex-col items-center gap-1.5">
                      <div className="size-14 bg-line shadow-[inset_0_0_0_1px_#E2E1DC]" style={{ borderRadius: v }} />
                      <div className="font-mono text-[11px] text-ink-2">{v}</div>
                      <div className="text-center text-[11.5px] leading-[1.3] text-subtle">{use}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 rounded-2xl bg-muted p-7">
              {shadows.map(([name, cls, use]) => (
                <div key={name} className={`min-h-[90px] rounded-xl bg-white p-[18px] ${cls}`}>
                  <div className="text-[13.5px] font-semibold">{name}</div>
                  <div className="mt-1 text-xs leading-[1.4] text-subtle">{use}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="components" n="05" title="Core components" intro="Built on shadcn/ui, restyled to these tokens. One primary action per view. Everything else is secondary (white with a ring) or ghost.">
            <div className="flex flex-col gap-6 rounded-2xl bg-white p-6 shadow-ring">
              <div>
                <div className="mb-3 font-mono text-[12.5px] text-subtle">Buttons · app 32px / marketing 46px</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button>
                    <Send />
                    Send quote
                  </Button>
                  <Button variant="secondary">
                    <Download className="text-ink-2" />
                    PDF
                  </Button>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="destructive">
                    <Trash2 />
                    Delete
                  </Button>
                  <span className="mx-1.5 h-7 w-px bg-hairline" />
                  <Button size="lg" cta>
                    Start free
                    <ArrowRight />
                  </Button>
                  <Button size="lg" variant="outline">
                    Book a demo
                  </Button>
                </div>
              </div>
              <div>
                <div className="mb-3 font-mono text-[12.5px] text-subtle">Inputs, status pills, tags</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex h-[34px] w-[220px] items-center gap-2 rounded-md px-2.5 text-[13px] text-subtle shadow-ring-input">
                    <Search className="size-3.5" />
                    Search services
                  </span>
                  <span className="flex h-[34px] w-40 items-center rounded-md px-2.5 text-[13px] shadow-[0_0_0_1.5px_#111110,0_0_0_4px_rgb(16_16_15/0.08)]">plast|</span>
                  <Badge tone="grey">Draft</Badge>
                  <Badge tone="amber">Due</Badge>
                  <Badge tone="green">Paid</Badge>
                  <Badge tone="red">Overdue</Badge>
                  <Badge tone="brand" shape="tag">
                    Variation V-03
                  </Badge>
                  <Badge tone="muted" shape="tag" className="font-normal">
                    Referral
                  </Badge>
                </div>
              </div>
              <div>
                <div className="mb-3 font-mono text-[12.5px] text-subtle">Quote grid row: the selected cell gets the only orange ring on screen</div>
                <div className="overflow-hidden rounded-[10px] text-[13px] shadow-ring tabular">
                  <div className="grid h-8 grid-cols-[44px_minmax(0,1fr)_60px_56px_92px_104px] items-center border-b border-hairline bg-surface-2 pl-3 text-[11.5px] font-medium text-subtle">
                    <span>#</span>
                    <span>Item</span>
                    <span className="pr-2.5 text-right">Qty</span>
                    <span>Unit</span>
                    <span className="pr-2.5 text-right">Rate</span>
                    <span className="pr-3 text-right">Total</span>
                  </div>
                  <div className="grid h-[34px] grid-cols-[44px_minmax(0,1fr)_60px_56px_92px_104px] items-center bg-brand-tint pl-3">
                    <span className="font-mono text-[11.5px] text-subtle">2.1</span>
                    <span className="truncate">Steel beam 203×133 UB, supply &amp; fit</span>
                    <span className="pr-2.5 text-right">1</span>
                    <span className="text-subtle">item</span>
                    <span className="flex h-full items-center justify-end bg-white pr-2.5 shadow-[inset_0_0_0_2px_var(--color-brand)]">1,850.00</span>
                    <span className="pr-3 text-right font-medium">£2,072.00</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
              {compRules.map(([t, b]) => (
                <div key={t} className={`${card} px-[18px] py-4`}>
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="mt-1 text-[13.5px] leading-normal text-ink-2">{b}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="icons"
            n="06"
            title="Icons & imagery"
            intro="Lucide only, at 1.5px stroke (the shadcn default). 14–16px in the app, 20px in marketing feature tiles. Icons sit next to a label. They never replace one, except in universally understood controls (search, close, more)."
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
              {icons.map(([Icon, use]) => (
                <div key={use} className="flex flex-col items-center gap-2.5 rounded-xl bg-white px-2 py-4 shadow-ring">
                  <Icon className="size-5" strokeWidth={1.5} />
                  <span className="text-center text-[11.5px] text-ink-2">{use}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
              <Placeholder label="placeholder pattern" className="aspect-video rounded-[14px] shadow-ring" />
              <div className="flex flex-col gap-2.5 text-[14.5px] leading-[1.55] text-ink-3">
                <div>
                  <b className="font-semibold">Photography:</b> real UK sites, real trades, natural light. Half-finished work is welcome. No stock handshakes, hard-hat-and-clipboard poses or 3D renders.
                </div>
                <div>
                  <b className="font-semibold">Product shots:</b> always real screens from the app, framed in the browser chrome component. Never fake UI.
                </div>
                <div>
                  <b className="font-semibold">Until we have assets:</b> use the 135° stripe placeholder with a mono caption describing the shot.
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="data"
            n="07"
            title="Numbers, dates & UK formats"
            intro={
              <>
                Money is the product. Always use the <span className="font-mono text-sm">en-GB</span> locale and tabular figures, and right-align money in tables.
              </>
            }
          >
            <div className="overflow-hidden rounded-2xl bg-white shadow-ring">
              {formats.map(([k, yes, no]) => (
                <div key={k} className="grid grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b border-line px-[22px] py-[13px] text-sm last:border-0">
                  <span className="font-medium">{k}</span>
                  <span className="flex items-center gap-2 text-success tabular">
                    <Check className="size-3.5 flex-none" />
                    {yes}
                  </span>
                  <span className="flex items-center gap-2 text-danger tabular">
                    <X className="size-3.5 flex-none" />
                    {no}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="voice"
            n="08"
            title="Voice & tone"
            intro="We sound like a founder who's run jobs, writing to someone who's running one now: warm, plain-spoken and British. Confident without the hype. We know the trade's words (first fix, padstone, snagging) and we use them correctly."
          >
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              {voice.map(([t, not, b]) => (
                <div key={t} className={`${card} p-[18px]`}>
                  <div className="text-[15px] font-semibold">{t}</div>
                  <div className="mt-0.5 mb-2 text-[12.5px] text-subtle">{not}</div>
                  <div className="text-[13.5px] leading-normal text-ink-2">{b}</div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-ring">
              <div className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-hairline bg-surface-2 px-[22px] py-3 text-[12.5px] font-medium text-subtle">
                <span>Where</span>
                <span>Write this</span>
                <span>Not this</span>
              </div>
              {copy.map(([where, yes, no]) => (
                <div key={where} className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line px-[22px] py-3.5 text-sm leading-normal last:border-0">
                  <span className="font-medium">{where}</span>
                  <span>{yes}</span>
                  <span className="text-subtle line-through decoration-grip">{no}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
              {copyRules.map((r) => (
                <div key={r} className="flex gap-2.5 rounded-xl bg-muted px-4 py-3.5 text-sm leading-normal text-ink-3">
                  <Dot className="size-4 flex-none" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="motion" n="09" title="Motion & accessibility">
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
              {a11y.map(([t, b]) => (
                <div key={t} className={`${card} px-[18px] py-4`}>
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="mt-1 text-[13.5px] leading-normal text-ink-2">{b}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="tokens"
            n="10"
            title="Tokens for shadcn/ui"
            last
            intro={
              <>
                This is the live <span className="font-mono text-sm">src/app/globals.css</span> (Tailwind v4 + shadcn). Every shadcn component picks up the Builder OS look from it. Brand and status colours are extra tokens.
              </>
            }
          >
            <pre className="overflow-x-auto rounded-2xl bg-ink p-6 font-mono text-[12.5px] leading-[1.65] whitespace-pre text-night-ink">{tokensCss}</pre>
          </Section>
        </div>
      </main>
    </div>
  );
}
