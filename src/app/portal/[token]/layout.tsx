import type { Metadata } from "next";

/**
 * The client portal: public, no login, the token in the URL is the key. Keep it out of search engines and
 * don't leak the URL (and its token) to other sites through the Referer header.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
