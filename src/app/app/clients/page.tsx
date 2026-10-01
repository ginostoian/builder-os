import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PipelineScreen } from "@/components/app/screens/pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default function ClientsPage() {
  return (
    <AppShell active="crm">
      <PipelineScreen />
    </AppShell>
  );
}
