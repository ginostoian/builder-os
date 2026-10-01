"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/toggle-chip";

const sizes = ["Just me", "2–5", "6–15", "16–50", "50+"];

export function ContactForm() {
  const [size, setSize] = React.useState("6–15");
  const [sent, setSent] = React.useState(false);

  if (sent)
    return (
      <div role="status" className="flex flex-col items-center gap-3 px-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-[22px]" />
        </span>
        <div className="text-xl font-semibold tracking-[-0.015em]">Thanks — message received.</div>
        <div className="max-w-[320px] text-[15px] leading-normal text-ink-2">One of us will be in touch shortly. Usually within the hour on weekdays.</div>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Label>
          Your name
          <Input name="name" required autoComplete="name" placeholder="James Hale" />
        </Label>
        <Label>
          Company
          <Input name="company" autoComplete="organization" placeholder="Hale & Sons Renovations" />
        </Label>
      </div>
      <Label>
        Work email
        <Input name="email" type="email" required autoComplete="email" placeholder="james@halesons.co.uk" />
      </Label>
      <fieldset className="flex flex-col gap-2 text-[13.5px] font-medium">
        <legend className="mb-2">Team size</legend>
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => (
            <ToggleChip key={s} active={s === size} onClick={() => setSize(s)} className="h-9 rounded-[10px] px-3.5 text-sm">
              {s}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <Label>
        How can we help?
        <Textarea name="message" placeholder="We're a 12-person firm doing mostly extensions…" />
      </Label>
      <Button type="submit" size="lg" className="w-full">
        Send message
        <ArrowRight />
      </Button>
    </form>
  );
}
