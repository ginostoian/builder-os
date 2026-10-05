"use client";

import * as React from "react";
import { MailCheck } from "lucide-react";
import { requestPortalLinksAction } from "@/app/portal/sign-in-actions";

const field = "h-12 w-full rounded-xl bg-surface px-3.5 text-[15px] shadow-ring-input outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)]";

export function FindMyPortal({ formToken }: { formToken: string }) {
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <MailCheck className="size-8 text-success" strokeWidth={1.5} />
        <p className="font-medium">Check your email</p>
        <p className="text-ink-2">If {email} is on a builder&apos;s records, a sign-in link is on its way. It works once, for 30 minutes.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-2 text-[14px] text-ink-2 underline underline-offset-2">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const r = await requestPortalLinksAction({ email: email.trim().toLowerCase(), website: website || undefined, formToken });
          if (r.ok) setSent(true);
          else setError(r.message);
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" className={field} />
      </label>
      {/* People never fill this in; bots do. */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <button type="submit" disabled={pending} className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-60">
        {pending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
