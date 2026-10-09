import type { MetadataRoute } from "next";
import { featuredPost } from "@/lib/content/blog";
import { ARTICLES } from "@/lib/content/help";
import { LEGAL } from "@/lib/content/legal";
import { TOOLS, toolPath } from "@/lib/content/tools";
import { absoluteUrl } from "@/lib/seo";

const day = (text: string) => new Date(`${text} 12:00 UTC`);

/**
 * Every public page worth finding in a search, for /sitemap.xml. The app, client portal and other private
 * pages stay out (robots.ts also keeps crawlers away from them).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], lastModified?: Date) => ({
    url: absoluteUrl(path),
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    page("/", 1, "weekly"),
    page("/features", 0.9, "monthly"),
    page("/pricing", 0.9, "monthly"),
    page("/tools", 0.8, "monthly"),
    ...TOOLS.map((t) => page(toolPath(t.slug), 0.8, "monthly", new Date(`${t.updated}T12:00:00Z`))),
    page("/customers", 0.6, "monthly"),
    page("/demo", 0.6, "yearly"),
    page("/about", 0.5, "yearly"),
    page("/blog", 0.6, "weekly"),
    page(`/blog/${featuredPost.slug}`, 0.6, "yearly", day(featuredPost.longDate)),
    page("/help", 0.6, "weekly"),
    ...ARTICLES.map((a) => page(`/help/${a.slug}`, 0.5, "monthly")),
    page("/support", 0.4, "yearly"),
    page("/terms", 0.2, "yearly", day(LEGAL.updated)),
    page("/privacy", 0.2, "yearly", day(LEGAL.updated)),
    page("/cookies", 0.2, "yearly", day(LEGAL.updated)),
  ];
}
