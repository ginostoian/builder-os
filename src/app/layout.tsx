import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Builder OS: quotes that win the job, built in minutes",
    template: "%s · Builder OS",
  },
  description:
    "The operating system for UK renovation companies. Spreadsheet-fast quoting, client sign-off, stage payments and invoicing, with your projects, team and pipeline in the same place.",
};

export const viewport: Viewport = { themeColor: "#FAFAF9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-surface font-sans text-ink">{children}</body>
    </html>
  );
}
