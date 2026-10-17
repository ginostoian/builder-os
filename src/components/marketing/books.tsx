import { ArrowDown, Check, CircleCheck } from "lucide-react";
import { REVERSE_CHARGE_WORDING } from "@/core/vat";
import { cn } from "@/lib/utils";

/** An invoice raised in Builder OS arriving in Xero, then paid and matched: the "books keep themselves" picture. */
export function XeroFlow({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 text-[13.5px]", className)} aria-hidden>
      <div className="rounded-[14px] bg-white p-4 shadow-ring">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11.5px] text-subtle">INV-0042 · Builder OS</span>
          <span className="rounded-full bg-line px-2 py-0.5 text-[11px] text-ink-2">Just raised</span>
        </div>
        <div className="mt-1.5 font-semibold">Stage 2: first fix, 14 Elm Road</div>
        <div className="mt-2 flex justify-between text-ink-2">
          <span>£8,400.00 + VAT £1,680.00</span>
          <span className="font-semibold text-ink">£10,080.00</span>
        </div>
      </div>
      <ArrowDown className="mx-auto size-4 text-subtle" />
      <div className="rounded-[14px] bg-white p-4 shadow-ring">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11.5px] text-subtle">In Xero, seconds later</span>
          <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">
            <Check className="size-3" />
            Approved
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-ink-2">
          <li>Contact: Sarah Hale</li>
          <li>Sales 200 · 20% (VAT on Income)</li>
          <li>Tracking: Jobs › Q-0012 Elm Road kitchen</li>
        </ul>
      </div>
      <div className="flex items-center gap-2.5 rounded-[14px] bg-success-soft px-4 py-3 text-ink">
        <CircleCheck className="size-4 flex-none text-success" />
        Paid by bank transfer and matched in Xero. Marked paid in Builder OS, reminders stopped.
      </div>
    </div>
  );
}

/** The bottom of a reverse charge invoice: VAT shown, not charged, with HMRC's wording. */
export function ReverseChargeInvoice({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[14px] bg-white p-4 text-[13.5px] shadow-ring", className)} aria-hidden>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11.5px] text-subtle">INV-0043 · to Main Contractor Ltd</span>
        <span className="rounded-full bg-line px-2 py-0.5 text-[11px] text-ink-2">Reverse charge</span>
      </div>
      <div className="mt-3 flex flex-col gap-1 tabular-nums">
        <div className="flex justify-between text-ink-2">
          <span>Subtotal</span>
          <span>£12,500.00</span>
        </div>
        <div className="flex justify-between text-ink-2">
          <span>VAT 20%, reverse charge</span>
          <span>£2,500.00 not charged</span>
        </div>
        <p className="my-1 rounded-md bg-muted px-2.5 py-1.5 text-[12.5px] font-medium">{REVERSE_CHARGE_WORDING}.</p>
        <div className="flex justify-between text-[15px] font-semibold">
          <span>Amount due</span>
          <span>£12,500.00</span>
        </div>
      </div>
    </div>
  );
}
