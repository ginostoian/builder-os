"use client";

import * as React from "react";
import { BatteryFull, Camera, Check, Clock, FileDiff, House, Images, ListChecks, LogIn, LogOut, Navigation, Signal, Wifi } from "lucide-react";
import { employeeDay } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Today", icon: House },
  { label: "Tasks", icon: ListChecks },
  { label: "Photos", icon: Images },
  { label: "Hours", icon: Clock },
];

/** Site staff PWA. 44px targets throughout: used on phones, often with gloves on. */
export function EmployeeAppScreen() {
  const [tasks, setTasks] = React.useState(employeeDay.tasks);
  const [checkedIn, setCheckedIn] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("Today");
  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="flex h-full flex-col bg-surface font-sans text-sm leading-[1.4] text-ink antialiased">
      <div className="flex h-12 flex-none items-center justify-between px-7 text-sm font-semibold" aria-hidden>
        <span>9:41</span>
        <span className="flex items-center gap-[5px]">
          <Signal className="size-3.5" />
          <Wifi className="size-3.5" />
          <BatteryFull className="size-4" />
        </span>
      </div>
      <div className="flex items-center gap-3 px-5 pt-2 pb-3.5">
        <div className="flex-1">
          <div className="text-[13px] text-subtle">{employeeDay.date}</div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{employeeDay.greeting}</h1>
        </div>
        <div className="flex size-10 items-center justify-center rounded-full bg-av-sage text-[13px] font-semibold text-ink-3">{employeeDay.initials}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <section className="rounded-[18px] bg-ink px-[18px] py-4 text-white">
          <div className="flex items-center justify-between text-[12.5px] text-night-text">
            <span>Today&apos;s site</span>
            <span>{checkedIn ? `Checked in ${checkedIn}` : employeeDay.hours}</span>
          </div>
          <div className="mt-1.5 mb-0.5 text-lg font-semibold tracking-[-0.01em]">{employeeDay.site}</div>
          <div className="text-[13px] text-night-text">{employeeDay.job}</div>
          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setCheckedIn((c) => (c ? null : new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })))
              }
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-ink"
            >
              {checkedIn ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
              {checkedIn ? "Check out" : "Check in"}
            </button>
            <button type="button" aria-label="Directions to site" className="flex size-11 items-center justify-center rounded-xl bg-night-line">
              <Navigation className="size-4" />
            </button>
          </div>
        </section>

        <div className="flex items-baseline justify-between px-1 pt-1">
          <span className="font-semibold">Your tasks</span>
          <span className="text-[13px] text-subtle">
            {done} of {tasks.length} done
          </span>
        </div>
        <ul className="overflow-hidden rounded-2xl bg-white shadow-ring">
          {tasks.map((t) => (
            <li key={t.id} className="border-b border-line last:border-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                onClick={() => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                className="flex min-h-[54px] w-full items-center gap-3 px-3.5 text-left"
              >
                <span
                  className={cn(
                    "flex size-[22px] flex-none items-center justify-center rounded-[7px] text-white",
                    t.done ? "bg-ink" : "bg-white shadow-[inset_0_0_0_1.5px_#D6D5CF]",
                  )}
                >
                  <Check className="size-[13px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-medium", t.done ? "text-subtle line-through" : "text-ink")}>{t.title}</span>
                  <span className="block text-xs text-subtle">{t.meta}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <label className="flex h-[52px] flex-none cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-white font-semibold shadow-ring">
          <Camera className="size-[17px]" />
          Add progress photos
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" />
        </label>
        <div className="flex gap-2.5 rounded-[14px] bg-brand-soft px-3.5 py-3 text-[13px] leading-[1.45] text-brand-deep">
          <FileDiff className="mt-px size-4 flex-none" />
          <span>
            <b className="font-semibold">{employeeDay.variation.ref} approved by client.</b> {employeeDay.variation.text}
          </span>
        </div>
      </div>

      <nav className="flex h-[78px] flex-none border-t border-hairline bg-white px-2 pt-2 pb-[22px]" aria-label="Employee app">
        {tabs.map((t) => (
          <button
            key={t.label}
            type="button"
            aria-current={t.label === tab ? "page" : undefined}
            onClick={() => setTab(t.label)}
            className={cn("flex flex-1 flex-col items-center gap-[3px] text-[11px] font-medium", t.label === tab ? "text-ink" : "text-night-text")}
          >
            <t.icon className="size-5" strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
