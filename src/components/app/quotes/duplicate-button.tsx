"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { duplicateQuoteAction } from "@/app/app/quotes/actions";
import { Button } from "@/components/ui/button";

/** Copy this quote into a new draft (and open it). */
export function DuplicateButton({ quoteId, beforeCopy }: { quoteId: string; beforeCopy?: () => Promise<unknown> }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  return (
    <>
      <Button
        variant="secondary"
        disabled={pending}
        title={error}
        onClick={() =>
          startTransition(async () => {
            // Save pending edits first, so the copy includes them.
            await beforeCopy?.();
            const r = await duplicateQuoteAction(quoteId);
            if (!r.ok) setError(r.message);
          })
        }
      >
        <Copy className="text-ink-2" />
        {pending ? "Copying…" : "Duplicate"}
      </Button>
      {error && <span className="self-center text-[12px] text-danger">{error}</span>}
    </>
  );
}
