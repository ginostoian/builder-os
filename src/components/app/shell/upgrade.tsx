import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_LABEL, PLAN_LABEL, planFor, type Feature } from "@/core/plans";

const PITCH: Partial<Record<Feature, string>> = {
  variations: "Price extra work, get the client's sign-off online, and bill it on the next invoice.",
  invoicing: "Payment plans, invoices from each stage, card and bank payments, and polite automatic reminders.",
  projects: "Boards, timelines, the site diary and files for every job, with progress your client can see.",
  team: "Everyone who works for you, their certificates and day rates, the week's plan and timesheets.",
  costs: "Receipts, purchase orders and job costing: see your real margin on every job.",
  reports: "Job costing and margins across every job.",
  pipeline: "Every enquiry in one place, follow-ups, your website form and online survey booking.",
  calendar: "Surveys, task dates and jobs on one calendar.",
};

/** What a locked screen shows instead of its content. */
export function UpgradePanel({ feature }: { feature: Feature }) {
  const plan = PLAN_LABEL[planFor(feature)];
  return (
    <div className="flex flex-1 items-center justify-center bg-surface-2 p-6">
      <div className="max-w-[440px] rounded-[14px] bg-white p-7 text-center shadow-ring">
        <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Lock className="size-4" />
        </span>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">{FEATURE_LABEL[feature]} is on {plan}</h1>
        <p className="mt-1.5 text-ink-2">{PITCH[feature] ?? `Upgrade to ${plan} to use it.`}</p>
        <Button asChild className="mt-5">
          <Link href="/app/settings/billing">
            <Sparkles />
            See plans
          </Link>
        </Button>
      </div>
    </div>
  );
}
