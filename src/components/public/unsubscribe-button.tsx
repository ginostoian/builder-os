"use client";

import * as React from "react";
import { unsubscribeAction } from "@/app/unsubscribe/actions";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "done" | "bad">("idle");
  const [pending, startTransition] = React.useTransition();
  if (state === "done") return <p className="mt-4 font-medium text-success">Done. You won&apos;t get any more of these emails.</p>;
  if (state === "bad") return <p className="mt-4 text-danger">This link doesn&apos;t work any more.</p>;
  return (
    <Button
      className="mt-4"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await unsubscribeAction(token);
          setState(r.ok ? "done" : "bad");
        })
      }
    >
      {pending ? "Unsubscribing…" : "Unsubscribe"}
    </Button>
  );
}
