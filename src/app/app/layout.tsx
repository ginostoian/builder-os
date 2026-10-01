import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Hale & Sons · Builder OS" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto bg-white">{children}</div>;
}
