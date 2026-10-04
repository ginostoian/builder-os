"use client";

import * as React from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { connectDashboardAction, connectOnboardingAction } from "@/app/app/settings/billing-actions";
import { Button } from "@/components/ui/button";
import { Panel } from "../app-shell";

/**
 * Card and bank payments on invoices, through the company's own Stripe account. Money goes straight to
 * them (Stripe's fees only); Builder OS never holds it.
 */
export function OnlinePayments({ state, canEdit, planOk, stripeReady }: { state: "none" | "started" | "pending" | "on"; canEdit: boolean; planOk: boolean; stripeReady: boolean }) {
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const go = (fn: typeof connectOnboardingAction) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (r.ok) window.location.assign(r.url);
      else setError(r.message);
    });
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <CreditCard className="size-4 text-ink-2" />
        Online payments
      </h2>
      <p className="text-[12.5px] text-ink-2">
        {state === "on"
          ? "On: clients see a Pay now button on their invoices (card, Apple Pay, Google Pay and, where enabled, Pay by Bank). Paid invoices are marked paid automatically and reminders stop. Money goes to your Stripe account and on to your bank."
          : "Let clients pay invoices by card or straight from their bank, with one tap from the invoice. Money goes to your own Stripe account (Stripe's fees only, nothing to Builder OS). Paid invoices are marked paid automatically."}
      </p>
      {state === "pending" && <p className="text-[12.5px] text-warning">Stripe is checking your details. This usually takes a few minutes; we&apos;ll switch it on as soon as they&apos;re done.</p>}
      {!planOk ? (
        <p className="text-[12.5px] text-subtle">Online payments are on the Essentials plan. Upgrade in Settings → Plan &amp; billing.</p>
      ) : !stripeReady ? (
        <p className="text-[12.5px] text-subtle">Online payments aren&apos;t switched on for Builder OS yet.</p>
      ) : (
        canEdit && (
          <div className="flex flex-wrap gap-2">
            {state !== "on" && (
              <Button onClick={() => go(connectOnboardingAction)} disabled={pending}>
                {state === "none" ? "Set up online payments" : "Finish setting up"}
              </Button>
            )}
            {(state === "on" || state === "pending") && (
              <Button variant="secondary" onClick={() => go(connectDashboardAction)} disabled={pending}>
                <ExternalLink />
                Stripe dashboard
              </Button>
            )}
          </div>
        )
      )}
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </Panel>
  );
}
