"use client";

import * as React from "react";
import { CreditCard } from "lucide-react";
import { payInvoiceAction } from "@/app/portal/actions";

/** Pay the invoice online (card, Apple/Google Pay, Pay by Bank), on Stripe's secure page. */
export function PayNow({ token, number, amount }: { token: string; number: number; amount: string }) {
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <section className="flex flex-col gap-2 rounded-[14px] bg-white px-6 py-5 shadow-ring print:hidden">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const r = await payInvoiceAction(token, number);
            if (r.ok) window.location.assign(r.url);
            else setError(r.message);
          })
        }
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-60"
      >
        <CreditCard className="size-4" />
        {pending ? "Opening secure payment…" : `Pay ${amount} now`}
      </button>
      <p className="text-center text-[12px] text-subtle">By card, Apple Pay, Google Pay or straight from your bank. Secure payment by Stripe.</p>
      {error && <p className="text-center text-[13px] text-danger">{error}</p>}
    </section>
  );
}
