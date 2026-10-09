"use client";

import * as React from "react";
import { Bath, CheckCircle2, CookingPot, Home, House, Layers, Warehouse } from "lucide-react";
import { submitEstimateEnquiry } from "@/app/estimate/actions";
import { estimate, FINISHES, FINISH_LABEL, formatPounds, PROJECTS, REGIONS, type EstimatorSettings, type Finish, type ProjectType } from "@/core/estimator";
import { cn } from "@/lib/utils";

const ICONS: Record<ProjectType, typeof Home> = {
  single_extension: Home,
  double_extension: Layers,
  loft: House,
  kitchen: CookingPot,
  bathroom: Bath,
  garage: Warehouse,
  refurb: House,
};

type Company = { token: string; name: string; formToken: string; settings: EstimatorSettings };

/**
 * The project cost estimator. On the public website (no `company`) the visitor picks their region and
 * whether to include VAT; on a builder's website the company's settings decide both, prices may be its
 * own, and the visitor can ask that company for a proper quote.
 */
export function Estimator({ company, embedded = false, preview = false }: { company?: Company; embedded?: boolean; preview?: boolean }) {
  const types = company ? company.settings.types : (Object.keys(PROJECTS) as ProjectType[]);
  const [type, setType] = React.useState<ProjectType>(types[0]!);
  const spec = PROJECTS[type];
  const [sizes, setSizes] = React.useState<Partial<Record<ProjectType, number>>>({});
  const [variants, setVariants] = React.useState<Partial<Record<ProjectType, string>>>({});
  const [finish, setFinish] = React.useState<Finish>("standard");
  const [region, setRegion] = React.useState<string>("east_midlands");
  const [vat, setVat] = React.useState(true);

  const size = sizes[type] ?? spec.defaultSize;
  const variant = variants[type] ?? spec.variants?.[0]?.id;
  const opts = company
    ? { region: company.settings.region, adjustPct: company.settings.adjustPct, vat: company.settings.vatRegistered, prices: company.settings.prices }
    : { region, vat };
  const e = estimate({ type, size, variant, finish }, opts);

  // Tell the page around the iframe how tall we are, so it can fit us without a scrollbar.
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!embedded || !root.current || window.parent === window) return;
    const send = () => window.parent.postMessage({ bosEstimatorHeight: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(root.current);
    send();
    return () => ro.disconnect();
  }, [embedded]);

  return (
    <div ref={root} className="flex flex-col gap-5 font-sans text-ink">
      <fieldset>
        <legend className="mb-2.5 text-[15px] font-semibold">What are you planning?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {types.map((t) => {
            const Icon = ICONS[t];
            const on = t === type;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setType(t)}
                className={cn("flex min-h-[64px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] leading-[1.25] font-medium transition-colors", on ? "bg-ink text-white" : "bg-white text-ink shadow-ring hover:bg-muted")}
              >
                <Icon className={cn("size-5 flex-none", on ? "text-white" : "text-ink-2")} />
                {PROJECTS[t].label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {spec.kind === "area" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="est-size" className="text-[14px] font-medium">
              {spec.sizeLabel}: <span className="tabular-nums">{size} m²</span>
            </label>
            <input
              id="est-size"
              type="range"
              min={spec.minSize}
              max={spec.maxSize}
              step={1}
              value={size}
              onChange={(ev) => setSizes((s) => ({ ...s, [type]: Number(ev.target.value) }))}
              className="h-11 w-full accent-[#111110]"
            />
            <div className="flex justify-between text-[12px] text-subtle">
              <span>{spec.minSize} m²</span>
              <span>{spec.maxSize} m²</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="est-variant" className="text-[14px] font-medium">
              Type
            </label>
            <select
              id="est-variant"
              value={variant}
              onChange={(ev) => setVariants((s) => ({ ...s, [type]: ev.target.value }))}
              className="h-11 rounded-xl bg-white px-3 text-[15px] shadow-ring-input outline-none"
            >
              {spec.variants?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!company && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="est-region" className="text-[14px] font-medium">
              Where you live
            </label>
            <select id="est-region" value={region} onChange={(ev) => setRegion(ev.target.value)} className="h-11 rounded-xl bg-white px-3 text-[15px] shadow-ring-input outline-none">
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-[14px] font-medium">Finish</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Finish">
          {FINISHES.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={f === finish}
              onClick={() => setFinish(f)}
              className={cn("flex min-h-11 flex-col items-center justify-center rounded-[9px] px-2 py-1.5 text-[13.5px] leading-[1.2] font-medium", f === finish ? "bg-white text-ink shadow-ring" : "text-ink-2")}
            >
              {FINISH_LABEL[f].label}
              <span className="mt-0.5 text-[11.5px] font-normal text-subtle">{FINISH_LABEL[f].sub}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {e && (
        <div className="rounded-2xl bg-brand-tint p-5 shadow-[0_0_0_1px_rgb(227_103_46/0.25)]" aria-live="polite">
          <div className="text-[14px] font-medium text-ink-2">{company ? `${company.name}${company.name.endsWith("s") ? "'" : "'s"} guide price` : "Typical cost"}</div>
          <div className="mt-1 text-[clamp(28px,6vw,40px)] leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums">
            {formatPounds(e.low)} to {formatPounds(e.high)}
          </div>
          <div className="mt-2 text-[14px] text-ink-2">
            {e.vat ? "Including VAT." : "No VAT to add."}
            {e.perM2 && ` About ${formatPounds(e.perM2.low)} to ${formatPounds(e.perM2.high)} per m².`}
          </div>
          {!company && (
            <label className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-2">
              <input type="checkbox" checked={vat} onChange={(ev) => setVat(ev.target.checked)} className="size-4 accent-[#111110]" />
              Include VAT (most builders are VAT registered)
            </label>
          )}
          <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">
            <span className="font-medium text-ink">Not included:</span> {spec.excludes}
          </p>
        </div>
      )}

      {company ? (
        <QuoteRequest company={company} preview={preview} project={{ type, size: spec.kind === "area" ? size : undefined, variant: spec.kind === "variant" ? variant : undefined, finish }} />
      ) : null}

      <p className="text-[12px] leading-[1.5] text-subtle">
        A guide price only, to help you plan. {company ? `${company.name} will confirm the real price after seeing the job.` : "Every home is different, so get quotes from builders who've seen the job."}
      </p>
    </div>
  );
}

function QuoteRequest({ company, project, preview }: { company: Company; project: { type: ProjectType; size?: number; variant?: string; finish: Finish }; preview: boolean }) {
  const [v, setV] = React.useState({ name: "", email: "", phone: "", postcode: "", message: "", website: "" });
  const [state, setState] = React.useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string }>({ status: "idle" });
  const field = "h-11 w-full min-w-0 rounded-xl bg-white px-3 text-[15px] shadow-ring-input outline-none placeholder:text-faint focus:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]";

  if (state.status === "sent") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-success-soft p-4 text-[15px]">
        <CheckCircle2 className="mt-0.5 size-5 flex-none text-success" />
        <div>
          <div className="font-semibold">Thanks, {v.name.split(" ")[0]}.</div>
          <div className="text-ink-2">{company.name} has your details and will be in touch to arrange a proper quote.</div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="relative flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-ring"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (preview) return setState({ status: "error", message: "This is a preview: on your website, this sends you the enquiry." });
        setState({ status: "sending" });
        const r = await submitEstimateEnquiry(company.token, {
          name: v.name.trim(),
          email: v.email.trim(),
          phone: v.phone.trim() || undefined,
          postcode: v.postcode.trim() || undefined,
          message: v.message.trim() || undefined,
          project,
          website: v.website || undefined,
          formToken: company.formToken,
        }).catch(() => ({ ok: false as const, message: "That didn't send. Please check your connection and try again." }));
        setState(r.ok ? { status: "sent" } : { status: "error", message: r.message });
      }}
    >
      <div>
        <div className="text-[16px] font-semibold">Get an accurate quote from {company.name}</div>
        <div className="text-[13.5px] text-ink-2">Leave your details and they&apos;ll be in touch. Your estimate is included.</div>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={(ev) => setV({ ...v, website: ev.target.value })} />
        </label>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input aria-label="Your name" required autoComplete="name" placeholder="Your name" className={field} value={v.name} onChange={(ev) => setV({ ...v, name: ev.target.value })} />
        <input aria-label="Email" required type="email" autoComplete="email" placeholder="Email" className={field} value={v.email} onChange={(ev) => setV({ ...v, email: ev.target.value })} />
        <input aria-label="Phone" type="tel" autoComplete="tel" placeholder="Phone (optional)" className={field} value={v.phone} onChange={(ev) => setV({ ...v, phone: ev.target.value })} />
        <input aria-label="Postcode" autoComplete="postal-code" placeholder="Postcode" className={field} value={v.postcode} onChange={(ev) => setV({ ...v, postcode: ev.target.value })} />
      </div>
      <textarea aria-label="Anything else" placeholder="Anything else they should know? (optional)" className={cn(field, "h-auto min-h-[76px] py-2.5")} value={v.message} onChange={(ev) => setV({ ...v, message: ev.target.value })} />
      {state.status === "error" && <p className="text-[14px] text-danger">{state.message}</p>}
      <button type="submit" disabled={state.status === "sending"} className="h-12 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-60">
        {state.status === "sending" ? "Sending…" : "Ask for a quote"}
      </button>
      <p className="text-[12px] text-subtle">Your details go to {company.name} only, to reply to you.</p>
    </form>
  );
}
