/**
 * Plans are per company, not per seat. The Free plan limits and the 14-day trial are
 * placeholders until the founders confirm them (Technical Implementation Plan §10, Q1).
 */
export type Plan = {
  id: "free" | "essentials" | "pro";
  name: string;
  price: string;
  featured?: boolean;
  /** Home page card */
  homeTag: string;
  homeDesc: string;
  homeCta: string;
  /** Pricing page card */
  tag: string;
  vat: string;
  desc: string;
  cta: string;
  includesLabel: string;
  includes: string[];
};

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    homeTag: "Try it out",
    homeDesc: "3 quotes a month, the service library and client quote links.",
    homeCta: "Start free",
    tag: "Forever",
    vat: "No card needed",
    desc: "For sole traders and anyone trying Builder OS on a real job.",
    cta: "Start free",
    includesLabel: "Includes",
    includes: ["3 quotes a month", "Spreadsheet quote builder", "Service library (up to 25 items)", "Client quote links & PDF", "1 user"],
  },
  {
    id: "essentials",
    name: "Essentials",
    price: "£49",
    featured: true,
    homeTag: "Most firms start here",
    homeDesc: "Unlimited quotes, variations, payment plans and invoicing.",
    homeCta: "Start 14-day trial",
    tag: "Most popular",
    vat: "+ VAT · 14-day free trial",
    desc: "Quote, agree changes and get paid — the core of running a renovation firm.",
    cta: "Start free trial",
    includesLabel: "Everything in Free, plus",
    includes: [
      "Unlimited quotes",
      "Variations with client sign-off",
      "Payment plans & stage payments",
      "Invoicing with card & bank payments",
      "Unlimited service library & bundles",
      "Your branding on quotes & invoices",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "£119",
    homeTag: "Everything",
    homeDesc: "Adds projects, CRM, client portal, team app, reporting and automations.",
    homeCta: "Start 14-day trial",
    tag: "Everything",
    vat: "+ VAT · 14-day free trial",
    desc: "Run the whole business from one place, from first enquiry to final invoice.",
    cta: "Start free trial",
    includesLabel: "Everything in Essentials, plus",
    includes: [
      "Project management boards",
      "CRM & enquiry pipeline",
      "Client portal with progress photos",
      "Employees tab & employee app",
      "Reporting & cash-flow forecast",
      "Email automations",
      "Priority support & free data import",
    ],
  },
];

/** true = included, false = not included, string = shown as text. Columns: Free, Essentials, Pro. */
export type Cell = boolean | string;

export const comparison: { group: string; rows: [string, Cell, Cell, Cell][] }[] = [
  {
    group: "Quoting",
    rows: [
      ["Quotes per month", "3", "Unlimited", "Unlimited"],
      ["Spreadsheet quote builder", true, true, true],
      ["Service library", "25 items", "Unlimited", "Unlimited"],
      ["Bundles & templates", false, true, true],
      ["Client links, comments & e-signature", true, true, true],
      ["Custom branding", false, true, true],
    ],
  },
  {
    group: "Getting paid",
    rows: [
      ["Variations", false, true, true],
      ["Payment plans & stage payments", false, true, true],
      ["Invoicing", false, true, true],
      ["Card & open-banking payments", false, true, true],
      ["Automatic reminders", false, true, true],
    ],
  },
  {
    group: "Running jobs",
    rows: [
      ["Project boards & timeline", false, false, true],
      ["Client portal & progress photos", false, false, true],
      ["Employees tab", false, false, true],
      ["Employee app", false, false, true],
    ],
  },
  {
    group: "Growing",
    rows: [
      ["CRM & pipeline", false, false, true],
      ["Email automations", false, false, true],
      ["Reporting", "Basic", "Basic", "Full"],
      ["Support", "Email", "Email & chat", "Priority + import"],
    ],
  },
];

export const faqs: [string, string][] = [
  ["Is it really per company?", "Yes. One price covers your whole business. Add your office team and site crew without paying per seat."],
  ["Can I switch plans later?", "Any time. Upgrades apply straight away; downgrades take effect at the end of your billing month. Your data stays put."],
  ["Do you handle VAT?", "Quotes and invoices handle standard and reduced VAT rates and the domestic reverse charge. Prices shown exclude VAT."],
  ["How do clients pay invoices?", "By card or bank transfer straight from the invoice link. Money lands in your account; we never hold it."],
  ["Can you move my existing price list across?", "Upload a CSV yourself, or on any paid plan send us your spreadsheet and we'll import it for you."],
  ["What happens if I cancel?", "An Admin can export everything (every client, quote, invoice and job) in one download from Settings, as spreadsheets. No lock-in, no exit fees."],
];
