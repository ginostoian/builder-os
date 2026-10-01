"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewsletterSignup() {
  const [done, setDone] = React.useState(false);
  if (done)
    return (
      <div role="status" className="flex items-center gap-2.5 text-[15px] text-ink-2">
        <Check className="size-4 text-success" />
        You&apos;re on the list. First email lands in a fortnight.
      </div>
    );
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <input
        type="email"
        required
        aria-label="Work email"
        placeholder="you@yourcompany.co.uk"
        className="h-[46px] min-w-[200px] flex-1 rounded-xl bg-surface px-3.5 text-[15px] shadow-ring-input outline-none placeholder:text-subtle"
      />
      <Button type="submit" size="lg">
        Subscribe
      </Button>
    </form>
  );
}
