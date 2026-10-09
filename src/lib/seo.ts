/**
 * Search engine basics for the public website: the site's address, page metadata (title, description,
 * canonical link, social cards) and structured data (schema.org JSON-LD) that Google reads to understand
 * who we are and what each page is.
 *
 * NEXT_PUBLIC_SITE_URL sets the address; it defaults to the live site so canonical links never point at
 * a preview deployment.
 */
import type { Metadata } from "next";
import { LEGAL } from "@/lib/content/legal";
import { plans } from "@/lib/content/pricing";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://builder-os.co.uk").replace(/\/+$/, "");
export const SITE_NAME = "Builder OS";
export const SITE_DESCRIPTION =
  "The operating system for UK renovation companies. Spreadsheet-fast quoting, client sign-off, stage payments and invoicing, with your projects, team and pipeline in the same place.";

export const absoluteUrl = (path = "/") => `${SITE_URL}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}`;

/**
 * Metadata for a public page: its title and description, a canonical link (so tracking parameters and
 * preview hosts never compete with the real page), and the Open Graph and X cards used when it's shared.
 * Images come from the nearest `opengraph-image` file.
 */
export function pageMetadata({ title, description, path, absoluteTitle = false, type = "website" }: { title: string; description: string; path: string; absoluteTitle?: boolean; type?: "website" | "article" }): Metadata {
  const shareTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: { title: shareTitle, description, url: absoluteUrl(path), siteName: SITE_NAME, locale: "en_GB", type },
    twitter: { card: "summary_large_image", title: shareTitle, description },
  };
}

// ── Structured data (schema.org) ────────────────────────────────────────────

type Thing = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/** Who publishes the site. On the home page in full; everywhere else by reference. */
export function organizationSchema(): Thing {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    legalName: LEGAL.company,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: absoluteUrl("/site-icon?size=512"), width: 512, height: 512 },
    email: LEGAL.supportEmail,
    description: SITE_DESCRIPTION,
    areaServed: { "@type": "Country", name: "United Kingdom" },
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer support", email: LEGAL.supportEmail, areaServed: "GB", availableLanguage: "en-GB" },
      { "@type": "ContactPoint", contactType: "sales", url: absoluteUrl("/demo"), areaServed: "GB", availableLanguage: "en-GB" },
    ],
  };
}

export function websiteSchema(): Thing {
  return { "@type": "WebSite", "@id": SITE_ID, url: SITE_URL, name: SITE_NAME, description: SITE_DESCRIPTION, inLanguage: "en-GB", publisher: { "@id": ORG_ID } };
}

const priceOf = (p: (typeof plans)[number]) => Number(p.price.replace(/[^\d.]/g, "")) || 0;

/** The product itself, with each plan as an offer (prices are per company per month, plus VAT). */
export function softwareSchema(): Thing {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Construction management software",
    operatingSystem: "Web, iOS, Android",
    publisher: { "@id": ORG_ID },
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: priceOf(p).toFixed(2),
      priceCurrency: "GBP",
      url: absoluteUrl("/pricing"),
      availability: "https://schema.org/InStock",
      ...(priceOf(p) > 0
        ? { priceSpecification: { "@type": "UnitPriceSpecification", price: priceOf(p).toFixed(2), priceCurrency: "GBP", unitText: "MONTH", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" }, valueAddedTaxIncluded: false } }
        : {}),
    })),
  };
}

/** The trail of links above a page's title, for Google's breadcrumb display. The last item is the page. */
export function breadcrumbSchema(items: { name: string; path: string }[]): Thing {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]): Thing {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** A page of the site, tied to the site and publisher so Google sees one connected graph. */
export function webPageSchema({ path, name, description, type = "WebPage", dateModified }: { path: string; name: string; description: string; type?: string; dateModified?: string }): Thing {
  return {
    "@type": type,
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    inLanguage: "en-GB",
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    ...(dateModified ? { dateModified } : {}),
  };
}

/** A free calculator: a web app anyone can use without signing up. */
export function toolSchema({ path, name, description, category = "FinanceApplication" }: { path: string; name: string; description: string; category?: string }): Thing {
  return {
    "@type": "WebApplication",
    "@id": `${absoluteUrl(path)}#app`,
    name,
    url: absoluteUrl(path),
    description,
    applicationCategory: category,
    operatingSystem: "Any (runs in the browser)",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    inLanguage: "en-GB",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    publisher: { "@id": ORG_ID },
  };
}

export function articleSchema({ path, headline, description, datePublished, dateModified, image = "/opengraph-image", type = "Article" }: { path: string; headline: string; description: string; datePublished?: string; dateModified?: string; image?: string; type?: "Article" | "BlogPosting" | "TechArticle" }): Thing {
  return {
    "@type": type,
    "@id": `${absoluteUrl(path)}#article`,
    headline,
    description,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    inLanguage: "en-GB",
    image: absoluteUrl(image),
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ?? datePublished ? { dateModified: dateModified ?? datePublished } : {}),
  };
}

/** Wraps schema items into one JSON-LD document. */
export const graph = (...items: Thing[]) => ({ "@context": "https://schema.org", "@graph": items });

/** Safe to put inside a <script> tag: no `<` can close it early. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
