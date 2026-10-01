import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { QuoteBuilderScreen } from "@/components/app/screens/quote-builder";
import { quote } from "@/lib/demo-data";

export const metadata: Metadata = { title: quote.number };

export function generateStaticParams() {
  return [{ id: quote.number }];
}

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== quote.number) notFound();
  return (
    <AppShell active="quote">
      <QuoteBuilderScreen />
    </AppShell>
  );
}
