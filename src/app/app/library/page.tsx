import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { ServiceLibraryScreen } from "@/components/app/screens/service-library";

export const metadata: Metadata = { title: "Service library" };

export default function LibraryPage() {
  return (
    <AppShell active="templates">
      <ServiceLibraryScreen />
    </AppShell>
  );
}
