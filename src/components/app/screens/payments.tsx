"use client";

import * as React from "react";
import { BellRing, ChevronDown, Receipt, Send } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { company, invoices as allInvoices, paymentsOverview, type InvoiceStatus } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { Panel, ScreenTitle } from "../app-shell";

const statusTone: Record<InvoiceStatus, BadgeTone> = { Paid: "green", Due: "amber", Overdue: "red", Draft: "grey" };
const stageTone = { success: "text-success", warning: "text-warning", subtle: "text-subtle", brand: "text-brand-ink" } as const;
const stageFill = {
  paid: "bg-ink",
  invoiced: "bg-[repeating-linear-gradient(135deg,#111110_0_4px,#5C5B57_4px_8px)]",
  scheduled: "bg-hairline",
  variation: "bg-brand",
} as const;

const filters = ["All invoices", "Outstanding", "Paid"] as const;

export function PaymentsScreen() {
  const [invoices, setInvoices] = React.useState(allInvoices);
  const [filter, setFilter] = React.useState<(typeof filters)[number]>("All invoices");
  const [selected, setSelected] = React.useState(allInvoices[0].number);
  const [chasing, setChasing] = React.useState<Set<string>>(() => new Set());

  const visible = invoices.filter((i) =>
    filter === "All invoices" ? true : filter === "Paid" ? i.status === "Paid" : i.status === "Due" || i.status === "Overdue",
  );
  const inv = invoices.find((i) => i.number === selected) ?? invoices[0];
  const grid = paymentsOverview.stages.map((s) => `${s.share}fr`).join(" ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 bg-surface-2 px-6 py-5">
      <ScreenTitle title="Payments" subtitle={paymentsOverview.subtitle}>
        <Button variant="secondary">
          14 Elm Road
          <ChevronDown className="size-[13px] text-subtle" />
        </Button>
        <Button>
          <Receipt />
          Raise invoice
        </Button>
      </ScreenTitle>

      <Panel className="px-[18px] py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Payment plan</span>
          <span className="text-ink-2 tabular">
            <b className="font-semibold text-ink">{paymentsOverview.collected}</b> collected of {paymentsOverview.of}
          </span>
        </div>
        <div className="mt-3.5 mb-3 flex h-2 gap-1" aria-hidden>
          {paymentsOverview.stages.map((s) => (
            <div key={s.label} className={cn("rounded", stageFill[s.fill])} style={{ flex: s.share }} />
          ))}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: grid }}>
          {paymentsOverview.stages.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="truncate font-medium">{s.label}</div>
              <div className="text-xs text-ink-2 tabular">{s.amount}</div>
              <div className={cn("mt-0.5 truncate text-[11.5px]", stageTone[s.tone])}>{s.status}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4">
        <Panel className="overflow-hidden">
          <div role="tablist" className="flex gap-0.5 border-b border-hairline px-3.5">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={f === filter}
                onClick={() => setFilter(f)}
                className={cn("px-2 py-2.5", f === filter ? "font-medium shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-subtle hover:text-ink")}
              >
                {f}
              </button>
            ))}
          </div>
          {visible.map((i) => (
            <button
              key={i.number}
              type="button"
              onClick={() => setSelected(i.number)}
              aria-pressed={i.number === inv.number}
              className={cn(
                "grid w-full grid-cols-[84px_minmax(0,1fr)_92px_92px] items-center gap-2.5 border-b border-line px-4 py-[11px] text-left",
                i.number === inv.number ? "bg-surface-2" : "bg-white hover:bg-surface-2",
              )}
            >
              <span className="font-mono text-[11.5px] text-ink-2">{i.number}</span>
              <div className="min-w-0">
                <div className="truncate font-medium">{i.what}</div>
                <div className="text-xs text-subtle">{i.who}</div>
              </div>
              <span className="text-right font-medium tabular">{i.amount}</span>
              <Badge tone={statusTone[i.status]} className="justify-self-end">
                {i.status}
              </Badge>
            </button>
          ))}
        </Panel>

        <div className="flex flex-col gap-3.5 rounded-xl bg-white px-6 py-[22px] shadow-[0_0_0_1px_#E8E7E3,0_8px_24px_-12px_rgb(16_16_15/0.12)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[15px] font-semibold">{company.legalName}</div>
              <div className="text-xs text-subtle">VAT {company.vatNumber}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs">{inv.number}</div>
              <div className="text-xs text-subtle">{inv.due}</div>
            </div>
          </div>
          <div className="text-xs leading-normal text-ink-2">
            Billed to {inv.billedTo[0]}
            <br />
            {inv.billedTo[1]}
          </div>
          <div className="border-t border-hairline tabular">
            {inv.lines.map((l) => (
              <div key={l.label} className="flex justify-between border-b border-line py-[9px]">
                <span>{l.label}</span>
                <span>{l.amount}</span>
              </div>
            ))}
            <div className="flex justify-between py-[9px] text-ink-2">
              <span>VAT 20%</span>
              <span>{inv.vat}</span>
            </div>
            <div className="flex justify-between border-t border-hairline py-[9px] text-[15px] font-semibold">
              <span>{inv.status === "Paid" ? "Total paid" : "Total due"}</span>
              <span>{inv.total}</span>
            </div>
          </div>
          <div className="mt-auto flex gap-2">
            <Button
              className="h-[34px] flex-1"
              disabled={inv.status === "Paid"}
              onClick={() => setInvoices((prev) => prev.map((x) => (x.number === inv.number && x.status === "Draft" ? { ...x, status: "Due", due: "Due in 14 days" } : x)))}
            >
              <Send />
              {inv.status === "Paid" ? "Paid" : "Send to client"}
            </Button>
            <Button
              variant="secondary"
              className="h-[34px]"
              aria-pressed={chasing.has(inv.number)}
              onClick={() =>
                setChasing((prev) => {
                  const next = new Set(prev);
                  if (next.has(inv.number)) next.delete(inv.number);
                  else next.add(inv.number);
                  return next;
                })
              }
            >
              <BellRing className="text-ink-2" />
              {chasing.has(inv.number) ? "Chasing on" : "Auto-chase"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
