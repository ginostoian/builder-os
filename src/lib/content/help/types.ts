/**
 * The help centre's articles. Written for people who run building firms, not for developers: friendly,
 * plain UK English, short sentences, no em dashes. Text supports **bold** and [links](/help/slug).
 */
export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "tip"; text: string }
  | { type: "note"; text: string };

export type HelpCategory =
  | "getting-started"
  | "quotes"
  | "clients"
  | "getting-paid"
  | "variations"
  | "projects"
  | "team"
  | "costs"
  | "pipeline"
  | "account";

export type HelpArticle = {
  /** URL slug, lower-case-with-hyphens, unique across all articles. */
  slug: string;
  title: string;
  /** One sentence shown in lists and search results. */
  summary: string;
  category: HelpCategory;
  /** The plan it needs, when it isn't on every plan. */
  plan?: "essentials" | "pro";
  /** Who can do it, in plain words, when not everyone can (e.g. "Admins and the office"). */
  who?: string;
  /** Extra words people might search for. */
  keywords?: string[];
  body: HelpBlock[];
  /** Slugs of related articles. */
  related?: string[];
};
