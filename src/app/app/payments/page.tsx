import type { Metadata } from "next";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { PaymentsScreen } from "@/components/app/screens/payments";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <LiveAppShell active="invoices">
      <PaymentsScreen />
    </LiveAppShell>
  );
}
