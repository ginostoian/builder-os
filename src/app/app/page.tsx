import { LiveAppShell } from "@/components/app/live-app-shell";
import { DashboardScreen } from "@/components/app/screens/dashboard";

export default function DashboardPage() {
  return (
    <LiveAppShell active="dashboard">
      <DashboardScreen />
    </LiveAppShell>
  );
}
