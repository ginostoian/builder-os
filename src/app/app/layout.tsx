import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Builder OS" }, robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="overflow-x-auto bg-white">{children}</div>
    </AuthProvider>
  );
}
