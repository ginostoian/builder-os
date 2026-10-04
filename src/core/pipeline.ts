/**
 * The sales pipeline: enquiries ("leads") from first contact to won or lost, and the email automations
 * that follow them up. Pure rules shared by the office screens, the web enquiry form, the automation
 * runner and the database layer.
 */
import { addDays } from "./payment-plan";

// ── Stages ───────────────────────────────────────────────────────────────────

/** Where an enquiry is. Quote sent, won and lost also move on their own when the quote does. */
export const LEAD_STAGES = ["new", "contacted", "site_visit", "quoting", "quote_sent", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const OPEN_STAGES = ["new", "contacted", "site_visit", "quoting", "quote_sent"] as const satisfies readonly LeadStage[];

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: "New enquiry",
  contacted: "Contacted",
  site_visit: "Site visit",
  quoting: "Quoting",
  quote_sent: "Quote sent",
  won: "Won",
  lost: "Lost",
};

/** What usually happens next at each stage: the board's hint and the default follow-up. */
export const STAGE_HINT: Record<LeadStage, string> = {
  new: "Call them back: the first to reply usually wins.",
  contacted: "Book a site visit.",
  site_visit: "Measure up, then start the quote.",
  quoting: "Finish and send the quote.",
  quote_sent: "Follow up until they decide.",
  won: "Start the project.",
  lost: "Ask what would have won it.",
};

export const isOpen = (stage: LeadStage) => (OPEN_STAGES as readonly string[]).includes(stage);

// ── Sources and reasons ──────────────────────────────────────────────────────

export const LEAD_SOURCES = ["website", "referral", "repeat", "google", "facebook", "instagram", "checkatrade", "mybuilder", "rated_people", "signage", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Website form",
  referral: "Referral",
  repeat: "Past client",
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  checkatrade: "Checkatrade",
  mybuilder: "MyBuilder",
  rated_people: "Rated People",
  signage: "Site board or van",
  other: "Other",
};

export const LOST_REASONS = ["price", "went_elsewhere", "timing", "no_response", "not_a_fit", "declined_quote", "other"] as const;
export type LostReason = (typeof LOST_REASONS)[number];
export const LOST_REASON_LABEL: Record<LostReason, string> = {
  price: "Price too high",
  went_elsewhere: "Went with someone else",
  timing: "Timing didn't work",
  no_response: "Stopped replying",
  not_a_fit: "Not a job for us",
  declined_quote: "Declined the quote",
  other: "Other",
};

/** Kinds of work, for the enquiry form and the board (any text is allowed). */
export const PROJECT_TYPES = ["Kitchen", "Bathroom", "Extension", "Loft conversion", "Full renovation", "Garage conversion", "Basement", "Refurbishment", "Repairs", "Other"] as const;

export const BUDGETS = ["Under £10k", "£10k–£25k", "£25k–£50k", "£50k–£100k", "£100k+", "Not sure yet"] as const;

// ── Follow-ups ───────────────────────────────────────────────────────────────

export type FollowUp = "today" | "overdue" | "upcoming" | "none";

export function followUpState(nextActionOn: string | null, today: string): FollowUp {
  if (!nextActionOn) return "none";
  if (nextActionOn < today) return "overdue";
  return nextActionOn === today ? "today" : "upcoming";
}

/** Quick picks for "follow up on…". */
export const FOLLOW_UP_PICKS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
] as const;

// ── Automations ──────────────────────────────────────────────────────────────

/**
 * What starts an automation for a lead: a web enquiry arriving, any new lead, or a lead entering a stage
 * (quote sent and won/lost move on their own with the quote).
 */
export const AUTOMATION_TRIGGERS = ["web_enquiry", "lead_created", "stage_entered"] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const MAX_AUTOMATION_STEPS = 10;
export const MAX_DELAY_DAYS = 365;

export type AutomationStep = { id: string; delayDays: number; subject: string; body: string };

export function triggerLabel(trigger: AutomationTrigger, stage: LeadStage | null): string {
  if (trigger === "web_enquiry") return "When an enquiry comes in from your website form";
  if (trigger === "lead_created") return "When any new lead is added";
  return `When a lead moves to ${stage ? LEAD_STAGE_LABEL[stage] : "a stage"}`;
}

/**
 * When a step is due. Same-day steps go at once; later ones are due at the start of that UK day, so the
 * morning run sends them (emails land at the start of the working day, not at 3am).
 */
export function stepDueAt(from: Date, delayDays: number, ukDay: (d: Date) => string): Date {
  if (delayDays <= 0) return from;
  const day = addDays(ukDay(from), delayDays);
  // Midnight UK time on that day, as an instant: 00:00 in London is 23:00 or 00:00 UTC.
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const londonOffsetHours = ukDay(new Date(utcMidnight.getTime() - 60 * 60 * 1000)) === day ? 1 : 0;
  return new Date(utcMidnight.getTime() - londonOffsetHours * 60 * 60 * 1000);
}

// ── Merge fields ─────────────────────────────────────────────────────────────

export const MERGE_FIELDS = [
  { key: "first_name", label: "Their first name", sample: "Sarah" },
  { key: "name", label: "Their full name", sample: "Sarah Hale" },
  { key: "project", label: "What they want done", sample: "kitchen extension" },
  { key: "company", label: "Your company", sample: "Better Homes Studio" },
  { key: "my_name", label: "Your name (the lead's owner)", sample: "Gino" },
  { key: "visit_date", label: "Site visit date and time", sample: "Thursday 8 October at 10:00" },
  { key: "quote_link", label: "Link to their quote", sample: "https://…/portal/…" },
  { key: "booking_link", label: "Link to book (or move) their survey online", sample: "https://…/book/…" },
] as const;
export type MergeKey = (typeof MERGE_FIELDS)[number]["key"];
export type MergeValues = Partial<Record<MergeKey, string | null>>;

/** Fill `{{first_name}}`-style fields. Unknown or empty fields become blank; spacing is tidied. */
export function fillMergeFields(template: string, values: MergeValues): string {
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => (values as Record<string, string | null | undefined>)[key] ?? "")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

/** The fields a template uses that aren't known. */
export function unknownMergeFields(template: string): string[] {
  const known = new Set<string>(MERGE_FIELDS.map((f) => f.key));
  return [...new Set([...template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !known.has(k)))];
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Tue 6 Oct, 10:00" in UK time, built from parts so server and browser render the same text. */
export function shortWhen(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

/** "6 Oct" in UK time (same text on server and browser). */
export function shortDate(at: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month}`;
}

/** "Thursday 8 October at 10:00" in UK time. */
export function visitWhen(at: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(at);
  return `${day} at ${time}`;
}

// ── Ready-made automations ───────────────────────────────────────────────────

export type AutomationTemplate = { key: string; name: string; description: string; trigger: AutomationTrigger; stage: LeadStage | null; steps: Omit<AutomationStep, "id">[] };

/** Starting points a company can add with one click, then change to sound like them. */
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "enquiry_reply",
    name: "Reply to new enquiries",
    description: "Thanks them straight away, so they know a real company has their enquiry, even at 10pm.",
    trigger: "web_enquiry",
    stage: null,
    steps: [
      {
        delayDays: 0,
        subject: "Thanks for your enquiry, {{first_name}}",
        body: "Hi {{first_name}},\n\nThanks for getting in touch about your {{project}}. We've got your details and {{my_name}} will call you within one working day to talk it through and arrange a visit.\n\nIf it's easier, just reply to this email with a good time to call.\n\nBest wishes,\n{{my_name}}\n{{company}}",
      },
    ],
  },
  {
    key: "new_lead_nudge",
    name: "Nudge if we haven't spoken yet",
    description: "If a new enquiry is still waiting after two days, a friendly email asking when suits them.",
    trigger: "lead_created",
    stage: null,
    steps: [
      {
        delayDays: 2,
        subject: "When's good for a chat about your {{project}}?",
        body: "Hi {{first_name}},\n\nWe tried to catch you about your {{project}}. When would suit you for a quick call, or for us to come and take a look?\n\nJust reply with a day and time and we'll fit around you.\n\nThanks,\n{{my_name}}\n{{company}}",
      },
    ],
  },
  {
    key: "visit_confirmation",
    name: "Confirm the site visit",
    description: "Confirms the visit date and time as soon as it's booked.",
    trigger: "stage_entered",
    stage: "site_visit",
    steps: [
      {
        delayDays: 0,
        subject: "Your site visit: {{visit_date}}",
        body: "Hi {{first_name}},\n\nThis is to confirm we'll come and see you on {{visit_date}} to look at your {{project}}.\n\nIt's worth having any drawings, photos you like or a rough budget to hand, but don't worry if not. If the time stops working, just reply and we'll move it.\n\nSee you then,\n{{my_name}}\n{{company}}",
      },
    ],
  },
  {
    key: "quote_follow_up",
    name: "Follow up a sent quote",
    description: "Three gentle check-ins over two weeks. They stop as soon as the quote is accepted or declined.",
    trigger: "stage_entered",
    stage: "quote_sent",
    steps: [
      {
        delayDays: 3,
        subject: "Any questions about your quote?",
        body: "Hi {{first_name}},\n\nI hope the quote for your {{project}} made sense. If anything's unclear or you'd like to change something, just reply or give me a call. Happy to go through it line by line.\n\nYou can see it again here: {{quote_link}}\n\nThanks,\n{{my_name}}\n{{company}}",
      },
      {
        delayDays: 4,
        subject: "Your {{project}}: holding your start date",
        body: "Hi {{first_name}},\n\nJust checking in on your {{project}}. Our diary fills up a few weeks ahead, so if you'd like to go ahead, let me know and I'll pencil in a start date for you.\n\nYour quote: {{quote_link}}\n\nBest,\n{{my_name}}",
      },
      {
        delayDays: 7,
        subject: "Should I close your file?",
        body: "Hi {{first_name}},\n\nI haven't heard back about your {{project}}, so I'll assume the timing isn't right for now. No problem at all. If you'd like to pick it up again, just reply to this email.\n\nAll the best,\n{{my_name}}\n{{company}}",
      },
    ],
  },
  {
    key: "won_welcome",
    name: "Welcome a new client",
    description: "Thanks them for going ahead and says what happens next.",
    trigger: "stage_entered",
    stage: "won",
    steps: [
      {
        delayDays: 0,
        subject: "Thank you, {{first_name}}! What happens next",
        body: "Hi {{first_name}},\n\nThank you for choosing {{company}} for your {{project}}. We're really looking forward to it.\n\nNext, we'll confirm your start date and send your first invoice. You can follow progress, see updates and pay invoices in your client portal at any time.\n\nAny questions, just reply.\n\n{{my_name}}\n{{company}}",
      },
    ],
  },
  {
    key: "lost_win_back",
    name: "Check back on lost leads",
    description: "Three months after a lead is lost, asks if their plans have changed.",
    trigger: "stage_entered",
    stage: "lost",
    steps: [
      {
        delayDays: 90,
        subject: "Still thinking about your {{project}}?",
        body: "Hi {{first_name}},\n\nWe spoke a while back about your {{project}}. If your plans have changed or you're ready to look at it again, we'd be glad to help. Just reply to this email.\n\nBest wishes,\n{{my_name}}\n{{company}}",
      },
    ],
  },
];
