import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PaymentsScreen } from "@/components/app/screens/payments";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <AppShell active="invoices">
      <PaymentsScreen />
    </AppShell>
  );
}
