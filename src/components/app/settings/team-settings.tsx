"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OrganizationProfile } from "@clerk/nextjs";
import { setMemberRoleAction } from "@/app/app/settings/team-actions";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/core/roles";
import { ROLES } from "@/core/schemas";
import { Panel } from "../app-shell";
import { appRoutes } from "../routes";

export type TeamLogin = { id: string; name: string; email: string | null; role: Role };

/**
 * Roles are set here, in Builder OS. Clerk's members list below handles inviting, removing and making
 * someone an Admin; everyone else joins as Employee until an Admin picks their role.
 */
export function TeamSettings({ logins, meId, canManage }: { logins: TeamLogin[]; meId: string; canManage: boolean }) {
  return (
    <div className="flex max-w-[880px] flex-col gap-4">
      <Panel className="p-4">
        <h2 className="text-[13.5px] font-semibold">Roles</h2>
        <p className="mt-0.5 mb-3 text-[12.5px] text-ink-2">
          {canManage ? "Choose what each person can see. New people join as Employee. To make someone an Admin, use the members list below." : "What each person can see. Ask an Admin to change it."}
        </p>
        <ul className="flex flex-col divide-y divide-muted">
          {logins.map((m) => (
            <RoleRow key={m.id} login={m} editable={canManage && m.id !== meId && m.role !== "admin"} me={m.id === meId} />
          ))}
        </ul>
      </Panel>
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

function RoleRow({ login, editable, me }: { login: TeamLogin; editable: boolean; me: boolean }) {
  const router = useRouter();
  const [role, setRole] = React.useState<Role>(login.role);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {login.name}
          {me && <span className="font-normal text-subtle"> (you)</span>}
        </div>
        {login.email && <div className="truncate text-[12.5px] text-subtle">{login.email}</div>}
      </div>
      {editable ? (
        <select
          aria-label={`Role for ${login.name}`}
          value={role}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as Role;
            const before = role;
            setRole(next);
            setError(undefined);
            startTransition(async () => {
              const r = await setMemberRoleAction({ memberId: login.id, role: next });
              if (!r.ok) {
                setRole(before);
                setError(r.message);
              }
              router.refresh();
            });
          }}
          className="h-8 rounded-md bg-white px-2.5 text-[13px] shadow-ring-input"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[13px] text-ink-2">{ROLE_LABELS[login.role]}</span>
      )}
      {error && <p className="w-full text-[12.5px] text-danger">{error}</p>}
    </li>
  );
}

