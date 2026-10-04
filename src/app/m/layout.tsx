import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";

export const metadata: Metadata = {
  title: { default: "Site app", template: "%s · Site app" },
  robots: { index: false },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "Site app", statusBarStyle: "default" },
  icons: { apple: "/site-icon?size=180" },
};

export const viewport: Viewport = { themeColor: "#FAFAF9", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function SiteAppLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
