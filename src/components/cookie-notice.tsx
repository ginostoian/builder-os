"use client";

import * as React from "react";
import Link from "next/link";

const COOKIE = "bos_cookies";

/**
 * The cookie notice. Builder OS only sets strictly necessary cookies, so this tells people what they are
 * and remembers that it was seen (itself a necessary cookie, for 12 months). Not shown inside an embedded
 * enquiry form, where the company's own website handles its notice.
 */
export function CookieNotice() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const embedded = window.self !== window.top;
    const seen = document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`));
    if (embedded || seen) return;
    const t = window.setTimeout(() => setShow(true), 600);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    document.cookie = `${COOKIE}=seen; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setShow(false);
  };
  return (
    <div
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-[560px] flex-col gap-3 rounded-2xl bg-ink p-4 font-sans text-[14px] leading-snug text-white shadow-pop sm:flex-row sm:items-center animate-in fade-in-0 slide-in-from-bottom-2"
    >
      <p className="flex-1 text-white/85">
        We only use cookies the site needs to work, like keeping you signed in. No tracking or advertising.{" "}
        <Link href="/cookies" className="text-white underline underline-offset-2">
          Cookie policy
        </Link>
      </p>
      <button type="button" onClick={dismiss} className="h-9 flex-none rounded-lg bg-white px-4 font-semibold text-ink hover:bg-white/90">
        OK
      </button>
    </div>
  );
}
