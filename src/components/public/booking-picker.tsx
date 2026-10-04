"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { bookVisitAction, cancelVisitAction } from "@/app/book/actions";
import { cn } from "@/lib/utils";

export type SlotOption = { day: string; dayShort: string; time: string; iso: string };

const field = "h-12 w-full rounded-xl bg-surface px-3.5 text-[15px] shadow-ring-input outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)]";

/** Pick a day, then a time, check how to reach you, book. Or move/cancel a booked visit. */
export function BookingPicker({ token, slots, booked, company, details }: { token: string; slots: SlotOption[]; booked: boolean; company: string; details: { phone: string; addressLine: string; postcode: string } }) {
  const router = useRouter();
  const days = React.useMemo(() => {
    const map = new Map<string, SlotOption[]>();
    for (const s of slots) map.set(s.day, [...(map.get(s.day) ?? []), s]);
    return [...map.entries()];
  }, [slots]);
  const [picking, setPicking] = React.useState(!booked);
  const [day, setDay] = React.useState(days[0]?.[0] ?? "");
  const [slot, setSlot] = React.useState<SlotOption | null>(null);
  const [v, setV] = React.useState(details);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();

  const book = () =>
    startTransition(async () => {
      if (!slot) return;
      setMessage(undefined);
      const r = await bookVisitAction(token, { startsAt: slot.iso, phone: v.phone.trim() || undefined, addressLine: v.addressLine.trim() || undefined, postcode: v.postcode.trim() || undefined });
      if (!r.ok) {
        setSlot(null);
        router.refresh();
        return setMessage({ ok: false, text: r.message });
      }
      setMessage({ ok: true, text: `Booked: ${slot.day} at ${slot.time}. We've emailed you a confirmation.` });
      setPicking(false);
      setSlot(null);
      router.refresh();
    });

  const cancel = () =>
    startTransition(async () => {
      if (!window.confirm("Cancel your survey visit?")) return;
      const r = await cancelVisitAction(token);
      setMessage(r.ok ? { ok: true, text: "Your visit is cancelled. You can book another time whenever you're ready." } : { ok: false, text: r.message });
      if (r.ok) setPicking(slots.length > 0);
      router.refresh();
    });

  if (!picking) {
    return (
      <div className="flex flex-col gap-3">
        {message && <Note {...message} />}
        {booked && (
          <div className="flex flex-wrap gap-2">
            {slots.length > 0 && (
              <button type="button" onClick={() => setPicking(true)} className="h-12 rounded-xl bg-ink px-5 font-semibold text-white">
                Move it
              </button>
            )}
            <button type="button" onClick={cancel} disabled={pending} className="h-12 rounded-xl bg-white px-5 font-semibold shadow-ring">
              Cancel the visit
            </button>
          </div>
        )}
      </div>
    );
  }

  if (days.length === 0) {
    return <p className="text-ink-2">There are no times free online at the moment. {company} will be in touch to arrange one.</p>;
  }

  const times = days.find(([d]) => d === day)?.[1] ?? [];
  return (
    <div className="flex flex-col gap-4">
      {message && <Note {...message} />}
      <div>
        <div className="mb-2 text-[13px] font-medium">Choose a day</div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map(([d, list]) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDay(d);
                setSlot(null);
              }}
              aria-pressed={d === day}
              className={cn("flex min-w-[88px] flex-none flex-col items-center rounded-xl px-3 py-2.5 shadow-ring", d === day ? "bg-ink text-white" : "bg-white hover:bg-surface")}
            >
              <span className="text-[13px] font-semibold">{list[0].dayShort.split(" ")[0]}</span>
              <span className="text-[15px] tabular">{list[0].dayShort.split(" ").slice(1).join(" ")}</span>
              <span className={cn("text-[11.5px]", d === day ? "text-white/70" : "text-subtle")}>{list.length} free</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-medium">{day}</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {times.map((t) => (
            <button
              key={t.iso}
              type="button"
              onClick={() => setSlot(t)}
              aria-pressed={slot?.iso === t.iso}
              className={cn("h-12 rounded-xl font-semibold tabular shadow-ring", slot?.iso === t.iso ? "bg-ink text-white" : "bg-white hover:bg-surface")}
            >
              {t.time}
            </button>
          ))}
        </div>
      </div>
      {slot && (
        <form
          className="flex flex-col gap-3 rounded-xl bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            book();
          }}
        >
          <div className="font-semibold">
            {slot.day} at {slot.time}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium">Address of the property</span>
            <input value={v.addressLine} onChange={(e) => setV((x) => ({ ...x, addressLine: e.target.value }))} required maxLength={300} autoComplete="street-address" className={cn(field, "bg-white")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium">Postcode</span>
              <input value={v.postcode} onChange={(e) => setV((x) => ({ ...x, postcode: e.target.value }))} required maxLength={10} autoComplete="postal-code" className={cn(field, "bg-white uppercase")} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium">Phone</span>
              <input type="tel" value={v.phone} onChange={(e) => setV((x) => ({ ...x, phone: e.target.value }))} required maxLength={30} autoComplete="tel" className={cn(field, "bg-white")} />
            </label>
          </div>
          <button type="submit" disabled={pending} className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-60">
            {pending ? "Booking…" : booked ? "Move my visit to this time" : "Book this time"}
          </button>
        </form>
      )}
      {booked && (
        <button type="button" onClick={() => setPicking(false)} className="self-start text-[14px] text-ink-2 underline underline-offset-2">
          Keep my current time
        </button>
      )}
    </div>
  );
}

function Note({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl p-3 text-[14px]", ok ? "bg-success-soft text-ink" : "bg-danger-soft text-danger")}>
      {ok && <CheckCircle2 className="mt-0.5 size-4 flex-none text-success" />}
      {text}
    </p>
  );
}
