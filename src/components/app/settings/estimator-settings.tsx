"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import { saveEstimatorAction, setEstimatorLinkAction } from "@/app/app/settings/estimator-actions";
import { Panel } from "@/components/app/app-shell";
import { Estimator } from "@/components/estimator/estimator";
import { Button } from "@/components/ui/button";
import { PROJECT_TYPES, PROJECTS, REGIONS, priceKey, regionFactor, type EstimatorSettings, type ProjectType } from "@/core/estimator";
import { SITE_URL } from "@/lib/seo";
import { Field, control } from "../form-fields";

/**
 * Set up the website estimator: switch it on, choose the projects, set the area and prices (typical prices
 * adjusted, or the company's own), copy the embed code, and try it out in the preview.
 */
export function EstimatorSettingsForm({ url, initial, canEdit, companyName, pipeline }: { url: string | null; initial: EstimatorSettings; canEdit: boolean; companyName: string; pipeline: boolean }) {
  const router = useRouter();
  const [s, setS] = React.useState<EstimatorSettings>(initial);
  const [ownPrices, setOwnPrices] = React.useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial.prices ?? {}).map(([k, v]) => [k, String(v)])));
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();

  const prices = Object.fromEntries(
    Object.entries(ownPrices).flatMap(([k, v]) => {
      const n = Math.round(Number(v.replace(/[£,\s]/g, "")));
      return v.trim() && Number.isFinite(n) && n >= 100 ? [[k, n]] : [];
    }),
  );
  const draft: EstimatorSettings = { ...s, prices: Object.keys(prices).length ? prices : undefined, headline: s.headline?.trim() || undefined };

  const save = () =>
    startTransition(async () => {
      const r = await saveEstimatorAction(draft);
      setMessage(r.ok ? { ok: true, text: "Saved. Your estimator is up to date." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });

  const link = (on: boolean, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const r = await setEstimatorLinkAction(on);
      if (!r.ok) setMessage({ ok: false, text: r.message });
      router.refresh();
    });
  };

  const toggleType = (t: ProjectType) => setS((x) => ({ ...x, types: x.types.includes(t) ? x.types.filter((y) => y !== t) : PROJECT_TYPES.filter((y) => y === t || x.types.includes(y)) }));

  return (
    <div className="grid max-w-[1200px] grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Panel className="p-5">
          <h2 className="text-[13.5px] font-semibold">On your website</h2>
          {url ? (
            <EmbedCode url={url} canEdit={canEdit} pending={pending} onNewLink={() => link(true, "Make a new link? The old link, and any website using it, stops working.")} onOff={() => link(false, "Turn the estimator off? Websites using it will show that it's not available.")} />
          ) : (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p className="text-ink-2">Turn it on to get a link and the code to paste into your website. Set it up below first if you like: it uses typical prices for your area until you change them.</p>
              {canEdit && (
                <Button onClick={() => link(true)} disabled={pending}>
                  {pending ? "Turning on…" : "Turn on the estimator"}
                </Button>
              )}
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-ink-2">
            {pipeline ? (
              "When a homeowner asks for a quote, it lands in your pipeline as a new lead with their estimate, and Admins and the office get an email."
            ) : (
              <>
                When a homeowner asks for a quote, Admins and the office get an email with their details and estimate. On the{" "}
                <Link href="/app/settings/billing" className="underline underline-offset-2">
                  Pro plan
                </Link>{" "}
                it also lands in your sales pipeline as a lead.
              </>
            )}
          </p>
        </Panel>

        <Panel className="p-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div>
              <h2 className="text-[13.5px] font-semibold">Projects you offer</h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {PROJECT_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input type="checkbox" checked={s.types.includes(t)} disabled={!canEdit} onChange={() => toggleType(t)} />
                    {PROJECTS[t].label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Your area" hint="Typical prices are adjusted for it.">
                <select value={s.region} disabled={!canEdit} onChange={(e) => setS((x) => ({ ...x, region: e.target.value as EstimatorSettings["region"] }))} className={control}>
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Your prices vs typical: ${s.adjustPct > 0 ? "+" : ""}${s.adjustPct}%`} hint="Dearer or cheaper than most firms in your area?">
                <input type="range" min={-40} max={100} step={5} value={s.adjustPct} disabled={!canEdit} onChange={(e) => setS((x) => ({ ...x, adjustPct: Number(e.target.value) }))} className="h-8 w-full accent-[#111110]" />
              </Field>
              <Field label="VAT">
                <label className="flex h-8 items-center gap-2">
                  <input type="checkbox" checked={s.vatRegistered} disabled={!canEdit} onChange={(e) => setS((x) => ({ ...x, vatRegistered: e.target.checked }))} />
                  We&apos;re VAT registered (show prices with VAT)
                </label>
              </Field>
              <Field label="Heading (optional)" hint="Shown above the estimator on its own page.">
                <input value={s.headline ?? ""} maxLength={80} disabled={!canEdit} placeholder="How much will your project cost?" onChange={(e) => setS((x) => ({ ...x, headline: e.target.value }))} className={control} />
              </Field>
            </div>

            <details className="rounded-lg bg-surface p-3">
              <summary className="cursor-pointer font-medium">Use your own prices (optional)</summary>
              <p className="mt-1.5 text-[12.5px] text-ink-2">
                Your usual price for a standard finish, including your area. Leave blank to use the typical price shown. Basic and premium finishes, sizes and the range are worked out from it.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {s.types.flatMap((t) => {
                  const spec = PROJECTS[t];
                  const rows = spec.kind === "area" ? [{ key: priceKey(t), label: `${spec.label}, per m²`, typical: spec.price }] : (spec.variants ?? []).map((v) => ({ key: priceKey(t, v.id), label: `${spec.short}: ${v.label}`, typical: v.price }));
                  return rows.map((r) => (
                    <label key={r.key} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-[12.5px]">
                      <span>{r.label}</span>
                      <input
                        inputMode="numeric"
                        disabled={!canEdit}
                        placeholder={`£${Math.round(r.typical * regionFactor(s.region) * (1 + s.adjustPct / 100)).toLocaleString("en-GB")}`}
                        value={ownPrices[r.key] ?? ""}
                        onChange={(e) => setOwnPrices((p) => ({ ...p, [r.key]: e.target.value }))}
                        className={control}
                      />
                    </label>
                  ));
                })}
              </div>
            </details>

            {canEdit && (
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={pending || s.types.length === 0}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                {s.types.length === 0 && <span className="text-[12.5px] text-danger">Choose at least one project.</span>}
                {message && <span className={message.ok ? "text-[12.5px] text-success" : "text-[12.5px] text-danger"}>{message.text}</span>}
              </div>
            )}
          </form>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[13.5px] font-semibold">Preview</h2>
          <span className="text-[12px] text-subtle">As homeowners will see it{draft.types.length ? "" : " (choose a project)"}</span>
        </div>
        {draft.types.length > 0 && <Estimator key={draft.types.join()} preview company={{ token: "preview", name: companyName, formToken: "", settings: draft }} />}
      </Panel>
    </div>
  );
}

function EmbedCode({ url, canEdit, pending, onNewLink, onOff }: { url: string; canEdit: boolean; pending: boolean; onNewLink: () => void; onOff: () => void }) {
  const origin = new URL(url).origin;
  const code = [
    `<iframe id="bos-estimator" src="${url}?embed=1" title="Project cost estimator" loading="lazy" style="width:100%;max-width:680px;height:900px;border:0"></iframe>`,
    `<p style="max-width:680px;margin:6px 0 0;font:12px/1.4 system-ui,sans-serif;color:#77756f">Cost estimator by <a href="${SITE_URL}/tools/renovation-cost-calculator" style="color:inherit">Builder OS</a></p>`,
    `<script>addEventListener("message",function(e){if(e.origin!=="${origin}"||!e.data||!e.data.bosEstimatorHeight)return;var f=document.getElementById("bos-estimator");if(f)f.style.height=e.data.bosEstimatorHeight+"px"});</script>`,
  ].join("\n");
  return (
    <div className="mt-2 flex flex-col gap-3">
      <Copyable label="Link (for your Google profile, Facebook page or emails)" value={url} open={url} />
      <Copyable label="Embed it on your website (paste into the page's HTML)" value={code} multiline />
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={pending} onClick={onNewLink}>
            New link
          </Button>
          <Button variant="ghost" disabled={pending} onClick={onOff}>
            Turn off
          </Button>
        </div>
      )}
    </div>
  );
}

function Copyable({ label, value, open, multiline }: { label: string; value: string; open?: string; multiline?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const cls = "min-w-0 flex-1 rounded-md bg-surface px-2.5 text-[12.5px] shadow-ring-input outline-none";
  return (
    <div>
      <div className="mb-1 text-[12.5px] font-medium">{label}</div>
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea readOnly value={value} rows={4} onFocus={(e) => e.target.select()} className={`${cls} py-1.5 font-mono`} />
        ) : (
          <input readOnly value={value} onFocus={(e) => e.target.select()} className={`${cls} h-8`} />
        )}
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {open && (
          <Button asChild variant="ghost">
            <a href={open} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
