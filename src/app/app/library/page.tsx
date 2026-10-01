import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { ServiceLibraryScreen } from "@/components/app/screens/service-library";

export const metadata: Metadata = { title: "Service library" };

export default function LibraryPage() {
  return (
    <LiveAppShell active="templates">
      <ServiceLibraryScreen />
    </LiveAppShell>
  );
}
