"use client";

import * as React from "react";
import { sendSupportMessage, supportFormToken } from "@/app/(marketing)/support/actions";
import type { SupportInput } from "@/core/schemas";

/**
 * Sends a marketing-site form to our support inbox. Fetches the form's anti-bot token when it opens and
 * carries the hidden `website` field (people never see it; bots fill it in).
 */
export function useSupportForm() {
  const token = React.useRef<string | undefined>(undefined);
  const [state, setState] = React.useState<{ status: "idle" | "sending" | "sent" } | { status: "error"; message: string }>({ status: "idle" });
  React.useEffect(() => {
    supportFormToken()
      .then((t) => (token.current = t))
      .catch(() => undefined);
  }, []);
  const send = async (fields: Omit<SupportInput, "formToken" | "website">, website?: string) => {
    setState({ status: "sending" });
    try {
      const r = await sendSupportMessage({ ...fields, website: website || undefined, formToken: token.current });
      setState(r.ok ? { status: "sent" } : { status: "error", message: r.message });
      return r.ok;
    } catch {
      setState({ status: "error", message: "That didn't send. Check your connection and try again." });
      return false;
    }
  };
  return { state, send };
}

/** The honeypot field: hidden from people (and screen readers), irresistible to bots. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
