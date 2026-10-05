"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Honeypot, useSupportForm } from "./use-support-form";

export function NewsletterSignup() {
  const { state, send } = useSupportForm();
  if (state.status === "sent")
    return (
      <div role="status" className="flex items-center gap-2.5 text-[15px] text-ink-2">
        <Check className="size-4 text-success" />
        You&apos;re on the list. Thanks for signing up.
      </div>
    );
  return (
    <form
      className="relative flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get("email") ?? "").trim();
        void send({ name: email.split("@")[0] || "Subscriber", email, topic: "Newsletter sign-up", message: `Please add ${email} to the newsletter.` }, String(f.get("website") ?? ""));
      }}
    >
      <Honeypot />
      <input
        type="email"
        name="email"
        required
        aria-label="Work email"
        placeholder="you@yourcompany.co.uk"
        className="h-[46px] min-w-[200px] flex-1 rounded-xl bg-surface px-3.5 text-[15px] shadow-ring-input outline-none placeholder:text-subtle"
      />
      <Button type="submit" size="lg" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Subscribing…" : "Subscribe"}
      </Button>
      {state.status === "error" && <p className="w-full text-[14px] text-danger">{state.message}</p>}
    </form>
  );
}
