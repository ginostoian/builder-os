import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Builder OS admin" }, robots: { index: false, follow: false } };

/** The website owner's admin area. Every page and action checks `requirePlatformAdmin()` itself. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
