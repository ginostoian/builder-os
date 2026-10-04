"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { checkStorageAction } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import type { StorageCheck } from "@/server/storage-check";

/** "Check file storage": tests an upload end to end and says what to change if photos don't show. */
export function StorageCheckButton() {
  const [result, setResult] = React.useState<StorageCheck>();
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => startTransition(async () => setResult(await checkStorageAction()))}>
          {pending ? "Checking… (up to 20 seconds)" : "Check file storage"}
        </Button>
        <span className="text-[12px] text-subtle">Photos or files not showing? This uploads a test photo and checks it can be seen.</span>
      </div>
      {result && (
        <div className={`flex gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] ${result.ok ? "bg-success-soft/50" : "bg-danger-soft/40"}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 size-4 flex-none text-success" /> : <AlertTriangle className="mt-0.5 size-4 flex-none text-danger" />}
          <div className="flex flex-col gap-1">
            <span className="font-medium">{result.summary}</span>
            {result.fix && <span className="text-ink-2">{result.fix}</span>}
            {result.steps.length > 0 && <span className="text-subtle">{result.steps.join(" ")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
