import { Suspense } from "react";
import Link from "next/link";
import { PLAN_LABEL, planHas, type Feature } from "@/core/plans";
import { ROLE_LABELS, can } from "@/core/roles";
import { getEntitlement } from "@/server/plan";
import { isPlatformAdmin } from "@/auth/platform-admin";
import { getGuide } from "@/server/onboarding";
import { Onboarding } from "./onboarding/onboarding";
import { SCREEN_FEATURE } from "./shell/screen-features";
import { UpgradePanel } from "./shell/upgrade";
import { requirePermission } from "@/auth/session";
import { CompanySwitcher, UserMenu } from "./account";
import { AppShell } from "./app-shell";
import { CommandSearch } from "./shell/command-search";
import { NewMenu } from "./shell/new-menu";
import { NotificationBell } from "./shell/notification-bell";
import { quickActionsFor } from "./shell/quick-actions";
import type { AdminScreen } from "./routes";

/**
 * The admin app frame for real, signed-in pages. Resolves the session (redirecting to sign-in, company
 * selection or the employee app as needed) and fills the shell with the live company and user.
 */
export async function LiveAppShell({
  active,
  crumbs,
  children,
}: {
  active: AdminScreen;
  crumbs?: [string, string];
  children: React.ReactNode;
}) {
  const session = await requirePermission("app.office");
  const ent = await getEntitlement();
  const actions = quickActionsFor(session.role).filter((a) => !a.feature || planHas(ent.plan, a.feature));
  const locked = (Object.entries(SCREEN_FEATURE) as [AdminScreen, Feature][]).filter(([, f]) => !planHas(ent.plan, f)).map(([screen]) => screen);
  const lockedHere = SCREEN_FEATURE[active] && !planHas(ent.plan, SCREEN_FEATURE[active]) ? SCREEN_FEATURE[active] : null;
  const banner =
    ent.why === "trial" ? (
      <Link href="/app/settings/billing" className="rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-medium text-brand hover:bg-brand/15">
        Pro trial: {ent.trialDaysLeft} day{ent.trialDaysLeft === 1 ? "" : "s"} left · Choose a plan
      </Link>
    ) : ent.pastDue ? (
      <Link href="/app/settings/billing" className="rounded-full bg-danger-soft px-2.5 py-1 text-[12px] font-medium text-danger">
        Payment failed · Update your card
      </Link>
    ) : ent.plan !== "pro" ? (
      <Link href="/app/settings/billing" className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 shadow-ring hover:text-ink">
        {PLAN_LABEL[ent.plan]} plan · Upgrade
      </Link>
    ) : null;
  return (
    <AppShell
      active={active}
      account={{
        company: <CompanySwitcher />,
        user: (
          <UserMenu
            name={session.memberName}
            roleLabel={ROLE_LABELS[session.role]}
            canOpenSettings={can(session.role, "settings.view")}
            platformAdmin={await isPlatformAdmin()}
          />
        ),
        crumbs: crumbs ?? (active === "dashboard" ? [session.orgName, "Dashboard"] : undefined),
        search: <CommandSearch actions={actions} />,
        bell: <NotificationBell />,
        newMenu: <NewMenu actions={actions} />,
        locked,
        banner,
        guide: (
          <Suspense>
            <Onboarding guide={await getGuide()} autoTour={active === "dashboard"} />
          </Suspense>
        ),
      }}
    >
      {lockedHere ? <UpgradePanel feature={lockedHere} /> : children}
    </AppShell>
  );
}
