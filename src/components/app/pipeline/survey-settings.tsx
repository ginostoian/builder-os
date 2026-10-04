"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { saveSurveyHoursAction, saveSurveySettingsAction } from "@/app/app/pipeline/survey-actions";
import { Button } from "@/components/ui/button";
import { WEEKDAYS, minuteLabel, parsePostcodeAreas, type SurveySettings, type SurveyWindow } from "@/core/surveys";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";

const LENGTHS = [30, 45, 60, 90, 120];
const BUFFERS = [0, 15, 30, 45, 60, 90];
const NOTICE = [
  { hours: 0, label: "No notice" },
  { hours: 2, label: "2 hours" },
  { hours: 24, label: "1 day" },
  { hours: 48, label: "2 days" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
];
const AHEAD = [7, 14, 21, 28, 42, 60];
const TIMES = Array.from({ length: (22 - 6) * 2 + 1 }, (_, i) => 6 * 60 + i * 30);

const mins = (m: number) => (m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`);

/** The company's booking rules. */
export function SurveySettingsForm({ settings }: { settings: SurveySettings }) {
  const router = useRouter();
  const [v, setV] = React.useState({ ...settings, areas: settings.postcodes.join(", ") });
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const num = (k: "visitMinutes" | "bufferMinutes" | "minNoticeHours" | "maxDaysAhead") => (e: React.ChangeEvent<HTMLSelectElement>) => setV((x) => ({ ...x, [k]: Number(e.target.value) }));

  const save = () =>
    startTransition(async () => {
      setMessage(undefined);
      const postcodes = parsePostcodeAreas(v.areas);
      const r = await saveSurveySettingsAction({ enabled: v.enabled, visitMinutes: v.visitMinutes, bufferMinutes: v.bufferMinutes, minNoticeHours: v.minNoticeHours, maxDaysAhead: v.maxDaysAhead, postcodes });
      setMessage(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.message });
      if (r.ok) {
        setV((x) => ({ ...x, areas: postcodes.join(", ") }));
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={v.enabled} onChange={(e) => setV((x) => ({ ...x, enabled: e.target.checked }))} className="mt-0.5 size-4" />
        <span>
          <span className="block font-medium">Let clients book online</span>
          <span className="block text-[12.5px] text-ink-2">Off: booking links say you&apos;ll be in touch to arrange a time.</span>
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="A visit takes">
          <select value={v.visitMinutes} onChange={num("visitMinutes")} className={control}>
            {LENGTHS.map((m) => (
              <option key={m} value={m}>
                {mins(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Travel time before and after">
          <select value={v.bufferMinutes} onChange={num("bufferMinutes")} className={control}>
            {BUFFERS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "None" : mins(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Earliest booking">
          <select value={v.minNoticeHours} onChange={num("minNoticeHours")} className={control}>
            {NOTICE.map((n) => (
              <option key={n.hours} value={n.hours}>
                {n.hours === 0 ? n.label : `${n.label} from now`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Furthest ahead">
          <select value={v.maxDaysAhead} onChange={num("maxDaysAhead")} className={control}>
            {AHEAD.map((d) => (
              <option key={d} value={d}>
                {d % 7 === 0 ? `${d / 7} week${d === 7 ? "" : "s"}` : `${d} days`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Postcode areas you cover" hint="E.g. LS, BD1, HX. People outside them are told you'll call. Leave empty for anywhere.">
        <input value={v.areas} onChange={(e) => setV((x) => ({ ...x, areas: e.target.value }))} placeholder="Anywhere" className={control} />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {message && <span className={cn("text-[12.5px]", message.ok ? "text-success" : "text-danger")}>{message.text}</span>}
      </div>
    </div>
  );
}

type Window = Omit<SurveyWindow, "memberId">;

/** Who does surveys, and when. Each person's week, UK time; a day can have more than one window. */
export function SurveyHoursEditor({ people, hours }: { people: { id: string; name: string }[]; hours: SurveyWindow[] }) {
  const router = useRouter();
  const withHours = people.filter((p) => hours.some((h) => h.memberId === p.id));
  const [memberId, setMemberId] = React.useState(withHours[0]?.id ?? people[0]?.id ?? "");
  const [week, setWeek] = React.useState<Window[]>(() => hours.filter((h) => h.memberId === memberId).map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })));
  const [message, setMessage] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();

  const choose = (id: string) => {
    setMemberId(id);
    setWeek(hours.filter((h) => h.memberId === id).map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })));
    setMessage(undefined);
  };
  const update = (i: number, patch: Partial<Window>) => setWeek((w) => w.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = (weekday: number) => {
    const last = week.filter((w) => w.weekday === weekday).at(-1);
    const start = last ? Math.min(last.endMinute + 60, 20 * 60) : 9 * 60;
    setWeek((w) => [...w, { weekday, startMinute: start, endMinute: Math.min(start + (last ? 120 : 8 * 60), 22 * 60) }]);
  };
  const weekdaysOnly = () => setWeek([1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 17 * 60 })));

  const save = () =>
    startTransition(async () => {
      setMessage(undefined);
      const r = await saveSurveyHoursAction({ memberId, windows: week });
      setMessage(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });

  if (people.length === 0) return <p className="text-ink-2">Add people to your team first.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Who does surveys, and when</h2>
          <p className="text-[12.5px] text-ink-2">Clients are only offered times when someone is free. Bookings are shared out between people free at the same time.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => {
          const n = hours.filter((h) => h.memberId === p.id).length;
          return (
            <button key={p.id} type="button" onClick={() => choose(p.id)} className={cn("rounded-full px-3 py-1 text-[12.5px] shadow-ring", p.id === memberId ? "bg-ink text-white" : "bg-white hover:bg-surface")}>
              {p.name}
              {n > 0 && <span className={cn("ml-1.5", p.id === memberId ? "text-white/70" : "text-subtle")}>· surveys</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col divide-y divide-hairline rounded-lg shadow-ring">
        {WEEKDAYS.map((label, d) => {
          const weekday = d + 1;
          const rows = week.map((w, i) => ({ w, i })).filter((x) => x.w.weekday === weekday);
          return (
            <div key={label} className="flex items-start gap-3 px-3 py-2">
              <div className="w-[90px] pt-1.5 text-[13px] font-medium">{label}</div>
              <div className="flex flex-1 flex-col gap-1.5">
                {rows.length === 0 && <div className="pt-1.5 text-[12.5px] text-subtle">Not available</div>}
                {rows.map(({ w, i }) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select value={w.startMinute} onChange={(e) => update(i, { startMinute: Number(e.target.value) })} aria-label={`${label} from`} className={cn(control, "h-8 w-[88px]")}>
                      {TIMES.map((m) => (
                        <option key={m} value={m}>
                          {minuteLabel(m)}
                        </option>
                      ))}
                    </select>
                    <span className="text-subtle">to</span>
                    <select value={w.endMinute} onChange={(e) => update(i, { endMinute: Number(e.target.value) })} aria-label={`${label} until`} className={cn(control, "h-8 w-[88px]")}>
                      {TIMES.map((m) => (
                        <option key={m} value={m}>
                          {minuteLabel(m)}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setWeek((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="rounded p-1 text-subtle hover:bg-accent hover:text-ink">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => add(weekday)} aria-label={`Add hours on ${label}`} className="mt-1 rounded p-1 text-subtle hover:bg-accent hover:text-ink">
                <Plus className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={pending || !memberId}>
          {pending ? "Saving…" : `Save ${people.find((p) => p.id === memberId)?.name.split(" ")[0] ?? ""}'s hours`}
        </Button>
        <Button variant="ghost" onClick={weekdaysOnly} disabled={pending}>
          Mon–Fri, 9 to 5
        </Button>
        {week.length > 0 && (
          <Button variant="ghost" onClick={() => setWeek([])} disabled={pending}>
            No surveys
          </Button>
        )}
        {message && <span className={cn("text-[12.5px]", message.ok ? "text-success" : "text-danger")}>{message.text}</span>}
      </div>
    </div>
  );
}
