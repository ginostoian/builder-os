/**
 * The free tools on the website: calculators anyone can use without signing up. Each has its own page
 * under /tools, and this list feeds the tools hub, the sitemap, the footer and "related tools".
 */
export type Tool = {
  slug: string;
  /** The name on cards and in breadcrumbs. */
  name: string;
  /** The page title in search results; with " · Builder OS" it should stay near 60 characters. */
  title: string;
  /** The meta description (about 155 characters). */
  description: string;
  /** One line for cards. */
  summary: string;
  /** When the content or rules last changed (ISO date), for the sitemap and structured data. */
  updated: string;
};

export const TOOLS: Tool[] = [
  {
    slug: "renovation-cost-calculator",
    name: "Renovation cost calculator",
    title: "Renovation Cost Calculator UK 2026: Extensions, Lofts, Kitchens",
    description:
      "How much will your extension, loft conversion, kitchen or bathroom cost? Get a guide price for your project and region in seconds, with VAT and what's not included.",
    summary: "Guide prices for extensions, lofts, kitchens and more, by region. Builders can embed it.",
    updated: "2026-10-09",
  },
  {
    slug: "cis-calculator",
    name: "CIS deduction calculator",
    title: "CIS Deduction Calculator for Contractors (UK)",
    description:
      "Work out the CIS deduction on a subcontractor's invoice in seconds: 20%, 30% or gross, with materials and VAT handled, plus the tax month and return due date.",
    summary: "The deduction, the net payment and when it's due to HMRC, for 20%, 30% or gross.",
    updated: "2026-10-09",
  },
  {
    slug: "reverse-charge-vat-checker",
    name: "Reverse charge VAT checker",
    title: "Reverse Charge VAT Checker for Builders (UK)",
    description:
      "Does the VAT domestic reverse charge apply to your construction invoice? Answer a few questions and get the answer, the reason and the exact invoice wording.",
    summary: "Answer six questions to see if it applies, with the wording your invoice needs.",
    updated: "2026-10-09",
  },
  {
    slug: "markup-margin-calculator",
    name: "Markup vs margin calculator",
    title: "Markup vs Margin Calculator for Builders",
    description:
      "Turn markup into margin and back. Enter your cost and a markup, margin or price to see your profit, plus how much a mix-up between the two really costs you.",
    summary: "Convert markup to margin and back, and see what mixing them up costs.",
    updated: "2026-10-09",
  },
  {
    slug: "revenue-profit-calculator",
    name: "Revenue and profit target calculator",
    title: "Turnover & Profit Target Calculator for Builders",
    description:
      "Work backwards from the profit you want: the turnover, jobs and quotes you need each year, month and week, your break-even point and what a better margin is worth.",
    summary: "Work back from the profit you want to the turnover, jobs and quotes it takes.",
    updated: "2026-10-09",
  },
  {
    slug: "retention-calculator",
    name: "Retention money calculator",
    title: "Retention Money Calculator for Contractors (UK)",
    description:
      "See how much cash retentions are holding back on a job or across a year, when it should come back, what waiting costs you, and what the coming ban changes.",
    summary: "How much is held back, when it's due back, and what waiting for it costs.",
    updated: "2026-10-09",
  },
  {
    slug: "late-payment-interest-calculator",
    name: "Late payment interest calculator",
    title: "Late Payment Interest Calculator for Builders (UK)",
    description:
      "Work out the statutory interest and fixed compensation you can claim on late invoices from business customers, with today's rates and a letter you can send.",
    summary: "The interest and compensation you can claim on late business invoices, with a letter.",
    updated: "2026-10-09",
  },
  {
    slug: "day-rate-calculator",
    name: "Day rate calculator",
    title: "Day Rate Calculator for Builders and Trades (UK)",
    description:
      "Work out the day rate you need from the income you want, your costs and the days you can actually bill, with tax and National Insurance estimated for 2026/27.",
    summary: "The day and hourly rate you need for the income you want, after costs and tax.",
    updated: "2026-10-09",
  },
  {
    slug: "builders-quote-template",
    name: "Builder's quote template",
    title: "Free Builder's Quote Template (Fill In and Download PDF)",
    description:
      "A free builder's quote template you fill in online: your logo, line items, VAT or reverse charge, payment stages and terms. Download it as a PDF. No sign-up.",
    summary: "Fill in a professional quote online and download it as a PDF.",
    updated: "2026-10-09",
  },
  {
    slug: "builders-invoice-template",
    name: "Builder's invoice template",
    title: "Free Builder's Invoice Template with VAT and CIS (PDF)",
    description:
      "A free invoice template for builders: VAT, the reverse charge and CIS handled, bank details and due date. Fill it in online and download a PDF. No sign-up.",
    summary: "A ready-to-send invoice with VAT, reverse charge and CIS handled.",
    updated: "2026-10-09",
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
export const toolPath = (slug: string) => `/tools/${slug}`;
