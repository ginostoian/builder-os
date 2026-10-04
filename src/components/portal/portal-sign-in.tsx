"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { sendPortalCodeAction, spendSignInLinkAction, verifyPortalCodeAction } from "@/app/portal/sign-in-actions";

const field = "h-14 w-full rounded-xl bg-surface px-4 text-center text-[24px] font-semibold tracking-[0.3em] tabular shadow-ring-input outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)]";

/**
 * "Check it's you": the portal's sign-in on a new device. With a one-time link from an email it's one tap;
 * otherwise a 6-digit code goes to the email address the company has for them.
 */
export function PortalSignInForm({ token, emailHint, company }: { token: string; emailHint: string; company: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const link = params.get("signin");
  const [step, setStep] = React.useState<"link" | "start" | "code">(link ? "link" : "start");
  const [code, setCode] = React.useState("");
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();

  const done = () => {
    router.replace(path);
    router.refresh();
  };

  const send = () =>
    startTransition(async () => {
      setMessage(undefined);
      const r = await sendPortalCodeAction(token);
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      setStep("code");
      setMessage({ ok: true, text: `Code sent to ${emailHint}. It can take a minute; check your junk folder too.` });
    });

  const verify = () =>
    startTransition(async () => {
      setMessage(undefined);
      const r = await verifyPortalCodeAction(token, code);
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      done();
    });

  const useLink = () =>
    startTransition(async () => {
      setMessage(undefined);
      const r = await spendSignInLinkAction(token, link ?? "");
      if (!r.ok) {
        setStep("start");
        return setMessage({ ok: false, text: r.message });
      }
      done();
    });

  if (step === "link") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-ink-2">Tap below to open your quotes and invoices from {company} on this device.</p>
        <button type="button" onClick={useLink} disabled={pending} className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-60">
          {pending ? "Opening…" : "Continue"}
        </button>
      </div>
    );
  }

  if (step === "start") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-ink-2">
          To keep your quotes and invoices private, we&apos;ll email a 6-digit code to <span className="font-medium text-ink">{emailHint}</span>. You only need to do this once on each device.
        </p>
        {message && <p className={message.ok ? "text-[14px] text-success" : "text-[14px] text-danger"}>{message.text}</p>}
        <button type="button" onClick={send} disabled={pending} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink font-semibold text-white disabled:opacity-60">
          <Mail className="size-4" />
          {pending ? "Sending…" : "Email me a code"}
        </button>
        <p className="text-[13px] text-subtle">Not your email address any more? Contact {company} and they&apos;ll update it.</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
    >
      {message && <p className={message.ok ? "text-[14px] text-ink-2" : "text-[14px] text-danger"}>{message.text}</p>}
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium">Your code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="••••••"
          aria-label="6-digit code"
          className={field}
        />
      </label>
      <button type="submit" disabled={pending || code.length !== 6} className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-60">
        {pending ? "Checking…" : "Sign in"}
      </button>
      <button type="button" onClick={send} disabled={pending} className="text-[14px] text-ink-2 underline underline-offset-2">
        Send a new code
      </button>
    </form>
  );
}

/** The frame around the sign-in, in the company's colours. */
export function PortalSignInFrame({ company, logoUrl, children }: { company: string; logoUrl: string | null; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10 font-sans text-[15px] text-ink antialiased">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-ring sm:p-8">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- company logo
          <img src={logoUrl} alt={company} className="mb-5 max-h-12 max-w-[200px] object-contain" />
        ) : (
          <div className="mb-4 text-[13px] font-semibold text-ink-2">{company}</div>
        )}
        <h1 className="mb-1 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em]">
          <LockKeyhole className="size-5 text-ink-2" />
          Check it&apos;s you
        </h1>
        {children}
      </div>
    </main>
  );
}
