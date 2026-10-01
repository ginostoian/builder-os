"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Download, MessageSquare, PenLine, ShieldCheck, StickyNote } from "lucide-react";
import { Avatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { company, currentUser, paymentPlan, quote, quoteSections, VAT_RATE } from "@/lib/demo-data";
import { formatBps, formatGBP } from "@/lib/money";
import { lineTotal, quoteTotals, sectionTotal, stageAmounts } from "@/lib/quote";
import { cn } from "@/lib/utils";

/**
 * What the homeowner sees at builderos.app/q/… — the contractor's brand first, Builder OS last.
 * Uses container queries so the same component lays out correctly inside a scaled screenshot.
 */
export function ClientQuoteScreen({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(["2"]));
  const [signOpen, setSignOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const [signedBy, setSignedBy] = React.useState<string | null>(null);
  const [asked, setAsked] = React.useState(false);

  const totals = quoteTotals(quoteSections, VAT_RATE);
  const stages = stageAmounts(totals.total, paymentPlan);

  return (
    <div className={cn("@container flex flex-col bg-muted font-sans text-[13px] leading-[1.4] text-ink antialiased", embedded ? "h-full" : "min-h-screen")}>
      <header className="flex h-[60px] flex-none items-center gap-3 border-b border-hairline bg-white px-4 @[900px]:px-10">
        <div
          className="flex size-8 items-center justify-center rounded-lg text-xs font-semibold text-white"
          style={{ background: company.brandColour }}
        >
          {company.initials}
        </div>
        <div>
          <div className="font-semibold">{company.legalName}</div>
          <div className="text-xs text-subtle">Quote {quote.number}</div>
        </div>
        <div className="flex-1" />
        <Button variant="secondary" className="h-[34px]">
          <Download className="text-ink-2" />
          <span className="hidden @[600px]:inline">Download PDF</span>
          <span className="@[600px]:hidden">PDF</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 py-5 @[1000px]:flex-row @[1000px]:justify-center @[1000px]:px-10 @[1000px]:py-7">
        <div className="flex w-full flex-col gap-3.5 @[1000px]:w-[720px]">
          <section className="rounded-[14px] bg-white px-[26px] py-6 shadow-ring">
            <div className="text-[12.5px] text-subtle">
              Prepared for {quote.client} · {quote.siteAddress}
            </div>
            <h1 className="mt-1.5 mb-2.5 text-2xl font-semibold tracking-[-0.025em]">{quote.title}</h1>
            <p className="max-w-[600px] leading-[1.55] text-ink-2">{quote.intro}</p>
            <div className="mt-4 flex items-center gap-2.5">
              <Avatar initials={currentUser.initials} size={28} className="text-[11px]" />
              <span className="text-[12.5px] whitespace-nowrap">
                <b className="font-medium">{currentUser.name}</b>
                <span className="text-subtle"> · Valid until {quote.validUntil}</span>
              </span>
            </div>
          </section>

          <section className="overflow-hidden rounded-[14px] bg-white shadow-ring">
            {quoteSections.map((s) => {
              const isOpen = open.has(s.id);
              return (
                <div key={s.id} className="border-b border-line">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpen((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                    className="flex min-h-11 w-full items-center gap-3 px-[22px] py-3.5 text-left"
                  >
                    {isOpen ? <ChevronDown className="size-[15px] text-subtle" /> : <ChevronRight className="size-[15px] text-subtle" />}
                    <span className="flex-1 font-semibold">{s.name}</span>
                    <span className="text-xs text-subtle">{s.lines.length} items</span>
                    <span className="w-[90px] text-right font-medium tabular">{formatGBP(sectionTotal(s), 0)}</span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col pr-[22px] pb-3 pl-[49px]">
                      {s.lines.map((l) => (
                        <div key={l.id} className="border-t border-muted py-2">
                          <div className="flex gap-3">
                            <span className="flex-1 text-ink-3">{l.name}</span>
                            <span className="text-xs text-subtle">
                              {l.qty} {l.unit}
                            </span>
                            <span className="w-[90px] text-right text-ink-3 tabular">{formatGBP(lineTotal(l), 0)}</span>
                          </div>
                          {l.note && (
                            <div className="mt-1.5 flex gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs text-ink-2">
                              <StickyNote className="size-[13px] flex-none text-[oklch(0.6_0.17_42)]" />
                              {l.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <div className="flex w-full flex-col gap-3.5 @[1000px]:w-[320px]">
          <section className="rounded-[14px] bg-white px-[22px] py-5 shadow-[0_0_0_1px_#E8E7E3,0_12px_32px_-16px_rgb(16_16_15/0.16)]">
            <div className="text-[12.5px] text-subtle">Total inc. VAT</div>
            <div className="mt-0.5 mb-1 text-[32px] font-semibold tracking-[-0.03em] tabular">{formatGBP(totals.total)}</div>
            <div className="text-xs text-subtle tabular">
              {formatGBP(totals.net)} + {formatGBP(totals.vat)} VAT
            </div>
            {signedBy ? (
              <div className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[9px] bg-success-soft font-medium text-success">
                <Check className="size-[15px]" />
                Accepted · signed by {signedBy}
              </div>
            ) : (
              <Button className="mt-4 h-11 w-full gap-2 rounded-[9px] @[1000px]:h-10" onClick={() => setSignOpen(true)}>
                <PenLine className="size-[15px]" />
                Accept &amp; sign
              </Button>
            )}
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="h-11 flex-1 rounded-[9px] @[1000px]:h-9" onClick={() => setAskOpen(true)}>
                <MessageSquare className="text-ink-2" />
                {asked ? "Question sent" : "Ask a question"}
              </Button>
            </div>
          </section>
          <section className="rounded-[14px] bg-white px-[22px] py-[18px] shadow-ring">
            <h2 className="mb-2 font-semibold">How you&apos;ll pay</h2>
            {paymentPlan.map((p, i) => (
              <div key={p.label} className="flex gap-2.5 border-t border-muted py-2 tabular">
                <span className="flex-1 text-ink-3">{p.label}</span>
                <span className="text-xs text-subtle">{formatBps(p.share)}</span>
                <span className="w-16 text-right">{formatGBP(stages[i], 0)}</span>
              </div>
            ))}
          </section>
          <div className="flex items-center gap-1.5 px-1 text-xs text-subtle">
            <ShieldCheck className="size-[13px]" />
            Secure link from {company.name} · Powered by Builder OS
          </div>
        </div>
      </div>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogTitle>Accept this quote</DialogTitle>
          <DialogDescription>
            Type your full name to sign {quote.number} for {formatGBP(totals.total)} inc. VAT. We record the time and the version you signed.
          </DialogDescription>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
              if (!name) return;
              setSignedBy(name);
              setSignOpen(false);
            }}
          >
            <Label>
              Your full name
              <Input name="name" required autoFocus placeholder="Sarah Okafor" className="font-medium italic" />
            </Label>
            <Button type="submit" size="md" className="w-full">
              <PenLine />
              Sign and accept
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogTitle>Ask {currentUser.name.split(" ")[0]} a question</DialogTitle>
          <DialogDescription>They&apos;ll get it straight away and reply here and by email.</DialogDescription>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setAsked(true);
              setAskOpen(false);
            }}
          >
            <Textarea required placeholder="Could we swap the porcelain splashback for glass?" />
            <Button type="submit" size="md" className="w-full">
              Send question
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
