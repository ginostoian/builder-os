import { AppShell } from "@/components/app/app-shell";
import { DashboardScreen } from "@/components/app/screens/dashboard";

export default function DashboardPage() {
  return (
    <AppShell active="dashboard">
      <DashboardScreen />
    </AppShell>
  );
}
