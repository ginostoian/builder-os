import { Lock } from "lucide-react";
import { SiteFrame } from "./site-frame";

/** The site app when the company's plan doesn't include it. */
export function SiteLocked({ office }: { office: boolean }) {
  return (
    <SiteFrame title="Site app" office={office}>
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-10 text-center shadow-ring">
        <Lock className="size-6 text-subtle" strokeWidth={1.5} />
        <p className="font-medium">The site app is on the Pro plan</p>
        <p className="text-subtle">{office ? "Upgrade in Settings → Plan & billing to give your team their jobs, tasks and check-in on their phones." : "Ask the office to upgrade to Pro to use the site app."}</p>
      </div>
    </SiteFrame>
  );
}
