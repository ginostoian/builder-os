import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { TeamSettings } from "@/components/app/settings/team-settings";
import { can } from "@/core/roles";
import { requirePermission } from "@/auth/session";

export const metadata: Metadata = { title: "Team" };

/** Members, invitations and roles, managed by Clerk. Only Admins can invite or change roles (Clerk enforces it). */
export default async function TeamSettingsPage() {
  const session = await requirePermission("settings.view");
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
        <TeamSettings />
      </SettingsFrame>
    </LiveAppShell>
  );
}
