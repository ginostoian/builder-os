"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  connectXeroAction,
  createJobsCategoryAction,
  disconnectXeroAction,
  retryXeroAction,
  saveXeroSettingsAction,
  sendPastInvoicesAction,
  type XeroActionResult,
} from "@/app/app/settings/xero-actions";
import { Panel } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { invoiceRef } from "@/core/payment-plan";
import type { XeroSettings } from "@/core/xero";
import { Field, control } from "../form-fields";

export type XeroChoicesView = {
  salesAccounts: { code: string; name: string }[];
  bankAccounts: { id: string; name: string }[];
  categories: { id: string; name: string; options: number }[];
  reverseChargeReady: boolean;
};

export type XeroJobView = {
  id: string;
  status: "pending" | "done" | "failed";
  lastError: string | null;
  updatedAt: string;
  invoiceId: string;
  invoiceNumber: number;
  invoiceStatus: string;
  totalPence: number;
};

export type XeroView =
  | { state: "unavailable" }
  | { state: "upgrade" }
  | { state: "disconnected" }
  | {
      state: "connected" | "reconnect";
      tenantName: string;
      lastError: string | null;
      lastSyncedAt: string | null;
      settings: XeroSettings | null;
      choices: XeroChoicesView | null;
      choicesError: string | null;
      usesReverseCharge: boolean;
      takesOnlinePayments: boolean;
      activity: { recent: XeroJobView[]; pending: number; failed: number; done: number };
    };

const BENEFITS = [
  "Every invoice you raise appears in Xero within seconds: the client, every line, the right VAT code (including the reverse charge) and the job it's for.",
  "Mark an invoice paid here, or get paid online, and the payment is recorded in Xero, ready to reconcile.",
  "Paid by bank transfer and reconciled in Xero? It's marked paid here, and the reminders stop.",
  "See real profit per job and cash in the bank on your Reports page, from Xero's own figures.",
];

/** Settings, Xero: connect, choose where things go, and see what's been sent. */
export function XeroSettingsPanel({ view, canEdit, notice }: { view: XeroView; canEdit: boolean; notice: { ok: boolean; text: string } | null }) {
  const router = useRouter();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(notice);
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<XeroActionResult>, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const r = await fn();
      if (r.ok && r.url) {
        window.location.assign(r.url);
        return;
      }
      setMessage(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.message });
      router.refresh();
    });
  };

  const status = message && (
    <p role="status" className={message.ok ? "text-[12.5px] text-success" : "text-[12.5px] text-danger"}>
      {message.text}
    </p>
  );

  if (view.state === "unavailable")
    return (
      <Panel className="max-w-[720px] p-5">
        <h2 className="text-[13.5px] font-semibold">Xero is coming soon</h2>
        <p className="mt-1 text-ink-2">Connecting to Xero isn&apos;t switched on yet. We&apos;ll let you know when it is.</p>
      </Panel>
    );

  if (view.state === "upgrade")
    return (
      <Panel className="max-w-[720px] p-5">
        <Intro />
        <p className="mt-3 text-ink-2">
          Xero comes with invoicing, on the Essentials and Pro plans.{" "}
          <Link href="/app/settings/billing" className="underline underline-offset-2">
            See plans
          </Link>
        </p>
      </Panel>
    );

  if (view.state === "disconnected")
    return (
      <Panel className="flex max-w-[720px] flex-col gap-4 p-5">
        <Intro />
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => run(connectXeroAction)} disabled={pending}>
              {pending ? "Opening Xero…" : "Connect to Xero"}
            </Button>
            <span className="text-[12.5px] text-subtle">You&apos;ll sign in to Xero and choose your organisation. Takes about a minute.</span>
          </div>
        ) : (
          <p className="text-[12.5px] text-subtle">Ask an Admin to connect your Xero.</p>
        )}
        {status}
      </Panel>
    );

  const { activity } = view;
  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-semibold">{view.tenantName}</h2>
              {view.state === "connected" ? <Badge tone="green">Connected</Badge> : <Badge tone="red">Needs connecting again</Badge>}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-2">
              {view.lastSyncedAt ? `Last sent ${new Date(view.lastSyncedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` : "Nothing sent yet."}{" "}
              {activity.done} sent, {activity.pending} waiting{activity.failed ? `, ${activity.failed} need attention` : ""}.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {view.state === "reconnect" && (
                <Button onClick={() => run(connectXeroAction)} disabled={pending}>
                  Connect again
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => run(disconnectXeroAction, "Disconnect Xero? Nothing in Xero is deleted, but new invoices and payments stop going there.")}
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>
        {view.state === "reconnect" && <Warning>{view.lastError ?? "Xero needs you to connect again."}</Warning>}
        {view.choicesError && view.state === "connected" && <Warning>{view.choicesError}</Warning>}
        {view.usesReverseCharge && view.choices && !view.choices.reverseChargeReady && (
          <Warning>
            You have reverse charge quotes, but Xero&apos;s domestic reverse charge VAT rates are switched off. In Xero, go to Accounting, Advanced, Tax rates, and choose Add
            Domestic Reverse Charge Tax Rates. Until then, those invoices wait here.
          </Warning>
        )}
        {status && <div className="mt-3">{status}</div>}
      </Panel>

      {view.settings && view.choices && (
        <SettingsForm
          key={JSON.stringify(view.settings)}
          settings={view.settings}
          choices={view.choices}
          canEdit={canEdit}
          takesOnlinePayments={view.takesOnlinePayments}
          onResult={setMessage}
        />
      )}

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13.5px] font-semibold">What&apos;s been sent</h2>
          {canEdit && view.state === "connected" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending} onClick={() => run(retryXeroAction)}>
                <RefreshCw />
                {activity.failed ? "Retry" : "Send now"}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => run(sendPastInvoicesAction)}>
                Send invoices from{" "}
                {view.settings?.syncFrom
                  ? new Date(`${view.settings.syncFrom}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "the start date"}
              </Button>
            </div>
          )}
        </div>
        {activity.recent.length === 0 ? (
          <p className="mt-2 text-ink-2">New invoices go to Xero as soon as you raise them. To send earlier ones, set the start date below and press Send invoices from.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-muted">
            {activity.recent.map((j) => (
              <li key={j.id} className="flex items-start gap-3 py-2.5">
                {j.status === "done" ? (
                  <CheckCircle2 className="mt-0.5 size-4 flex-none text-success" />
                ) : j.status === "failed" ? (
                  <AlertTriangle className="mt-0.5 size-4 flex-none text-danger" />
                ) : (
                  <RefreshCw className="mt-0.5 size-4 flex-none text-subtle" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/app/invoices/${j.invoiceId}`} className="font-mono text-[12.5px] underline-offset-2 hover:underline">
                      {invoiceRef(j.invoiceNumber)}
                    </Link>
                    <span className="tabular text-[12.5px] text-ink-2">{formatGBP(j.totalPence)}</span>
                    <span className="text-[12px] text-subtle">{j.status === "done" ? "In Xero" : j.status === "failed" ? "Needs attention" : "Waiting to send"}</span>
                  </div>
                  {j.lastError && <p className={j.status === "failed" ? "text-[12.5px] text-danger" : "text-[12.5px] text-ink-2"}>{j.lastError}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Intro() {
  return (
    <div>
      <h2 className="text-[15px] font-semibold">Stop typing invoices into Xero twice</h2>
      <p className="mt-1 text-ink-2">Connect Xero once and your books keep themselves up to date while you get on with the job.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-ink-2">
            <CheckCircle2 className="mt-0.5 size-4 flex-none text-success" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[12.5px] text-ink">
      <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" />
      <div>{children}</div>
    </div>
  );
}

function SettingsForm({
  settings,
  choices,
  canEdit,
  takesOnlinePayments,
  onResult,
}: {
  settings: XeroSettings;
  choices: XeroChoicesView;
  canEdit: boolean;
  takesOnlinePayments: boolean;
  onResult: (m: { ok: boolean; text: string } | null) => void;
}) {
  const router = useRouter();
  const [s, setS] = React.useState<XeroSettings>(settings);
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof XeroSettings>(k: K, v: XeroSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const category = choices.categories.find((c) => c.id === s.trackingCategoryId);

  return (
    <Panel className="p-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await saveXeroSettingsAction(s);
            onResult(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.message });
            router.refresh();
          });
        }}
      >
        <h2 className="text-[13.5px] font-semibold">Where things go in Xero</h2>
        <fieldset disabled={!canEdit || pending} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Sales account" hint="Where your invoices' income goes.">
            <select value={s.salesAccountCode} onChange={(e) => set("salesAccountCode", e.target.value)} className={control}>
              {!choices.salesAccounts.some((a) => a.code === s.salesAccountCode) && <option value={s.salesAccountCode}>{s.salesAccountCode}</option>}
              {choices.salesAccounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bank account for payments" hint="Payments you mark as received here are recorded against it.">
            <select value={s.bankAccountId ?? ""} onChange={(e) => set("bankAccountId", e.target.value || undefined)} className={control}>
              <option value="">Don&apos;t record payments in Xero</option>
              {choices.bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Online payments (Stripe)"
            hint={takesOnlinePayments ? "Use a Stripe account in Xero, so the Stripe payout to your bank isn't counted twice." : "If you take payments online later."}
          >
            <select value={s.stripeAccountId ?? ""} onChange={(e) => set("stripeAccountId", e.target.value || undefined)} className={control}>
              <option value="">Same as the bank account</option>
              {choices.bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="New invoices in Xero are" hint="Approved is ready for payments and bank matching.">
            <select value={s.invoiceStatus} onChange={(e) => set("invoiceStatus", e.target.value as XeroSettings["invoiceStatus"])} className={control}>
              <option value="AUTHORISED">Approved</option>
              <option value="DRAFT">Drafts, for my accountant to approve</option>
            </select>
          </Field>
          <Field
            label="Profit per job"
            hint={category ? `${category.options} of about 100 jobs used. Archive finished ones in Xero to make room.` : "Tags each invoice with its job in Xero."}
          >
            {choices.categories.length ? (
              <select
                value={s.trackJobs ? (s.trackingCategoryId ?? "") : ""}
                onChange={(e) => setS((x) => ({ ...x, trackJobs: Boolean(e.target.value), trackingCategoryId: e.target.value || undefined }))}
                className={control}
              >
                <option value="">Don&apos;t tag jobs</option>
                {choices.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    Tracking category: {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => startTransition(async () => onResult(await createJobsCategoryAction().then((r) => ({ ok: r.ok, text: r.message ?? "" }))))}
              >
                Add a Jobs category in Xero
              </Button>
            )}
          </Field>
          <Field label="Send invoices issued from" hint="Earlier ones stay out of Xero unless you send them.">
            <input type="date" value={s.syncFrom} onChange={(e) => set("syncFrom", e.target.value)} className={control} />
          </Field>
          <Field
            label="Invoice number prefix in Xero"
            hint={s.numberPrefix ? `INV-0001 shows as ${s.numberPrefix}INV-0001 in Xero.` : "Add one (like BOS-) if Xero already has its own INV-0001."}
          >
            <input value={s.numberPrefix} maxLength={10} onChange={(e) => set("numberPrefix", e.target.value.toUpperCase())} placeholder="None" className={control} />
          </Field>
          <label className="flex items-start gap-2 self-end pb-1">
            <input type="checkbox" checked={s.pullPayments} onChange={(e) => set("pullPayments", e.target.checked)} className="mt-0.5" />
            <span>Mark invoices paid here when they&apos;re paid in Xero</span>
          </label>
        </fieldset>
        {canEdit && (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}
