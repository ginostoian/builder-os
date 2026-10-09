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
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
export const toolPath = (slug: string) => `/tools/${slug}`;
