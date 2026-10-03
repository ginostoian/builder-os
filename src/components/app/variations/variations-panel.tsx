"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { newVariation } from "@/app/app/variations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { invoiceRef } from "@/core/payment-plan";
import { VARIATION_STATUS } from "./status";

export type VariationRow = { id: string; number: number; title: string; status: string; totalPence: number; billed: boolean; invoiceNumber: number | null };

/** An accepted quote's variations, and a button to start one. */
export function VariationsPanel({ quoteId, rows, canEdit }: { quoteId: string; rows: VariationRow[]; canEdit: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const approved = rows.filter((r) => r.status === "approved").reduce((a, r) => a + r.totalPence, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-subtle">Variations</span>
        {approved !== 0 && <span className="text-[12px] text-subtle tabular">{formatGBP(approved)} approved</span>}
      </div>
      {rows.length === 0 ? (
        <p className="mb-2 text-[12.5px] text-subtle">Extra work or changes agreed on site. The client approves each one with a signature.</p>
      ) : (
        <ol className="mb-2 flex flex-col divide-y divide-hairline rounded-[10px] shadow-ring">
          {rows.map((r) => {
            const s = VARIATION_STATUS[r.status] ?? VARIATION_STATUS.draft;
            return (
              <li key={r.id}>
                <Link href={`/app/variations/${r.id}`} className="flex flex-col gap-1 px-3 py-2.5 hover:bg-surface">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      <span className="mr-1.5 font-mono text-[11.5px] text-subtle">V{r.number}</span>
                      {r.title}
                    </span>
                    <span className="font-medium tabular">{formatGBP(r.totalPence)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
                    <span>{r.billed && r.invoiceNumber ? `On ${invoiceRef(r.invoiceNumber)}` : r.status === "approved" ? "Not invoiced yet" : ""}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {canEdit && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await newVariation(quoteId);
              if (r && !r.ok) setError(r.message);
            })
          }
        >
          <Plus />
          {pending ? "Starting…" : "New variation"}
        </Button>
      )}
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
