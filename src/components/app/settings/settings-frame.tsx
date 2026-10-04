import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScreenTitle } from "../app-shell";
import { appRoutes } from "../routes";

const tabs = [
  { id: "company", label: "Company", href: appRoutes.settings },
  { id: "payments", label: "Payments", href: appRoutes.paymentSettings },
  { id: "billing", label: "Plan & billing", href: "/app/settings/billing" },
  { id: "team", label: "Team", href: appRoutes.team },
  { id: "guide", label: "Getting started", href: "/app/settings/getting-started" },
] as const;

/** Settings layout: section nav on the left (like the service library's categories), content on the right. */
export function SettingsFrame({
  active,
  title,
  subtitle,
  children,
}: {
  active: (typeof tabs)[number]["id"];
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <nav aria-label="Settings" className="flex flex-none gap-1 overflow-x-auto border-b border-hairline px-3 py-2 lg:w-[200px] lg:flex-col lg:gap-px lg:overflow-visible lg:border-r lg:border-b-0 lg:px-2.5 lg:py-[18px]">
        <div className="hidden px-2.5 pb-2 text-[11px] font-medium text-subtle lg:block">Settings</div>
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={t.id === active ? "page" : undefined}
            className={cn(
              "flex-none rounded-[7px] px-2.5 py-[7px] whitespace-nowrap transition-colors duration-[120ms]",
              t.id === active ? "bg-line font-medium text-ink" : "text-ink hover:bg-surface",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-5 lg:px-6">
        <ScreenTitle title={title} subtitle={subtitle} />
        {children}
      </div>
    </div>
  );
}
