import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { ScreenTitle } from "@/components/app/app-shell";
import { NewQuoteForm } from "@/components/app/quotes/new-quote-form";
import { clientOptions } from "@/db/clients";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ client?: string | string[] }> }) {
  const session = await requirePermission("quotes.edit");
  const { client } = await searchParams;
  const clients = await withSession(session, (tx) => clientOptions(tx, session.orgId));
  const preset = typeof client === "string" && clients.some((c) => c.id === client) ? client : undefined;
  return (
    <LiveAppShell active="quote" crumbs={["Quotes", "New quote"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <div className="flex flex-col gap-2">
          <Link href="/app/quotes" className="flex w-fit items-center gap-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Quotes
          </Link>
          <ScreenTitle title="New quote" subtitle="Starts with your company's default markup and VAT rate. You can change both on the quote." />
        </div>
        <div className="max-w-[560px]">
          <NewQuoteForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} initialClientId={preset} />
        </div>
      </div>
    </LiveAppShell>
  );
}
