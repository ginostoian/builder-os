"use client";

import * as React from "react";
import { ArrowLeft, Calendar, CalendarCheck, ChevronLeft, ChevronRight, Clock, Globe, Video } from "lucide-react";
import { Avatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { cn } from "@/lib/utils";

/**
 * Demo booking flow: pick a day, pick a time, add details, confirm.
 * Availability is mocked; the plan is to back this with a Cal.com embed (Technical Implementation Plan §2).
 */
const TODAY = { y: 2026, m: 9, d: 1 }; // 1 October 2026 (months are 0-based)
const LAST_MONTH_OFFSET = 2; // book up to two months ahead
const BANK_HOLIDAYS_AND_LEAVE = new Set(["2026-10-16", "2026-12-25", "2026-12-28"]);
const SLOTS = ["09:00", "09:30", "10:30", "11:00", "13:00", "14:00", "15:30", "16:30"];
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const JOB_TYPES = ["Extensions", "Lofts", "Kitchens", "Bathrooms", "Full renovations"];

const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Monday-first weekday index, 0 = Monday. */
const weekday = (y: number, m: number, d: number) => (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;

function isAvailable(y: number, m: number, d: number) {
  const afterToday = y > TODAY.y || m > TODAY.m || d > TODAY.d;
  return afterToday && weekday(y, m, d) < 5 && !BANK_HOLIDAYS_AND_LEAVE.has(key(y, m, d));
}

function slotsFor(d: number) {
  return SLOTS.filter((_, i) => (d + i) % 4 !== 0);
}

function londonZone(y: number, m: number, d: number) {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "short" })
    .formatToParts(new Date(Date.UTC(y, m, d, 12)))
    .find((p) => p.type === "timeZoneName")?.value;
  return name === "GMT+1" ? "BST" : (name ?? "GMT");
}

export function DemoBooking() {
  const [offset, setOffset] = React.useState(0);
  const [day, setDay] = React.useState<number>(6);
  const [time, setTime] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<"pick" | "details" | "done">("pick");
  const [job, setJob] = React.useState("Extensions");

  const view = new Date(Date.UTC(TODAY.y, TODAY.m + offset, 1));
  const y = view.getUTCFullYear();
  const m = view.getUTCMonth();
  const monthName = view.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = weekday(y, m, 1);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const dayLabel = new Date(Date.UTC(y, m, day)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  function changeMonth(delta: number) {
    const next = offset + delta;
    setOffset(next);
    const v = new Date(Date.UTC(TODAY.y, TODAY.m + next, 1));
    const first = Array.from({ length: 31 }, (_, i) => i + 1).find((d) => isAvailable(v.getUTCFullYear(), v.getUTCMonth(), d));
    setDay(first ?? 1);
    setTime(null);
  }

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_#E8E7E3,0_30px_60px_-30px_rgb(16_16_15/0.22)]">
      <div className="flex items-center gap-3.5 border-b border-hairline px-6 py-[22px]">
        <Avatar initials="MR" tint="#DCE5DF" size={44} className="text-sm text-ink-3" />
        <div className="flex-1">
          <div className="text-[13px] text-subtle">Marcus Reid · Builder OS</div>
          <div className="text-[17px] font-semibold tracking-[-0.01em]">Builder OS walkthrough</div>
        </div>
        <div className="flex flex-col items-end gap-1 text-[13px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <Clock className="size-[13px]" />
            20 min
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="size-[13px]" />
            Google Meet
          </span>
        </div>
      </div>

      {step === "pick" && (
        <div className="flex flex-wrap">
          <div className="flex-[1_1_320px] px-6 py-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[15.5px] font-semibold" aria-live="polite">
                {monthName} <span className="font-medium text-subtle">{y}</span>
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  disabled={offset === 0}
                  onClick={() => changeMonth(-1)}
                  className="flex size-[30px] items-center justify-center rounded-lg shadow-ring disabled:text-faint disabled:shadow-none"
                >
                  <ChevronLeft className="size-[15px]" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  disabled={offset === LAST_MONTH_OFFSET}
                  onClick={() => changeMonth(1)}
                  className="flex size-[30px] items-center justify-center rounded-lg shadow-ring disabled:text-faint disabled:shadow-none"
                >
                  <ChevronRight className="size-[15px]" />
                </button>
              </div>
            </div>
            <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11.5px] font-medium text-subtle" aria-hidden>
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${monthName} ${y}`}>
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} />;
                const avail = isAvailable(y, m, d);
                const selected = d === day;
                const isToday = offset === 0 && d === TODAY.d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!avail}
                    aria-pressed={selected}
                    aria-label={new Date(Date.UTC(y, m, d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                    onClick={() => {
                      setDay(d);
                      setTime(null);
                    }}
                    className={cn(
                      "relative aspect-square rounded-[10px] text-sm font-medium transition-colors duration-[120ms]",
                      selected ? "bg-ink text-white" : avail ? "bg-line text-ink hover:bg-border" : "cursor-default text-faint",
                    )}
                  >
                    {d}
                    {isToday && <span className={cn("absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full", selected ? "bg-white" : "bg-ink")} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-[1_1_220px] flex-col gap-2 border-l border-hairline px-6 py-[22px]">
            <div className="mb-2 text-[15px] font-semibold">{dayLabel}</div>
            {slotsFor(day).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTime(t);
                  setStep("details");
                }}
                className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-white text-[14.5px] font-medium shadow-ring-input transition-colors duration-[120ms] hover:bg-surface"
              >
                <span className="size-1.5 rounded-full bg-success" />
                {t}
              </button>
            ))}
            <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-subtle">
              <Globe className="size-3" />
              Europe/London ({londonZone(y, m, day)})
            </div>
          </div>
        </div>
      )}

      {step === "details" && (
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("done");
          }}
        >
          <button type="button" onClick={() => setStep("pick")} className="flex items-center gap-1.5 self-start text-sm font-medium text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted px-3.5 py-3 text-[14.5px]">
            <Calendar className="size-[15px] text-ink-2" />
            <b className="font-medium">{dayLabel}</b>
            <span className="text-ink-2">· {time}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
            <Label>
              Your name
              <Input name="name" required autoComplete="name" placeholder="James Hale" />
            </Label>
            <Label>
              Work email
              <Input name="email" type="email" required autoComplete="email" placeholder="james@halesons.co.uk" />
            </Label>
          </div>
          <Label>
            Company
            <Input name="company" autoComplete="organization" placeholder="Hale & Sons Renovations" />
          </Label>
          <fieldset className="flex flex-col gap-2 text-[13.5px] font-medium">
            <legend className="mb-2">What do you mostly quote?</legend>
            <div className="flex flex-wrap gap-1.5">
              {JOB_TYPES.map((j) => (
                <ToggleChip key={j} active={j === job} onClick={() => setJob(j)} className="h-[34px] rounded-[9px] px-3 text-[13.5px]">
                  {j}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
          <Button type="submit" size="lg" className="mt-1 w-full">
            Confirm booking
          </Button>
        </form>
      )}

      {step === "done" && (
        <div role="status" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-success-soft text-success">
            <CalendarCheck className="size-[22px]" />
          </span>
          <div className="text-[21px] font-semibold tracking-[-0.02em]">You&apos;re booked in.</div>
          <div className="max-w-[340px] text-[15px] leading-[1.55] text-ink-2">
            {dayLabel} at {time} with Marcus. A calendar invite and Meet link are on their way.
          </div>
          <Button
            variant="outline"
            className="mt-2 h-[38px] rounded-[10px] px-3.5 text-sm"
            onClick={() => {
              setStep("pick");
              setTime(null);
            }}
          >
            Pick another time
          </Button>
        </div>
      )}
    </div>
  );
}
