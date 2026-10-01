/**
 * Demo workspace for Hale & Sons Renovations, Bristol.
 * Every in-app screen and every marketing screenshot reads from here, so changing a
 * value updates the app and the screenshots together. Replace with DB queries in Phase 1.
 */
import type { PaymentStage, QuoteSection } from "./quote";

export const company = {
  name: "Hale & Sons",
  legalName: "Hale & Sons Renovations",
  initials: "H&S",
  place: "Renovations · Bristol",
  vatNumber: "GB 284 1193 07",
  brandColour: "#2B3A33",
};

export const currentUser = { name: "James Hale", initials: "JH", role: "Owner" };

export const VAT_RATE = 2000; // 20% in bps
export const DEFAULT_MARKUP = 1500;

export const quote = {
  number: "Q-1042",
  title: "Kitchen extension & rear knock-through",
  status: "Draft",
  client: "Sarah & Ben Okafor",
  clientFirstNames: "Sarah and Ben",
  siteShort: "14 Elm Road, Bristol BS6",
  siteAddress: "14 Elm Road, Bristol",
  validUntil: "5 Nov 2026",
  link: "builderos.app/q/hale-sons/1042",
  intro:
    "Hi Sarah and Ben — thanks for having us round on Thursday. Here's everything we talked through, priced line by line. Tap any section to see the detail, and leave a comment if anything's unclear.",
};

const line = (
  id: string,
  name: string,
  qty: number,
  unit: string,
  ratePounds: number,
  markupPct: number,
  note?: string,
  attachment?: string,
) => ({ id, name, qty, unit, rate: Math.round(ratePounds * 100), markup: markupPct * 100, note, attachment });

export const quoteSections: QuoteSection[] = [
  {
    id: "1",
    name: "Groundworks & foundations",
    lines: [
      line("1.1", "Excavate strip foundations, 600×900mm", 14, "m", 68, 15),
      line("1.2", "Concrete foundations, C25 ready-mix", 6.2, "m³", 145, 15),
      line("1.3", "Remove spoil, 8yd grab lorry", 3, "load", 320, 10),
      line("1.4", "Blockwork to DPC, trench blocks", 12, "m²", 72, 15),
    ],
  },
  {
    id: "2",
    name: "Structure & envelope",
    lines: [
      line(
        "2.1",
        "Steel beam 203×133 UB, supply & fit",
        1,
        "item",
        1850,
        12,
        "Sized to engineer calc SE-114. Includes padstones, propping and Building Control inspection.",
        "SE-114-calcs.pdf",
      ),
      line("2.2", "Cavity wall, facing brick to match existing", 28, "m²", 165, 15),
      line("2.3", "Warm flat roof, EPDM membrane", 22, "m²", 138, 15),
      line("2.4", "Roof lantern 2.5 × 1.0m, aluminium", 1, "item", 2400, 8),
    ],
  },
  {
    id: "3",
    name: "Kitchen installation",
    lines: [
      line("3.1", "Fit kitchen units (client supplied)", 1, "job", 3200, 0),
      line(
        "3.2",
        "Quartz worktops, template & fit",
        1,
        "PC sum",
        2850,
        10,
        "Provisional sum — final price once you pick the slab at the showroom.",
      ),
      line("3.3", "Tiled splashback, porcelain", 4.5, "m²", 58, 15),
    ],
  },
  {
    id: "4",
    name: "Electrics & heating",
    lines: [
      line("4.1", "First & second fix electrics, 14 points", 1, "job", 2100, 15),
      line("4.2", "Wet underfloor heating, manifold & screed", 24, "m²", 85, 15),
    ],
  },
];

export const paymentPlan: PaymentStage[] = [
  { label: "Deposit on booking", share: 2000 },
  { label: "Groundworks complete", share: 3000 },
  { label: "Watertight", share: 3000 },
  { label: "Practical completion", share: 2000 },
];

export const targetMargin = 2200;

/* ── Service library ─────────────────────────────────────────── */

export type Service = {
  id: string;
  category: string;
  kind: "service" | "bundle";
  bundleCount?: number;
  name: string;
  description: string;
  rate: number; // pence
  unit: string;
  usedIn: number;
};

export const serviceCategories = [
  "Groundworks",
  "Structural",
  "Kitchens",
  "Bathrooms",
  "Electrical",
  "Plumbing & heating",
  "Plastering",
  "Decorating",
  "Flooring",
];

/** Category counts include services not shown in the demo grid. */
export const serviceCategoryCounts: Record<string, number> = {
  "All services": 142,
  Groundworks: 18,
  Structural: 14,
  Kitchens: 22,
  Bathrooms: 26,
  Electrical: 17,
  "Plumbing & heating": 15,
  Plastering: 9,
  Decorating: 11,
  Flooring: 10,
};

const svc = (
  id: string,
  category: string,
  kind: Service["kind"],
  name: string,
  description: string,
  ratePounds: number,
  unit: string,
  usedIn: number,
  bundleCount?: number,
): Service => ({ id, category, kind, name, description, rate: Math.round(ratePounds * 100), unit, usedIn, bundleCount });

export const services: Service[] = [
  svc("s1", "Bathrooms", "bundle", "Standard bathroom refit", "Strip out, first fix, tiling to 1.2m, sanitaryware fit, second fix.", 6850, "job", 41, 9),
  svc("s2", "Plastering", "service", "Plaster skim, walls", "Bead, scrim and two-coat skim finish to existing board.", 14, "m²", 88),
  svc("s3", "Structural", "service", "Steel beam supply & fit", "Up to 4m span, padstones, propping and BC sign-off.", 1850, "item", 26),
  svc("s4", "Kitchens", "bundle", "Kitchen fit (client supplied)", "Units, worktop prep, appliances, plinths and end panels.", 3200, "job", 34, 6),
  svc("s5", "Electrical", "service", "Double socket, new circuit", "Chased in, 2.5mm T&E, back box, faceplate and test.", 145, "point", 62),
  svc("s6", "Flooring", "service", "Engineered oak, glue down", "Includes levelling compound and scotia. Labour only.", 38, "m²", 19),
  svc("s7", "Groundworks", "service", "Strip foundations", "600×900mm trench, C25 concrete, spoil removal extra.", 68, "m", 22),
  svc("s8", "Decorating", "service", "Mist & two coats, walls", "Contract matt mist coat, two finish coats, light prep.", 9.5, "m²", 57),
  svc("s9", "Plumbing & heating", "service", "Combi boiler swap", "Like-for-like, flush, filter, Gas Safe certificate.", 2450, "job", 15),
  svc("s10", "Plastering", "service", "Plasterboard & skim, ceilings", "Board, tape and skim to new or replaced ceilings.", 24.5, "m²", 31),
  svc("s11", "Plastering", "service", "Bonding coat & skim, patch repair", "Bonding coat to make good chases and damaged areas.", 19, "m²", 27),
];

/* ── Dashboard ───────────────────────────────────────────────── */

export const dashboard = {
  greeting: "Good morning, James",
  date: "Tuesday 6 October · 3 site visits today",
  kpis: [
    { label: "Open pipeline", value: "£184,200", sub: "↑ 12.4% vs September", tone: "success" as const },
    { label: "Quotes awaiting reply", value: "£62,450", sub: "9 quotes · 3 opened today", tone: "subtle" as const },
    { label: "Due in next 7 days", value: "£21,800", sub: "4 stage payments", tone: "subtle" as const },
    { label: "Overdue", value: "£3,120", sub: "INV-0227 · 6 days late", tone: "danger" as const },
  ],
  /** £k invoiced and collected per month, Nov → Oct. */
  chart: {
    months: ["N", "D", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O"],
    invoiced: [28, 34, 31, 40, 38, 46, 52, 49, 58, 61, 57, 66],
    collected: [26, 30, 30, 36, 37, 41, 50, 46, 52, 58, 55, 48],
    max: 70,
  },
  upcoming: [
    { dow: "Thu", day: "8", who: "Okafor · Elm Road", stage: "Groundworks complete", amount: "£8,713" },
    { dow: "Fri", day: "9", who: "Patel · Cotham Hill", stage: "Second fix", amount: "£6,240" },
    { dow: "Tue", day: "13", who: "Morgan · Ashley Down", stage: "Completion", amount: "£2,910" },
    { dow: "Wed", day: "14", who: "Reid · Redland Grove", stage: "Final 10%", amount: "£3,937" },
  ],
  projects: [
    { name: "Kitchen extension", address: "14 Elm Road, BS6", stage: "Structure", progress: 42, value: "£34,850", margin: "24%" },
    { name: "Loft conversion", address: "7 Cotham Hill, BS6", stage: "Second fix", progress: 68, value: "£52,400", margin: "21%" },
    { name: "Bathroom refit", address: "22 Ashley Down Rd, BS7", stage: "Snagging", progress: 92, value: "£14,550", margin: "27%" },
    { name: "Full renovation", address: "3 Sion Hill, Clifton", stage: "Strip out", progress: 12, value: "£118,000", margin: "19%" },
  ],
};

/* ── Project board ───────────────────────────────────────────── */

export type Tone = "grey" | "green" | "amber" | "blue" | "brand" | "red";

export const avatarTints: Record<string, string> = {
  JH: "#E6E1D8",
  DR: "#DCE5DF",
  MK: "#E3E0EE",
  AL: "#E9E3D6",
};

export type BoardCard = {
  id: string;
  title: string;
  tag: string;
  tone: Tone;
  due: string;
  subtasks: string;
  who: keyof typeof avatarTints;
  photo?: boolean;
  highlight?: boolean;
};

export type BoardColumn = { id: string; name: string; dot: string; cards: BoardCard[] };

export const project = {
  slug: "elm-road",
  title: "14 Elm Road — Kitchen extension",
  status: "On track",
  meta: "Okafor · 12 Oct → 18 Dec · £34,850 contract",
  crew: ["JH", "DR", "MK", "AL"],
  tabs: [
    { label: "Board" },
    { label: "Timeline" },
    { label: "Photos", count: 48 },
    { label: "Variations", count: 3 },
    { label: "Files", count: 12 },
    { label: "Payments" },
  ],
};

export const boardColumns: BoardColumn[] = [
  {
    id: "next",
    name: "Up next",
    dot: "#C9C8C2",
    cards: [
      { id: "c1", title: "Order roof lantern, 6 wk lead", tag: "Procurement", tone: "grey", due: "9 Oct", subtasks: "0/2", who: "JH" },
      { id: "c2", title: "Book Building Control: foundations", tag: "Compliance", tone: "blue", due: "12 Oct", subtasks: "0/1", who: "JH" },
    ],
  },
  {
    id: "week",
    name: "This week",
    dot: "#2F5DA8",
    cards: [
      { id: "c3", title: "Dig & pour strip foundations", tag: "Groundworks", tone: "grey", due: "8 Oct", subtasks: "1/4", who: "DR" },
      { id: "c4", title: "Blockwork to DPC", tag: "Groundworks", tone: "grey", due: "10 Oct", subtasks: "0/3", who: "MK" },
    ],
  },
  {
    id: "doing",
    name: "In progress",
    dot: "#93630F",
    cards: [
      { id: "c5", title: "Set out & excavate", tag: "Groundworks", tone: "grey", due: "Today", subtasks: "3/4", who: "DR", photo: true },
      { id: "c6", title: "Move island socket 600mm", tag: "Variation V-03", tone: "brand", due: "14 Oct", subtasks: "0/1", who: "AL", highlight: true },
    ],
  },
  {
    id: "client",
    name: "Waiting on client",
    dot: "oklch(0.66 0.17 42)",
    cards: [
      { id: "c7", title: "Choose worktop slab", tag: "Client", tone: "amber", due: "16 Oct", subtasks: "—", who: "JH" },
      { id: "c8", title: "Confirm bi-fold RAL colour", tag: "Client", tone: "amber", due: "18 Oct", subtasks: "—", who: "JH" },
    ],
  },
  {
    id: "done",
    name: "Done",
    dot: "#2F7A4B",
    cards: [
      { id: "c9", title: "Party wall notice served", tag: "Compliance", tone: "green", due: "28 Sep", subtasks: "2/2", who: "JH" },
      { id: "c10", title: "Strip out & skip", tag: "Prep", tone: "green", due: "5 Oct", subtasks: "4/4", who: "MK" },
    ],
  },
];

/* ── Payments ────────────────────────────────────────────────── */

export const paymentsOverview = {
  subtitle: "14 Elm Road · contract £34,850 + £2,280 approved variations",
  collected: "£16,124",
  of: "£37,130",
  stages: [
    { label: "Deposit", amount: "£7,426", status: "Paid 2 Oct", tone: "success" as const, share: 20, fill: "paid" as const },
    { label: "Groundworks", amount: "£10,959", status: "Invoiced · due 14 Oct", tone: "warning" as const, share: 30, fill: "invoiced" as const },
    { label: "Watertight", amount: "£10,455", status: "Scheduled", tone: "subtle" as const, share: 30, fill: "scheduled" as const },
    { label: "Completion", amount: "£5,800", status: "Scheduled", tone: "subtle" as const, share: 14, fill: "scheduled" as const },
    { label: "Variations", amount: "£2,280", status: "2 approved", tone: "brand" as const, share: 6, fill: "variation" as const },
  ],
};

export type InvoiceStatus = "Paid" | "Due" | "Overdue" | "Draft";

export type Invoice = {
  number: string;
  what: string;
  who: string;
  amount: string;
  status: InvoiceStatus;
  due: string;
  billedTo: string[];
  lines: { label: string; amount: string }[];
  vat: string;
  total: string;
};

const okafor = ["Sarah & Ben Okafor", "14 Elm Road, Bristol BS6 5AB"];

export const invoices: Invoice[] = [
  {
    number: "INV-0231",
    what: "Groundworks complete + V-01",
    who: "Okafor · Elm Road",
    amount: "£10,959",
    status: "Due",
    due: "Due 14 Oct 2026",
    billedTo: okafor,
    lines: [
      { label: "Stage 2 · Groundworks complete (30%)", amount: "£8,712.75" },
      { label: "V-01 · Extra double socket run", amount: "£420.00" },
    ],
    vat: "£1,826.55",
    total: "£10,959.30",
  },
  {
    number: "INV-0229",
    what: "Second fix",
    who: "Patel · Cotham Hill",
    amount: "£6,240",
    status: "Due",
    due: "Due 9 Oct 2026",
    billedTo: ["Raj Patel", "7 Cotham Hill, Bristol BS6 6LA"],
    lines: [{ label: "Stage 3 · Second fix (25%)", amount: "£5,200.00" }],
    vat: "£1,040.00",
    total: "£6,240.00",
  },
  {
    number: "INV-0227",
    what: "Completion",
    who: "Hughes · Westbury Park",
    amount: "£3,120",
    status: "Overdue",
    due: "Due 30 Sep 2026",
    billedTo: ["Daniel Hughes", "41 Westbury Park, Bristol BS6 7JW"],
    lines: [{ label: "Stage 4 · Practical completion (10%)", amount: "£2,600.00" }],
    vat: "£520.00",
    total: "£3,120.00",
  },
  {
    number: "INV-0226",
    what: "Deposit",
    who: "Okafor · Elm Road",
    amount: "£7,426",
    status: "Paid",
    due: "Paid 2 Oct 2026",
    billedTo: okafor,
    lines: [{ label: "Stage 1 · Deposit on booking (20%)", amount: "£6,188.33" }],
    vat: "£1,237.67",
    total: "£7,426.00",
  },
  {
    number: "INV-0224",
    what: "First fix",
    who: "Morgan · Ashley Down",
    amount: "£4,365",
    status: "Paid",
    due: "Paid 22 Sep 2026",
    billedTo: ["Fiona Morgan", "22 Ashley Down Rd, Bristol BS7 9JN"],
    lines: [{ label: "Stage 2 · First fix (30%)", amount: "£3,637.50" }],
    vat: "£727.50",
    total: "£4,365.00",
  },
  {
    number: "INV-0232",
    what: "Watertight",
    who: "Okafor · Elm Road",
    amount: "£10,455",
    status: "Draft",
    due: "Not sent",
    billedTo: okafor,
    lines: [{ label: "Stage 3 · Watertight (30%)", amount: "£8,712.75" }],
    vat: "£1,742.55",
    total: "£10,455.30",
  },
];

/* ── CRM ─────────────────────────────────────────────────────── */

export type Deal = { name: string; job: string; value: string; source: string; next: string; late?: boolean };
export type DealStage = { name: string; dot: string; total: string; deals: Deal[] };

export const pipeline = {
  summary: "23 open enquiries · £412,600 potential",
  filters: ["All owners", "Any source", "Last 90 days"],
  stages: [
    {
      name: "New enquiry",
      dot: "#C9C8C2",
      total: "£96,000",
      deals: [
        { name: "Priya Shah", job: "Side return extension", value: "£45k", source: "Website", next: "Call today", late: true },
        { name: "Tom & Ella Price", job: "Bathroom refit", value: "£12k", source: "Referral", next: "Reply" },
        { name: "G. Whitfield", job: "Garage conversion", value: "£28k", source: "Instagram", next: "Reply" },
      ],
    },
    {
      name: "Site visit",
      dot: "#2F5DA8",
      total: "£134,500",
      deals: [
        { name: "Laura Bennett", job: "Loft dormer", value: "£58k", source: "Referral", next: "Thu 10:00" },
        { name: "The Adeyemis", job: "Kitchen + utility", value: "£34k", source: "Website", next: "Fri 14:30" },
      ],
    },
    {
      name: "Quote sent",
      dot: "#93630F",
      total: "£112,350",
      deals: [
        { name: "Sarah & Ben Okafor", job: "Kitchen extension", value: "£34.9k", source: "Referral", next: "Opened 3×" },
        { name: "M. Kowalski", job: "Full rewire", value: "£9.8k", source: "Website", next: "Chase Mon", late: true },
        { name: "Hannah Lloyd", job: "Wet room", value: "£16k", source: "Repeat", next: "Opened 1×" },
      ],
    },
    {
      name: "Negotiating",
      dot: "oklch(0.66 0.17 42)",
      total: "£69,750",
      deals: [
        { name: "Chris Doyle", job: "Rear extension", value: "£61k", source: "Referral", next: "Revised Q" },
        { name: "Ana Ruiz", job: "En-suite", value: "£8.7k", source: "Website", next: "Wed" },
      ],
    },
    {
      name: "Won",
      dot: "#2F7A4B",
      total: "£186,300",
      deals: [
        { name: "Raj Patel", job: "Loft conversion", value: "£52.4k", source: "Referral", next: "Started" },
        { name: "Fiona Morgan", job: "Bathroom refit", value: "£14.6k", source: "Repeat", next: "Started" },
      ],
    },
  ] satisfies DealStage[],
};

/* ── Employee app ────────────────────────────────────────────── */

export const employeeDay = {
  date: "Tuesday 6 October",
  greeting: "Morning, Dan",
  initials: "DR",
  site: "14 Elm Road, Bristol",
  hours: "8:00 – 16:30",
  job: "Kitchen extension · with Marek",
  tasks: [
    { id: "t1", title: "Set out & excavate trenches", meta: "Elm Road · with Marek", done: true },
    { id: "t2", title: "Photos of open trench for BC", meta: "Upload before 11:00", done: true },
    { id: "t3", title: "Pour strip foundations", meta: "Concrete booked 13:00", done: false },
    { id: "t4", title: "Clear spoil to grab lorry", meta: "Lorry 15:30", done: false },
    { id: "t5", title: "Daily site diary", meta: "Before you leave", done: false },
  ],
  variation: { ref: "V-03", text: "Move the island socket 600mm left before first fix." },
};
