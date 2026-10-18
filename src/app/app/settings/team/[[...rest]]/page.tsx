import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { TeamSettings } from "@/components/app/settings/team-settings";
import { can } from "@/core/roles";
import { requirePermission, withSession } from "@/auth/session";
import { teamLogins } from "@/db/team";
import Link from "next/link";
import { FREE_USERS } from "@/core/plans";
import { getEntitlement } from "@/server/plan";

export const metadata: Metadata = { title: "Team" };

/** Roles are set here; members, invitations and who's an Admin are managed by Clerk. Only Admins can change either. */
export default async function TeamSettingsPage() {
  const session = await requirePermission("settings.view");
  const free = (await getEntitlement()).plan === "free";
  const logins = await withSession(session, (tx) => teamLogins(tx, session.orgId));
  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Team"]}>
      <SettingsFrame
        active="team"
        title="Team"
        subtitle={
          can(session.role, "team.manage")
            ? "Invite your office and site staff, and choose what each person can see."
            : "Everyone in your company. Ask an Admin to invite people or change roles."
        }
      >
        {free && (
          <div className="max-w-[760px] rounded-xl bg-warning-soft px-4 py-3 text-[13px] text-warning">
            The Free plan includes {FREE_USERS === 1 ? "one login" : `${FREE_USERS} logins`}: yours. You can still invite people, but they won&apos;t get into Builder OS until you{" "}
            <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">
              choose a plan
            </Link>
            .
          </div>
        )}
        <TeamSettings logins={logins} meId={session.memberId} canManage={can(session.role, "team.manage")} />
      </SettingsFrame>
    </LiveAppShell>
  );
}
