"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_TOPICS } from "@/core/schemas";
import { Honeypot, useSupportForm } from "./use-support-form";

/** The support page's contact form: straight to our inbox, with the sender as Reply-To. */
export function SupportForm() {
  const { state, send } = useSupportForm();
  if (state.status === "sent")
    return (
      <div role="status" className="flex flex-col items-center gap-3 px-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-[22px]" />
        </span>
        <div className="text-xl font-semibold tracking-[-0.015em]">Thanks, we&apos;ve got your message.</div>
        <div className="max-w-[340px] text-[15px] leading-normal text-ink-2">We&apos;ll reply by email, usually within one working day.</div>
      </div>
    );
  return (
    <form
      className="relative flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const text = (k: string) => String(f.get(k) ?? "").trim();
        void send({ name: text("name"), email: text("email"), company: text("company") || undefined, topic: text("topic") as (typeof SUPPORT_TOPICS)[number], message: text("message") }, text("website"));
      }}
    >
      <Honeypot />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Label>
          Your name
          <Input name="name" required maxLength={120} autoComplete="name" />
        </Label>
        <Label>
          Email
          <Input name="email" type="email" required maxLength={254} autoComplete="email" />
        </Label>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Label>
          Company (optional)
          <Input name="company" maxLength={120} autoComplete="organization" />
        </Label>
        <Label>
          What&apos;s it about?
          <select name="topic" required defaultValue={SUPPORT_TOPICS[0]} className="h-10 rounded-[10px] bg-white px-3 text-[15px] shadow-ring-input outline-none">
            {SUPPORT_TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Label>
      </div>
      <Label>
        How can we help?
        <Textarea name="message" required minLength={10} maxLength={4000} rows={6} placeholder="What were you trying to do, and what happened? Screenshots help: reply to our email with them." />
      </Label>
      {state.status === "error" && <p className="text-[14px] text-danger">{state.message}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Sending…" : "Send message"}
        <ArrowRight />
      </Button>
      <p className="text-[12.5px] text-subtle">We use what you send only to reply to you. See our privacy policy.</p>
    </form>
  );
}
