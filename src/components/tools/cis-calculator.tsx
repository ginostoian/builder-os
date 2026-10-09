"use client";

import { formatGBP } from "@/core/money";
import { cisCalc, labourForNet, type CisVat } from "@/core/tools/cis";
import type { CisStatus } from "@/core/cis";
import { BigResult, CalculatorShell, Callout, Field, MoneyInput, readMoney, Rows, Segmented, ShareActions, useToday, useUrlState } from "./controls";

const DEFAULTS = { mode: "invoice", labour: "1000", materials: "250", net: "800", status: "standard", vat: "none", date: "" };

const STATUS_OPTIONS: { value: CisStatus; label: string; sub: string }[] = [
  { value: "standard", label: "Registered", sub: "20%" },
  { value: "higher", label: "Not registered", sub: "30%" },
  { value: "gross", label: "Gross payment", sub: "0%" },
];

const VAT_OPTIONS: { value: CisVat; label: string; sub: string }[] = [
  { value: "none", label: "No VAT", sub: "Not registered" },
  { value: "reverse_charge", label: "Reverse charge", sub: "Usual between builders" },
  { value: "standard", label: "Normal VAT", sub: "e.g. end user" },
];

const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** CIS deduction calculator: from an invoice, or backwards from what the subcontractor wants to take home. */
export function CisCalculator() {
  const [s, set] = useUrlState(DEFAULTS);
  const today = useToday();

  const status = (STATUS_OPTIONS.some((o) => o.value === s.status) ? s.status : "standard") as CisStatus;
  const vat = (VAT_OPTIONS.some((o) => o.value === s.vat) ? s.vat : "none") as CisVat;
  const backwards = s.mode === "net";
  const materials = readMoney(s.materials || "0");
  const net = readMoney(s.net);
  const labour = backwards ? (net === null ? null : labourForNet(net, status)) : readMoney(s.labour);
  const paidOn = s.date || today;
  const r = labour !== null && materials !== null ? cisCalc({ labourPence: labour, materialsPence: materials, status, vat, paidOn }) : null;

  return (
    <CalculatorShell
      inputs={
        <>
          <Segmented
            label="What do you want to work out?"
            value={backwards ? "net" : "invoice"}
            onChange={(v) => set("mode", v)}
            options={[
              { value: "invoice", label: "The deduction on an invoice" },
              { value: "net", label: "What to charge for a take-home" },
            ]}
          />
          {backwards ? (
            <Field label="What the subcontractor wants to take home for labour" htmlFor="cis-net" hint="After the CIS deduction. We'll work out the labour to invoice.">
              <MoneyInput id="cis-net" value={s.net} onChange={(v) => set("net", v)} invalid={s.net !== "" && net === null} />
            </Field>
          ) : (
            <Field label="Labour" htmlFor="cis-labour" hint="The subcontractor's charge for their work, before VAT.">
              <MoneyInput id="cis-labour" value={s.labour} onChange={(v) => set("labour", v)} invalid={s.labour !== "" && labour === null} />
            </Field>
          )}
          <Field label="Materials" htmlFor="cis-materials" hint="What the subcontractor paid for materials on this job, before VAT. No deduction is taken from it.">
            <MoneyInput id="cis-materials" value={s.materials} onChange={(v) => set("materials", v)} invalid={s.materials !== "" && materials === null} />
          </Field>
          <Field label="Subcontractor's CIS status" hint="From verifying them with HMRC.">
            <Segmented label="Subcontractor's CIS status" value={status} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} />
          </Field>
          <Field label="VAT on the invoice">
            <Segmented label="VAT on the invoice" value={vat} onChange={(v) => set("vat", v)} options={VAT_OPTIONS} />
          </Field>
          <Field label="Payment date" htmlFor="cis-date" hint="To find the tax month and when the return is due.">
            <input
              id="cis-date"
              type="date"
              value={paidOn}
              onChange={(e) => set("date", e.target.value)}
              className="h-12 rounded-xl bg-white px-3.5 text-[16px] text-ink shadow-ring-input outline-none focus:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]"
            />
          </Field>
        </>
      }
      results={
        r ? (
          <>
            {backwards ? (
              <BigResult label="Labour to invoice" value={formatGBP(r.labourPence)} note={<>Leaves {formatGBP(r.labourPence - r.deductionPence)} after the {r.rateBps / 100}% deduction.</>} />
            ) : (
              <BigResult label="CIS deduction" value={formatGBP(r.deductionPence)} note={r.rateBps ? <>{r.rateBps / 100}% of {formatGBP(r.labourPence)} labour. Materials and VAT aren&apos;t deducted from.</> : "Gross payment status: no deduction."} />
            )}
            <Rows
              rows={[
                { label: "Labour", value: formatGBP(r.labourPence) },
                { label: "Materials", value: formatGBP(r.materialsPence) },
                { label: "Gross amount (before VAT)", value: formatGBP(r.grossPence), strong: true },
                ...(vat === "standard" ? [{ label: "VAT at 20%", value: formatGBP(r.vatPence) }] : []),
                ...(vat === "reverse_charge" ? [{ label: "VAT (reverse charge: the contractor pays it to HMRC)", value: formatGBP(r.reverseChargeVatPence), muted: true }] : []),
                { label: `CIS deduction (${r.rateBps / 100}%)`, value: `−${formatGBP(r.deductionPence)}` },
                { label: "Pay the subcontractor", value: formatGBP(r.paymentPence), strong: true },
              ]}
            />
            {r.taxMonth && r.deductionPence > 0 && (
              <Callout>
                <strong className="font-semibold text-ink">Pay {formatGBP(r.deductionPence)} to HMRC.</strong> This payment falls in the tax month {r.taxMonth.label}. File your CIS300 return by{" "}
                {longDate(r.taxMonth.dueBy)}, and pay by the 22nd (the 19th if you pay by post). Give the subcontractor a payment and deduction statement within 14 days of the end of the tax month.
              </Callout>
            )}
            {vat === "reverse_charge" && (
              <Callout>
                Under the reverse charge the subcontractor&apos;s invoice shows the VAT but doesn&apos;t charge it. You account for {formatGBP(r.reverseChargeVatPence)} on your VAT return and, if you can, claim it back
                on the same return.
              </Callout>
            )}
            <ShareActions />
          </>
        ) : (
          <Callout tone="warn">Enter amounts in pounds, like 1,250 or 1250.50.</Callout>
        )
      }
    />
  );
}
