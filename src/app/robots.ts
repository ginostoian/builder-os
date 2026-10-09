import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

/**
 * /robots.txt: crawl the website, not the app. Private pages also say noindex themselves; this keeps
 * crawlers from wasting time on them. Preview deployments ask not to be crawled at all.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app$", "/app/", "/m$", "/m/", "/admin", "/api/", "/portal", "/q/", "/book/", "/enquire/", "/unsubscribe/", "/sign-in", "/sign-up", "/select-company", "/design-guidelines", "/site-sw.js"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
