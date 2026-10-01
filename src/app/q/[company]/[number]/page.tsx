import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackToAdmin } from "@/components/app/back-to-admin";
import { ClientQuoteScreen } from "@/components/app/screens/client-quote";
import { company, quote } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: { absolute: `${quote.title} · ${company.legalName}` },
  robots: { index: false },
};

export function generateStaticParams() {
  return [{ company: "hale-sons", number: "1042" }];
}

export default async function ClientQuotePage({ params }: { params: Promise<{ company: string; number: string }> }) {
  const { company: slug, number } = await params;
  if (slug !== "hale-sons" || number !== "1042") notFound();
  return (
    <>
      <ClientQuoteScreen />
      <BackToAdmin />
    </>
  );
}
