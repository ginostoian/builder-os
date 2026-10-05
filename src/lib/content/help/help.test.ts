import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STEP_IDS } from "@/core/onboarding";
import { ARTICLES, CATEGORIES, articlesIn, blockText } from "./index";
import { STEP_GUIDES } from "./step-guides";

const allText = (a: (typeof ARTICLES)[number]) => [a.title, a.summary, ...(a.keywords ?? []), ...a.body.flatMap((b) => ("items" in b ? b.items : [b.text]))];
const links = (t: string) => [...t.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1]);

/** Does a link match a page in src/app (route groups are skipped, dynamic [segments] match anything)? */
function appPageExists(href: string): boolean {
  const path = href.split(/[?#]/)[0].replace(/^\//, "").split("/").filter(Boolean);
  let dir = join(process.cwd(), "src/app");
  for (const seg of path) {
    if (existsSync(join(dir, seg))) dir = join(dir, seg);
    else if (readdirSync(dir).some((d) => d.startsWith("(") && existsSync(join(dir, d, seg)))) dir = join(dir, readdirSync(dir).find((d) => d.startsWith("(") && existsSync(join(dir, d, seg)))!, seg);
    else {
      const dyn = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory() && d.name.startsWith("["));
      if (!dyn) return false;
      dir = join(dir, dyn.name);
    }
  }
  if (existsSync(join(dir, "page.tsx"))) return true;
  // An optional catch-all ([[...rest]]) also answers the bare path.
  return readdirSync(dir).some((d) => d.startsWith("[[...") && existsSync(join(dir, d, "page.tsx")));
}

describe("help centre content", () => {
  it("has unique slugs and something in every category", () => {
    const slugs = ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const c of CATEGORIES) expect(articlesIn(c.id).length, c.id).toBeGreaterThan(0);
  });

  it("never uses em or en dashes", () => {
    for (const a of ARTICLES) for (const t of allText(a)) expect(t, `${a.slug}: ${t.slice(0, 80)}`).not.toMatch(/[—–]/);
  });

  it("links only to articles and pages that exist", () => {
    for (const a of ARTICLES) {
      for (const r of a.related ?? []) expect(ARTICLES.some((x) => x.slug === r), `${a.slug} related ${r}`).toBe(true);
      for (const href of allText(a).flatMap(links)) {
        if (href.startsWith("/help/")) expect(ARTICLES.some((x) => `/help/${x.slug}` === href.split("#")[0]), `${a.slug} → ${href}`).toBe(true);
        else if (href.startsWith("/")) expect(appPageExists(href), `${a.slug} → ${href}`).toBe(true);
        else expect(href, `${a.slug} → ${href}`).toMatch(/^(https:\/\/|mailto:)/);
      }
    }
  });

  it("has a summary and real content in every article", () => {
    for (const a of ARTICLES) {
      expect(a.summary.length, a.slug).toBeLessThanOrEqual(140);
      expect(a.body.map(blockText).join(" ").split(/\s+/).length, a.slug).toBeGreaterThan(80);
    }
  });

  it("gives every getting-started step a guide", () => {
    for (const id of STEP_IDS) expect(ARTICLES.some((a) => a.slug === STEP_GUIDES[id]), id).toBe(true);
  });
});
