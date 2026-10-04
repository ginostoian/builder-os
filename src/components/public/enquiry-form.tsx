"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { submitEnquiry } from "@/app/enquire/actions";
import { BUDGETS, LEAD_SOURCES, LEAD_SOURCE_LABEL, PROJECT_TYPES } from "@/core/pipeline";

const field = "h-12 w-full rounded-xl bg-surface px-3.5 text-[15px] shadow-ring-input outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)]";

/** The enquiry form people fill in on a company's website. Big, plain, works on a phone. */
export function EnquiryForm({ token, company }: { token: string; company: string }) {
  const [startedAt] = React.useState(() => Date.now());
  const [v, setV] = React.useState({ name: "", email: "", phone: "", postcode: "", projectType: "", budget: "", description: "", heardFrom: "", website: "" });
  const [error, setError] = React.useState<string>();
  const [done, setDone] = React.useState(false);
  const [booking, setBooking] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const opt = (s: string) => s.trim() || undefined;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="size-9 text-success" strokeWidth={1.5} />
        <h2 className="text-lg font-semibold">Thanks, {v.name.split(" ")[0]}!</h2>
        <p className="max-w-[380px] text-ink-2">Your enquiry is with {company}. {booking ? "Want to get a visit in the diary now?" : "They'll be in touch soon."}</p>
        {booking && (
          // A new tab, so it works the same when the form is embedded in a website.
          <a href={booking} target="_blank" rel="noopener" className="mt-2 flex h-12 items-center rounded-xl bg-ink px-6 font-semibold text-white">
            Book your free survey
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const r = await submitEnquiry(token, {
            name: v.name.trim(),
            email: v.email.trim().toLowerCase(),
            phone: opt(v.phone),
            postcode: opt(v.postcode),
            projectType: opt(v.projectType),
            budget: opt(v.budget),
            description: opt(v.description),
            heardFrom: (opt(v.heardFrom) as (typeof LEAD_SOURCES)[number] | undefined) ?? undefined,
            website: v.website || undefined,
            startedAt,
          });
          if (r.ok) {
            setBooking(r.booking);
            setDone(true);
          }
          else setError(r.message);
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium">Your name</span>
        <input value={v.name} onChange={set("name")} required maxLength={120} autoComplete="name" className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">Email</span>
          <input type="email" value={v.email} onChange={set("email")} required maxLength={254} autoComplete="email" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">Phone</span>
          <input type="tel" value={v.phone} onChange={set("phone")} maxLength={30} autoComplete="tel" className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">What&apos;s the work?</span>
          <select value={v.projectType} onChange={set("projectType")} className={field}>
            <option value="">Choose…</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">Postcode of the property</span>
          <input value={v.postcode} onChange={set("postcode")} maxLength={10} autoComplete="postal-code" className={`${field} uppercase`} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium">Tell us a bit more</span>
        <textarea value={v.description} onChange={set("description")} maxLength={2000} rows={4} placeholder="What you'd like done, rough sizes, when you'd like to start…" className={`${field} h-auto resize-y py-3 leading-normal`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">Rough budget</span>
          <select value={v.budget} onChange={set("budget")} className={field}>
            <option value="">Prefer not to say</option>
            {BUDGETS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">How did you hear about us?</span>
          <select value={v.heardFrom} onChange={set("heardFrom")} className={field}>
            <option value="">Choose…</option>
            {LEAD_SOURCES.filter((s) => s !== "website").map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* People never see this; bots fill it in. */}
      <input type="text" name="website" value={v.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
      {error && <p className="text-danger">{error}</p>}
      <button type="submit" disabled={pending} className="mt-1 h-12 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-60">
        {pending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
