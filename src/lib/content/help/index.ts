/**
 * The help centre: every article, by category, with lookups for the pages and search. Articles live in
 * one file per area of the app; the order of CATEGORIES is the order on the help home page.
 */
import { ACCOUNT_ARTICLES } from "./account";
import { CLIENT_ARTICLES } from "./clients";
import { COST_ARTICLES } from "./costs";
import { GETTING_PAID_ARTICLES } from "./getting-paid";
import { GETTING_STARTED_ARTICLES } from "./getting-started";
import { PIPELINE_ARTICLES } from "./pipeline";
import { PROJECT_ARTICLES } from "./projects";
import { QUOTE_ARTICLES } from "./quotes";
import { TEAM_ARTICLES } from "./team";
import type { HelpArticle, HelpBlock, HelpCategory } from "./types";
import { VARIATION_ARTICLES } from "./variations";

export type { HelpArticle, HelpBlock, HelpCategory } from "./types";

export const CATEGORIES: { id: HelpCategory; title: string; description: string }[] = [
  { id: "getting-started", title: "Getting started", description: "Set up your company and find your way around." },
  { id: "quotes", title: "Quotes and prices", description: "Your price library, building quotes and sending them." },
  { id: "clients", title: "Clients and the portal", description: "Your clients, and the page where they see everything." },
  { id: "getting-paid", title: "Getting paid", description: "Payment plans, invoices, reminders and online payments." },
  { id: "variations", title: "Variations", description: "Pricing changes and extra work, approved before you start." },
  { id: "projects", title: "Projects", description: "Plan the job, keep a site diary and share progress." },
  { id: "team", title: "Team and site app", description: "Your people, certificates, timesheets and the site app." },
  { id: "costs", title: "Job costs", description: "Receipts, purchase orders and what each job really made." },
  { id: "pipeline", title: "Winning work", description: "Leads, follow-ups, your web form, survey booking and automations." },
  { id: "account", title: "Your account", description: "Plans, settings, your data and keeping it safe." },
];

export const ARTICLES: HelpArticle[] = [
  ...GETTING_STARTED_ARTICLES,
  ...QUOTE_ARTICLES,
  ...CLIENT_ARTICLES,
  ...GETTING_PAID_ARTICLES,
  ...VARIATION_ARTICLES,
  ...PROJECT_ARTICLES,
  ...TEAM_ARTICLES,
  ...COST_ARTICLES,
  ...PIPELINE_ARTICLES,
  ...ACCOUNT_ARTICLES,
];

const BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));

export const articleBySlug = (slug: string) => BY_SLUG.get(slug);
export const articlesIn = (category: HelpCategory) => ARTICLES.filter((a) => a.category === category);
export const categoryOf = (id: HelpCategory) => CATEGORIES.find((c) => c.id === id)!;

/** Plain text of a block, without **bold** and link markup (for search and reading time). */
export const plain = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

export function blockText(b: HelpBlock): string {
  return "items" in b ? b.items.map(plain).join(" ") : plain(b.text);
}

/** What search looks through for each article, lower-case. */
export function searchText(a: HelpArticle): string {
  return [a.title, a.summary, ...(a.keywords ?? []), ...a.body.map(blockText)].join(" ").toLowerCase();
}

export const readingMinutes = (a: HelpArticle) => Math.max(1, Math.round(a.body.map(blockText).join(" ").split(/\s+/).length / 200));
