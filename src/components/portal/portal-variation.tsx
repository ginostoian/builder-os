"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, PenLine, Printer, ShieldCheck } from "lucide-react";
import { decideVariationAction } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { longDate } from "@/core/quote-snapshot";
import type { VariationSnapshot } from "@/core/variation";
import { AcceptDialog, DeclineDialog } from "./portal-quote";
import { CompanyMark } from "./quote-document";
import { VariationDocument } from "./variation-document";

/** One variation in the client's portal: read it, then approve with a signature or reject it. */
export function PortalVariation({
  token,
  snapshot,
  sentAt,
  status,
  decision,
  contentHash,
}: {
  token: string;
  snapshot: VariationSnapshot;
  sentAt: Date;
  status: string;
  decision: { at: Date; name: string; signature: string | null } | null;
  contentHash: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"approve" | "reject" | null>(null);
  const company = snapshot.company.tradingName ?? snapshot.company.name;
  const total = snapshot.totals.total;
  const decide = async (input: object) => {
    const r = await decideVariationAction(token, snapshot.quote.number, snapshot.number, input);
    if (r.ok) router.refresh();
    return r;
  };

  return (
    <div className="min-h-screen bg-muted font-sans text-[13.5px] leading-[1.45] text-ink antialiased print:bg-white">
      <header className="flex h-[60px] items-center gap-3 border-b border-hairline bg-white px-4 sm:px-10 print:border-0">
        <Link href={`/portal/${token}`} aria-label="All your quotes" className="flex size-8 items-center justify-center rounded-md text-subtle hover:bg-accent print:hidden">
          <ArrowLeft className="size-4" />
        </Link>
        <CompanyMark company={snapshot.company} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{company}</div>
          <div className="text-xs text-subtle">Variation {snapshot.ref}</div>
        </div>
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => window.print()} className="h-9 print:hidden">
          <Printer className="text-ink-2" />
          <span className="hidden sm:inline">Print or save PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </header>

      <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:px-10 lg:py-8">
        <div className="min-w-0 flex-1">
          <VariationDocument snapshot={snapshot} sentAt={sentAt} />
        </div>
        <aside className="flex w-full flex-col gap-3.5 lg:sticky lg:top-6 lg:w-[340px] print:hidden">
          <section className="rounded-[14px] bg-white px-[22px] py-5 shadow-[0_0_0_1px_#E8E7E3,0_12px_32px_-16px_rgb(16_16_15/0.16)]">
            <div className="text-[12.5px] text-subtle">{total < 0 ? "Credit inc. VAT" : "Extra cost inc. VAT"}</div>
            <div className="mt-0.5 mb-1 text-[32px] font-semibold tracking-[-0.03em] tabular">{formatGBP(Math.abs(total))}</div>
            <div className="text-xs text-subtle">
              Change to {snapshot.quote.ref}, {snapshot.quote.title}
            </div>
            {status === "approved" && decision ? (
              <div className="mt-4 rounded-[10px] bg-success-soft px-3.5 py-3 text-success">
                <div className="flex items-center gap-2 font-medium">
                  <Check className="size-4" />
                  Approved on {longDate(decision.at)}
                </div>
                <div className="mt-1.5 text-[12.5px] text-ink-2">
                  Signed by <span className="font-signature text-[17px] text-ink">{decision.signature}</span> ({decision.name})
                </div>
                <div className="mt-1 font-mono text-[10.5px] break-all text-subtle">Ref {contentHash.slice(0, 16)}</div>
              </div>
            ) : status === "rejected" && decision ? (
              <div className="mt-4 rounded-[10px] bg-surface px-3.5 py-3 text-ink-2">You rejected this variation on {longDate(decision.at)}. {company} has been told.</div>
            ) : (
              <>
                <Button className="mt-4 h-11 w-full gap-2 rounded-[9px]" onClick={() => setDialog("approve")}>
                  <PenLine className="size-[15px]" />
                  Approve &amp; sign
                </Button>
                <Button variant="ghost" className="mt-1.5 h-9 w-full rounded-[9px]" onClick={() => setDialog("reject")}>
                  Reject
                </Button>
              </>
            )}
          </section>
          <div className="flex items-center gap-1.5 px-1 text-xs text-subtle">
            <ShieldCheck className="size-[13px] flex-none" />
            Private link from {company}. Powered by Builder OS.
          </div>
        </aside>
      </main>

      {status === "sent" && (
        <>
          <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-hairline bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgb(16_16_15/0.25)] lg:hidden print:hidden">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] text-subtle">{total < 0 ? "Credit" : "Extra cost"} inc. VAT</div>
              <div className="text-[17px] font-semibold tabular">{formatGBP(Math.abs(total))}</div>
            </div>
            <Button className="h-11 rounded-[9px] px-5" onClick={() => setDialog("approve")}>
              <PenLine className="size-[15px]" />
              Approve
            </Button>
          </div>
          <AcceptDialog
            open={dialog === "approve"}
            onOpenChange={(o) => setDialog(o ? "approve" : null)}
            title="Approve and sign"
            description={
              <>
                You&apos;re approving variation {snapshot.ref}, {snapshot.title}, {total < 0 ? `a credit of ${formatGBP(-total)}` : `an extra ${formatGBP(total)}`} inc. VAT on your quote from {company}. We record your
                name, signature, the time and the exact version you sign.
              </>
            }
            agreement="I approve this variation to my quote. I understand that typing my name above is my electronic signature."
            submitLabel="Sign and approve"
            onSubmit={(fullName, signature) => decide({ decision: "accepted", fullName, signature, agree: true })}
          />
          <DeclineDialog
            open={dialog === "reject"}
            onOpenChange={(o) => setDialog(o ? "reject" : null)}
            company={company}
            title="Reject this variation"
            submitLabel="Reject variation"
            onSubmit={(fullName, reason) => decide({ decision: "declined", fullName, reason: reason || undefined })}
          />
        </>
      )}
    </div>
  );
}
