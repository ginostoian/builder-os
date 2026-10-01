import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { PipelineScreen } from "@/components/app/screens/pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default function ClientsPage() {
  return (
    <LiveAppShell active="crm">
      <PipelineScreen />
    </LiveAppShell>
  );
}
