"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  acceptLatestSentQuoteAction,
  createClientAction,
  createDraftQuoteAction,
  createPublicLinkForLatestQuoteAction,
  createVariationForLatestAcceptedQuoteAction,
  ensureCompanySettingsAction,
  sendLatestQuoteAction,
} from "@/modules/dev-db/actions";

type ActionResult = {
  ok: boolean;
  message: string;
};

type DevAction = {
  id: string;
  label: string;
  run: () => Promise<ActionResult>;
};

const devActions: DevAction[] = [
  {
    id: "ensureCompanySettings",
    label: "1. Ensure Company Settings",
    run: () => ensureCompanySettingsAction({}),
  },
  {
    id: "createClient",
    label: "2. Create Client",
    run: () => createClientAction({}),
  },
  {
    id: "createDraftQuote",
    label: "3. Create Draft Quote",
    run: () => createDraftQuoteAction({}),
  },
  {
    id: "sendLatestQuote",
    label: "4. Send Latest Quote",
    run: () => sendLatestQuoteAction({}),
  },
  {
    id: "acceptLatestSentQuote",
    label: "5. Accept Latest Sent Quote",
    run: () => acceptLatestSentQuoteAction({}),
  },
  {
    id: "createVariation",
    label: "6. Create Variation (Post-Acceptance)",
    run: () => createVariationForLatestAcceptedQuoteAction({}),
  },
  {
    id: "createPublicLink",
    label: "7. Create Quote Public Link",
    run: () => createPublicLinkForLatestQuoteAction({}),
  },
];

function nowLabel() {
  return new Date().toLocaleTimeString();
}

export function DevDbControls() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const runAction = (action: DevAction) => {
    startTransition(async () => {
      setRunningActionId(action.id);
      try {
        const response = await action.run();
        const status = response.ok ? "OK" : "BLOCKED";
        setLogs((prev) => [
          `[${nowLabel()}] ${status}: ${action.label} -> ${response.message}`,
          ...prev,
        ]);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setLogs((prev) => [
          `[${nowLabel()}] ERROR: ${action.label} -> ${message}`,
          ...prev,
        ]);
      } finally {
        setRunningActionId(null);
      }
    });
  };

  return (
    <section className="space-y-4 rounded-3xl border bg-white p-6 shadow-[var(--card-shadow)]">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        DB Flow Actions
      </h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        Run these in order to exercise core lifecycle flows before full UI exists.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {devActions.map((action) => {
          const running = isPending && runningActionId === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => runAction(action)}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? `Running: ${action.label}` : action.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border bg-[#f8f9fb] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Action Log
        </p>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            No actions run yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
            {logs.slice(0, 10).map((entry, idx) => (
              <li key={`${entry}-${idx}`}>{entry}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
