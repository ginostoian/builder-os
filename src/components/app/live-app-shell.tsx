import { ROLE_LABELS, can } from "@/core/roles";
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
  const actions = quickActionsFor(session.role);
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
          />
        ),
        crumbs: crumbs ?? (active === "dashboard" ? [session.orgName, "Dashboard"] : undefined),
        search: <CommandSearch actions={actions} />,
        bell: <NotificationBell />,
        newMenu: <NewMenu actions={actions} />,
      }}
    >
      {children}
    </AppShell>
  );
}
