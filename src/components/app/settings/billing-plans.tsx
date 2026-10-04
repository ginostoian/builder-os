"use client";

import * as React from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { openBillingPortalAction, startCheckoutAction } from "@/app/app/settings/billing-actions";
import { Button } from "@/components/ui/button";
import { PLAN_LABEL, type Plan } from "@/core/plans";
import { plans } from "@/lib/content/pricing";
import { cn } from "@/lib/utils";
import { Panel } from "../app-shell";

/** Plan cards with the right button on each, and the billing portal. */
export function BillingPlans({
  current,
  why,
  status,
  warn,
  hasBillingAccount,
  paying,
  canManage,
  stripeReady,
}: {
  current: Plan;
  why: "comped" | "subscription" | "trial" | "free";
  status: string;
  warn: boolean;
  hasBillingAccount: boolean;
  paying: boolean;
  canManage: boolean;
  stripeReady: boolean;
}) {
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const go = (fn: () => Promise<{ ok: true; url: string } | { ok: false; message: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (r.ok) window.location.assign(r.url);
      else setError(r.message);
    });

  return (
    <div className="flex flex-col gap-4">
      <Panel className={cn("flex items-start gap-3 p-5", warn && "shadow-[0_0_0_1.5px_var(--color-warning)]")}>
        <Sparkles className="mt-0.5 size-4 flex-none text-brand" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {PLAN_LABEL[current]}
            {why === "trial" ? " (free trial)" : why === "comped" ? " (complimentary)" : ""}
          </div>
          <p className="mt-0.5 text-ink-2">{status}</p>
        </div>
        {hasBillingAccount && canManage && (
          <Button variant="secondary" disabled={pending} onClick={() => go(openBillingPortalAction)}>
            <CreditCard />
            Manage billing
          </Button>
        )}
      </Panel>
      {error && <p className="text-danger">{error}</p>}
      {!stripeReady && <p className="text-[12.5px] text-subtle">Online billing isn&apos;t switched on yet. Contact Builder OS to change plan.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === current && why !== "trial" && why !== "comped";
          return (
            <Panel key={p.id} className={cn("flex flex-col gap-3 p-5", p.id === current && "shadow-[0_0_0_1.5px_var(--color-ink)]")}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold">{p.name}</h2>
                <div>
                  <span className="text-[20px] font-semibold tracking-[-0.02em]">{p.price}</span>
                  {p.id !== "free" && <span className="text-[12px] text-subtle"> /month + VAT</span>}
                </div>
              </div>
              <p className="text-[12.5px] text-ink-2">{p.desc}</p>
              <ul className="flex flex-1 flex-col gap-1 text-[12.5px]">
                <li className="text-subtle">{p.includesLabel}</li>
                {p.includes.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 size-3.5 flex-none text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              {p.id === "free" ? (
                <p className="text-[12px] text-subtle">{current === "free" ? "Your plan" : paying ? "Cancel in Manage billing to move here." : "Where you'll be if you don't choose a plan."}</p>
              ) : isCurrent ? (
                <Button variant="secondary" disabled>
                  Your plan
                </Button>
              ) : (
                <Button
                  variant={p.featured ? "primary" : "secondary"}
                  disabled={pending || !canManage || !stripeReady || why === "comped"}
                  onClick={() => go(() => (paying ? openBillingPortalAction() : startCheckoutAction(p.id)))}
                >
                  {why === "comped" ? "Included" : paying ? `Switch to ${p.name}` : `Choose ${p.name}`}
                </Button>
              )}
            </Panel>
          );
        })}
      </div>
      {!canManage && <p className="text-[12.5px] text-subtle">Only Admins can change the plan.</p>}
    </div>
  );
}
