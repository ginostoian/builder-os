"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/core/roles";
import { ROLES } from "@/core/schemas";
import { Panel } from "../app-shell";
import { appRoutes } from "../routes";

export function TeamSettings() {
  return (
    <div className="flex max-w-[880px] flex-col gap-4">
      <OrganizationProfile
        routing="path"
        path={appRoutes.team}
        appearance={{
          elements: {
            rootBox: "w-full",
            cardBox: "w-full max-w-none shadow-ring rounded-xl",
          },
        }}
      />
      <Panel className="p-4">
        <h2 className="mb-2.5 text-[13.5px] font-semibold">What each role can do</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2">
          {(ROLES as readonly Role[]).map((role) => (
            <div key={role} className="contents">
              <dt className="font-medium">{ROLE_LABELS[role]}</dt>
              <dd className="text-ink-2">{ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
