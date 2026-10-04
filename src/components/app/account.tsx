"use client";

import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Gauge, Settings } from "lucide-react";
import { appRoutes } from "./routes";

/** Company switcher at the top of the sidebar. Switching reloads /app in the new company. */
export function CompanySwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterSelectOrganizationUrl={appRoutes.dashboard}
      afterCreateOrganizationUrl={appRoutes.dashboard}
      afterLeaveOrganizationUrl="/select-company"
      organizationProfileUrl={appRoutes.team}
      organizationProfileMode="navigation"
      appearance={{
        elements: {
          rootBox: "w-full",
          organizationSwitcherTrigger: "w-full justify-between rounded-md p-1.5 hover:bg-accent focus:shadow-none",
          organizationPreviewMainIdentifier: "text-[13px] font-semibold tracking-[-0.01em] text-ink",
        },
      }}
    />
  );
}

/** Signed-in user at the foot of the sidebar: avatar menu (profile, sign out), name, role, settings. */
export function UserMenu({ name, roleLabel, canOpenSettings, platformAdmin = false }: { name: string; roleLabel: string; canOpenSettings: boolean; platformAdmin?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 p-1.5">
      <UserButton appearance={{ elements: { avatarBox: "size-7" } }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium">{name}</div>
        <div className="text-[11.5px] text-subtle">{roleLabel}</div>
      </div>
      {platformAdmin && (
        <Link href="/app/admin" aria-label="Platform dashboard" title="Platform dashboard" className="rounded-md p-1 text-subtle hover:bg-accent hover:text-ink">
          <Gauge className="size-[15px]" />
        </Link>
      )}
      {canOpenSettings && (
        <Link href={appRoutes.settings} aria-label="Settings" className="rounded-md p-1 text-subtle hover:bg-accent hover:text-ink">
          <Settings className="size-[15px]" />
        </Link>
      )}
    </div>
  );
}
