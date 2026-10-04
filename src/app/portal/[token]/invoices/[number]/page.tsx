import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { InvoiceDocument } from "@/components/portal/invoice-document";
import { PrintButton } from "@/components/portal/print-button";
import { withTenant } from "@/db";
import { PortalBlocked } from "@/components/portal/portal-gate";
import { requirePortal } from "@/server/portal-auth";
import { portalInvoice } from "@/db/invoices";

type Params = Promise<{ token: string; number: string }>;

async function load(params: Params) {
  const { token, number } = await params;
  const n = /^\d{1,9}$/.test(number) ? Number(number) : null;
  const access = n ? await requirePortal(token) : null;
  if (!access || !n) return null;
  const invoice = await withTenant(access.orgId, (tx) => portalInvoice(tx, access.orgId, access.clientId, n));
  return invoice ? { token, invoice } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: { absolute: "Invoice" } };
  const s = data.invoice.snapshot;
  return { title: { absolute: `Invoice ${s.ref} · ${s.company.tradingName ?? s.company.name}` } };
}

/** One invoice in the client's portal: what's owed, when, and the bank details to pay it. */
export default async function PortalInvoicePage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) return <PortalBlocked token={(await params).token} />;
  const company = data.invoice.snapshot.company.tradingName ?? data.invoice.snapshot.company.name;
  return (
    <div className="min-h-screen bg-muted font-sans text-[13.5px] text-ink antialiased print:bg-white">
      <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between print:hidden">
          <Link href={`/portal/${data.token}`} className="flex items-center gap-1 text-ink-2 hover:text-ink">
            <ChevronLeft className="size-4" />
            All quotes and invoices
          </Link>
          <PrintButton />
        </div>
        <InvoiceDocument invoice={data.invoice} />
        <div className="flex items-center gap-1.5 px-1 text-xs text-subtle print:hidden">
          <ShieldCheck className="size-[13px]" />
          This is your private link from {company}. Please don&apos;t share it. Powered by Builder OS.
        </div>
      </main>
    </div>
  );
}
