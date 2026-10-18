"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { removeSampleDataAction, sampleDataAction } from "@/app/onboarding-actions";
import { Panel } from "../app-shell";
import { Button } from "@/components/ui/button";

/**
 * Settings, Getting started: the example data from onboarding. Remove it once you're ready for real work,
 * or add it later if you said no and haven't started yet.
 */
export function SampleDataPanel({ state, canAdd, canManage }: { state: "added" | "declined" | "removed" | null; canAdd: boolean; canManage: boolean }) {
  const router = useRouter();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  if (state !== "added" && !canAdd) return null;
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const r = await fn();
      setMessage(r.message ? { ok: r.ok, text: r.message } : undefined);
      router.refresh();
    });
  };
  return (
    <Panel className="max-w-[760px] p-5">
      <h2 className="text-[13.5px] font-semibold">Example data</h2>
      {state === "added" ? (
        <>
          <p className="mt-1 text-ink-2">
            Your account has example clients, services, quotes, invoices and a job to explore. They&apos;re marked &quot;(example)&quot;. When you&apos;re ready for real work,
            remove them: everything you&apos;ve added yourself stays.
          </p>
          {canManage && (
            <Button
              variant="secondary"
              className="mt-3"
              disabled={pending}
              onClick={() => run(removeSampleDataAction, "Remove all the example data? Your own clients, quotes and jobs stay as they are.")}
            >
              {pending ? "Removing…" : "Remove example data"}
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-ink-2">
            Want something to explore before you add your own work? Add a few example clients, quotes, invoices and a job. You can remove them in one click.
          </p>
          {canManage && (
            <Button variant="secondary" className="mt-3" disabled={pending} onClick={() => run(() => sampleDataAction("add"))}>
              {pending ? "Adding…" : "Add example data"}
            </Button>
          )}
        </>
      )}
      {message && <p className={message.ok ? "mt-2 text-[12.5px] text-success" : "mt-2 text-[12.5px] text-danger"}>{message.text}</p>}
    </Panel>
  );
}
