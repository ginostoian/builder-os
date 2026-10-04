import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { NotificationBell } from "@/components/app/shell/notification-bell";

/**
 * The site app's page frame. Built for phones (big targets, often used with gloves on); on a desktop it
 * sits in a narrow column so the office can see what the team sees.
 */
export function SiteFrame({ title, eyebrow, back, office, children }: { title: string; eyebrow?: string; back?: string; office?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-[#EDECE8] font-sans text-sm leading-[1.4] text-ink antialiased">
      <div className="flex w-full max-w-[460px] flex-col bg-surface sm:my-6 sm:min-h-[calc(100dvh-48px)] sm:rounded-[28px] sm:shadow-ring">
        <header className="flex items-center gap-3 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-3">
          {back && (
            <Link href={back} aria-label="Back" className="-ml-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-accent">
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="truncate text-[13px] text-subtle">{eyebrow}</div>}
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.025em]">{title}</h1>
          </div>
          <NotificationBell className="size-11 rounded-full bg-white shadow-ring hover:bg-white" />
          {office && (
            <Link href="/app" className="flex h-9 flex-none items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-medium text-ink-2 shadow-ring hover:text-ink">
              <LayoutDashboard className="size-3.5" />
              Office
            </Link>
          )}
        </header>
        <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</main>
      </div>
    </div>
  );
}

/** A section heading inside the site app. */
export function SiteHeading({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1 pt-2">
      <h2 className="font-semibold">{title}</h2>
      {aside && <span className="text-[13px] text-subtle">{aside}</span>}
    </div>
  );
}
