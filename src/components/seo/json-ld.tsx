import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines, as a JSON-LD script tag (see lib/seo.ts). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
