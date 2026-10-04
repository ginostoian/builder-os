/**
 * Getting started: a guided path through Builder OS in chapters, from setting up the company to winning
 * more work. Steps tick themselves off from real data (a quote sent, an invoice raised), so the guide is
 * never out of step with what the company has actually done. A person can also skip a step that doesn't
 * apply to them. Steps a role can't do, or a plan doesn't include, are left out or shown locked.
 */
import { planHas, type Feature, type Plan } from "./plans";
import { can, type Permission, type Role } from "./roles";

/** What the company has done, read from its data (see `onboardingSignals`). */
export const SIGNALS = [
  "tour",
  "company_details",
  "logo",
  "bank_details",
  "team",
  "library",
  "bundle",
  "quote_created",
  "quote_sent",
  "quote_accepted",
  "payment_plan",
  "invoice",
  "online_payments",
  "project",
  "site_app",
  "variation",
  "costs",
  "lead",
  "enquiry_form",
  "online_booking",
  "automation",
] as const;
export type Signal = (typeof SIGNALS)[number];
export type Signals = Record<Signal, boolean>;

export type Step = {
  id: Signal;
  title: string;
  /** Why it matters, in one sentence. */
  why: string;
  /** How it works, in a few short lines. */
  how: string[];
  href: string;
  cta: string;
  needs: Permission;
  feature?: Feature;
};

export type Chapter = { id: string; title: string; summary: string; steps: Step[] };

export const CHAPTERS: Chapter[] = [
  {
    id: "basics",
    title: "Find your way around",
    summary: "A two-minute tour of where everything lives.",
    steps: [
      {
        id: "tour",
        title: "Take the tour",
        why: "See where quotes, jobs, money and your team live, and the shortcuts that save clicks all day.",
        how: ["The sidebar has every area of the business, in the order work flows.", "Press ⌘K (Ctrl K) anywhere to search or jump to a page.", "+ New starts a quote, lead, client or job from any screen."],
        href: "/app?tour=1",
        cta: "Start the tour",
        needs: "app.office",
      },
    ],
  },
  {
    id: "company",
    title: "Set up your company",
    summary: "What clients see on every quote and invoice.",
    steps: [
      {
        id: "company_details",
        title: "Add your company details",
        why: "Your trading name, VAT number and standard terms go on every quote, so you only type them once.",
        how: ["Settings → Company holds your name, VAT number and default markup.", "Your terms and conditions are added to the end of each quote.", "Changes apply to new quotes; sent ones keep what the client saw."],
        href: "/app/settings",
        cta: "Open company settings",
        needs: "settings.manage",
      },
      {
        id: "logo",
        title: "Add your logo",
        why: "Quotes, invoices, emails and the client portal carry your logo and brand colour.",
        how: ["Upload a PNG, JPEG or WebP in Settings → Company.", "Pick a brand colour for buttons and headings in client emails."],
        href: "/app/settings",
        cta: "Add your logo",
        needs: "settings.manage",
        feature: "branding",
      },
      {
        id: "bank_details",
        title: "Add your bank details",
        why: "Invoices show where to pay, and reminders chase late payers for you.",
        how: ["Settings → Payments holds the account name, sort code and account number.", "Set your usual payment terms (14 days, say) and turn reminders on or off."],
        href: "/app/settings/payments",
        cta: "Add bank details",
        needs: "settings.manage",
        feature: "invoicing",
      },
      {
        id: "team",
        title: "Invite your team",
        why: "Give the office, estimators and site leads their own login, with only what their role needs.",
        how: ["Settings → Team sends invitations by email.", "Roles decide who sees prices and margins: site staff never do.", "Workers and subcontractors without a login go on the Team page."],
        href: "/app/settings/team",
        cta: "Invite someone",
        needs: "team.manage",
        feature: "team",
      },
    ],
  },
  {
    id: "pricing",
    title: "Price your work",
    summary: "Build quotes in minutes from your own prices.",
    steps: [
      {
        id: "library",
        title: "Add services to your library",
        why: "Save the things you price again and again (labour, materials, fixed jobs) with your cost and markup.",
        how: ["Add services one at a time, or import a spreadsheet.", "Each has a unit (m², day, item), a cost rate and a markup.", "Change a price here and every new quote uses it."],
        href: "/app/library",
        cta: "Open the library",
        needs: "library.manage",
      },
      {
        id: "bundle",
        title: "Make a bundle",
        why: "Group services you always quote together, like a full bathroom, and add them in one click.",
        how: ["Click New bundle in the library and pick its services and quantities.", "Adding a bundle to a quote adds every line, ready to adjust."],
        href: "/app/library/new?kind=bundle",
        cta: "Make a bundle",
        needs: "library.manage",
        feature: "bundles",
      },
    ],
  },
  {
    id: "quoting",
    title: "Quote and win",
    summary: "From a blank page to a signed job.",
    steps: [
      {
        id: "quote_created",
        title: "Build your first quote",
        why: "Sections, lines from your library, notes for the client, and your margin worked out as you go.",
        how: ["Quotes → New quote, then pick a client (or add one).", "Add sections (Kitchen, Bathroom) and lines from your library.", "Margins show only to you; the client sees selling prices."],
        href: "/app/quotes/new",
        cta: "New quote",
        needs: "quotes.edit",
      },
      {
        id: "quote_sent",
        title: "Send it to the client",
        why: "The client gets a link to a clean, branded quote they can read on their phone.",
        how: ["Send emails a private link, or copy it to send by text or WhatsApp.", "You'll see when they open it, and any questions they leave.", "Edit and send again: they always see the latest version."],
        href: "/app/quotes",
        cta: "Go to quotes",
        needs: "quotes.edit",
      },
      {
        id: "quote_accepted",
        title: "Get it signed",
        why: "Clients accept online with a typed signature, so there's a clear record of what was agreed.",
        how: ["They accept or decline from the quote page in their portal.", "You get a notification the moment they decide.", "An accepted quote can become a project and its invoices."],
        href: "/app/quotes",
        cta: "See your quotes",
        needs: "quotes.edit",
      },
    ],
  },
  {
    id: "money",
    title: "Get paid",
    summary: "Deposits, stage payments and chasing, handled.",
    steps: [
      {
        id: "payment_plan",
        title: "Add a payment plan to a quote",
        why: "Agree the deposit and stage payments up front, so invoicing is one click when the time comes.",
        how: ["On a quote, open Payment plan and split the total by stage or percentage.", "The client sees and accepts the plan with the quote."],
        href: "/app/quotes",
        cta: "Open a quote",
        needs: "quotes.edit",
        feature: "invoicing",
      },
      {
        id: "invoice",
        title: "Raise an invoice",
        why: "Turn a payment from the plan into an invoice, emailed with your bank details.",
        how: ["Payments lists what's due from every accepted quote.", "Raise it, and the client gets an email and a portal link.", "Reminders go before and after the due date until it's paid."],
        href: "/app/payments",
        cta: "Go to payments",
        needs: "invoices.manage",
        feature: "invoicing",
      },
      {
        id: "online_payments",
        title: "Take payments online",
        why: "Clients pay by card or bank straight from the invoice, and it's marked paid for you.",
        how: ["Connect your own Stripe account in Settings → Payments.", "The money goes to you; Builder OS takes no fee.", "Bank transfer still works as before."],
        href: "/app/settings/payments",
        cta: "Set up online payments",
        needs: "settings.manage",
        feature: "invoicing",
      },
    ],
  },
  {
    id: "jobs",
    title: "Run the job",
    summary: "Plan the work, keep everyone on site in the loop, and know your margin.",
    steps: [
      {
        id: "project",
        title: "Start a project",
        why: "One place for the job's phases, tasks, diary, photos and files, made from the accepted quote.",
        how: ["Open an accepted quote and click Start project: its stages come with it.", "No quote? Projects → New project. Plan phases and give tasks to people.", "Clients can follow progress in their portal, if you choose."],
        href: "/app/projects/new",
        cta: "New project",
        needs: "projects.edit",
        feature: "projects",
      },
      {
        id: "site_app",
        title: "Open the site app",
        why: "Your team sees today's jobs and tasks on their phone, checks in, and posts photos from site.",
        how: ["Open /m on a phone and add it to the home screen.", "Everyone signs in with their own login.", "Updates and photos land in the project diary."],
        href: "/m",
        cta: "Open the site app",
        needs: "site.app",
        feature: "site_app",
      },
      {
        id: "variation",
        title: "Price a variation",
        why: "Extra work or changes, approved by the client before you do them, and added to the final bill.",
        how: ["Open an accepted quote and click New variation.", "The client approves or rejects it in their portal.", "Approved variations can be invoiced like any payment."],
        href: "/app/variations",
        cta: "Go to variations",
        needs: "quotes.edit",
        feature: "variations",
      },
      {
        id: "costs",
        title: "Log a cost",
        why: "Record receipts and purchase orders against each job to see the real margin as you go.",
        how: ["Add receipts from the office, or from site in the site app.", "Raise purchase orders to suppliers.", "Reports compare quoted and actual, job by job."],
        href: "/app/purchases",
        cta: "Go to purchases",
        needs: "costs.edit",
        feature: "costs",
      },
    ],
  },
  {
    id: "growth",
    title: "Win more work",
    summary: "Catch every enquiry and follow up without thinking about it.",
    steps: [
      {
        id: "lead",
        title: "Add a lead",
        why: "Track every enquiry from first call to signed quote, so none go cold.",
        how: ["Pipeline → New lead, or let them come in from your website.", "Move leads through stages as you survey and quote.", "Set a next action and get reminded."],
        href: "/app/pipeline?new=1",
        cta: "New lead",
        needs: "leads.edit",
        feature: "pipeline",
      },
      {
        id: "enquiry_form",
        title: "Put the enquiry form on your website",
        why: "Enquiries go straight into your pipeline, and you get an alert.",
        how: ["Pipeline → Web form gives you a link and code to embed.", "People in your area can book a survey straight away, if you turn that on."],
        href: "/app/pipeline/form",
        cta: "Set up the form",
        needs: "automations.manage",
        feature: "pipeline",
      },
      {
        id: "online_booking",
        title: "Let clients book a survey",
        why: "Clients pick a free slot themselves; you set the hours, areas and travel time.",
        how: ["Pipeline → Online booking: visit length, notice and postcode areas.", "Give each surveyor their weekly hours.", "Clients get a calendar invite and a reminder the day before."],
        href: "/app/pipeline/surveys",
        cta: "Set up booking",
        needs: "automations.manage",
        feature: "pipeline",
      },
      {
        id: "automation",
        title: "Turn on a follow-up email",
        why: "Chase quotes and nurture leads automatically, in your words, at the right moment.",
        how: ["Pipeline → Automations: choose a trigger, like a quote sent 3 days ago.", "Write the email; it goes from your company's name.", "Leads can unsubscribe with one click."],
        href: "/app/pipeline/automations/new",
        cta: "New automation",
        needs: "automations.manage",
        feature: "automations",
      },
    ],
  },
];

export const STEP_IDS = CHAPTERS.flatMap((c) => c.steps.map((s) => s.id));

export type StepState = Step & { state: "done" | "skipped" | "todo" | "locked" };
export type ChapterState = Omit<Chapter, "steps"> & { steps: StepState[]; done: number; total: number; complete: boolean; locked: boolean };

export type Guide = {
  chapters: ChapterState[];
  done: number;
  total: number;
  /** 0–100. */
  percent: number;
  /** The first unfinished step the person can do, if any. */
  next: StepState | null;
  /** 1-based chapter the person is on (the first incomplete one), for "Level 3 of 7". */
  level: number;
  levels: number;
  complete: boolean;
};

/**
 * The guide for one person: steps their role can't do are left out; steps their plan doesn't include are
 * shown locked and don't count. A skipped step counts as finished.
 */
export function guideFor(role: Role, plan: Plan, signals: Signals, skipped: readonly string[]): Guide {
  const chapters: ChapterState[] = [];
  for (const c of CHAPTERS) {
    const steps: StepState[] = c.steps
      .filter((s) => can(role, s.needs))
      .map((s) => ({
        ...s,
        state: s.feature && !planHas(plan, s.feature) ? "locked" : signals[s.id] ? "done" : skipped.includes(s.id) ? "skipped" : "todo",
      }));
    if (steps.length === 0) continue;
    const open = steps.filter((s) => s.state !== "locked");
    const done = open.filter((s) => s.state === "done" || s.state === "skipped").length;
    chapters.push({ ...c, steps, done, total: open.length, complete: open.length > 0 && done === open.length, locked: open.length === 0 });
  }
  const done = chapters.reduce((n, c) => n + c.done, 0);
  const total = chapters.reduce((n, c) => n + c.total, 0);
  const playable = chapters.filter((c) => !c.locked);
  const current = playable.findIndex((c) => !c.complete);
  const next = playable.flatMap((c) => c.steps).find((s) => s.state === "todo") ?? null;
  return {
    chapters,
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 100,
    next,
    level: current === -1 ? playable.length : current + 1,
    levels: playable.length,
    complete: total > 0 && done === total,
  };
}
