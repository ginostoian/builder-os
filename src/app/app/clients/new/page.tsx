import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { ScreenTitle } from "@/components/app/app-shell";
import { ClientForm } from "@/components/app/clients/client-form";
import { requirePermission } from "@/auth/session";

export const metadata: Metadata = { title: "Add client" };

export default async function NewClientPage() {
  await requirePermission("clients.manage");
  return (
    <LiveAppShell active="crm" crumbs={["Clients", "Add client"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle title="Add client" subtitle="Only the name is required. You can fill in the rest later." />
        <div className="max-w-[720px]">
          <ClientForm canEdit />
        </div>
      </div>
    </LiveAppShell>
  );
}
