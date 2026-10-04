"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowRight, Check, EyeOff, PlayCircle, Sparkles, X } from "lucide-react";
import type { ChapterState, StepState } from "@/core/onboarding";
import { onboardingAction } from "@/app/onboarding-actions";
import { cn } from "@/lib/utils";
import { GuideChapters } from "./guide-chapters";
import { OPEN_GUIDE, START_TOUR } from "./events";
import { ProgressRing } from "./progress-ring";

export type GuideProps = {
  chapters: ChapterState[];
  percent: number;
  done: number;
  total: number;
  level: number;
  levels: number;
  complete: boolean;
  next: StepState | null;
  hidden: boolean;
  tourDone: boolean;
  firstName: string;
};

/**
 * Getting started, in the office app's top bar: a progress pill that opens the guide, the guided tour
 * (first visit to the dashboard, or on request), and a short note when a chapter is finished.
 */
export function Onboarding({ guide, autoTour }: { guide: GuideProps; autoTour: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [touring, setTouring] = React.useState(false);

  // Asked for by link (?tour=1, ?guide=1), by event, or the first time someone lands on the dashboard.
  React.useEffect(() => {
    const wantsTour = params.get("tour") === "1";
    const wantsGuide = params.get("guide") === "1";
    if (wantsTour || wantsGuide) {
      const rest = new URLSearchParams(params);
      rest.delete("tour");
      rest.delete("guide");
      router.replace(`${pathname}${rest.size ? `?${rest}` : ""}`, { scroll: false });
      const t = window.setTimeout(() => (wantsTour ? setTouring(true) : setOpen(true)), 0);
      return () => window.clearTimeout(t);
    }
    if (autoTour && !guide.tourDone) {
      const t = window.setTimeout(() => setTouring(true), 700);
      return () => window.clearTimeout(t);
    }
  }, [params, pathname, router, autoTour, guide.tourDone]);

  React.useEffect(() => {
    const onGuide = () => setOpen(true);
    const onTour = () => {
      setOpen(false);
      setTouring(true);
    };
    window.addEventListener(OPEN_GUIDE, onGuide);
    window.addEventListener(START_TOUR, onTour);
    return () => {
      window.removeEventListener(OPEN_GUIDE, onGuide);
      window.removeEventListener(START_TOUR, onTour);
    };
  }, []);

  const endTour = React.useCallback(() => {
    setTouring(false);
    if (!guide.tourDone) void onboardingAction({ op: "tour_done" }).then(() => router.refresh());
  }, [guide.tourDone, router]);

  const showPill = !guide.hidden && !guide.complete;
  return (
    <>
      {showPill && (
        <button
          type="button"
          data-tour="guide"
          onClick={() => setOpen(true)}
          className="flex h-8 items-center gap-2 rounded-full bg-white pr-3 pl-2 text-[12px] font-medium text-ink shadow-ring hover:bg-surface"
          aria-label={`Getting started, ${guide.percent}% done`}
        >
          <ProgressRing percent={guide.percent} className="text-brand" />
          Getting started
          <span className="text-subtle tabular">{guide.percent}%</span>
        </button>
      )}
      <GuideSheet guide={guide} open={open} onOpenChange={setOpen} onTour={() => {
          setOpen(false);
          setTouring(true);
        }} />
      {touring && (
        <Tour
          firstName={guide.firstName}
          // The tour itself is about to be done: point at the step after it.
          next={guide.chapters.flatMap((c) => c.steps).find((st) => st.state === "todo" && st.id !== "tour") ?? null}
          onEnd={endTour}
        />
      )}
      <ChapterToast chapters={guide.chapters} level={guide.level} levels={guide.levels} />
    </>
  );
}

// ── The guide ────────────────────────────────────────────────────────────────

function GuideSheet({ guide, open, onOpenChange, onTour }: { guide: GuideProps; open: boolean; onOpenChange: (open: boolean) => void; onTour: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const current = guide.chapters.filter((c) => !c.locked)[guide.level - 1];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-0 right-0 z-50 flex h-full w-[min(440px,100vw)] flex-col bg-surface-2 text-[13px] text-ink shadow-pop outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          <div className="border-b border-hairline bg-white px-5 pt-4 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-[17px] font-semibold tracking-[-0.01em]">Getting started</Dialog.Title>
                <div className="mt-0.5 text-subtle">
                  {guide.complete ? "Every chapter done. Nice work." : `Level ${guide.level} of ${guide.levels}${current ? `: ${current.title}` : ""}`}
                </div>
              </div>
              <Dialog.Close aria-label="Close" className="rounded-md p-1 text-subtle hover:bg-accent hover:text-ink">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="mt-3.5 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${guide.percent}%` }} />
              </div>
              <span className="text-[12px] font-medium tabular">{guide.percent}%</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {guide.chapters
                .filter((c) => !c.locked)
                .map((c, i) => (
                  <span key={c.id} className={cn("h-1 flex-1 rounded-full", c.complete ? "bg-success" : i === guide.level - 1 ? "bg-brand/40" : "bg-line")} />
                ))}
            </div>
            {guide.next && (
              <Link
                href={guide.next.href}
                onClick={() => onOpenChange(false)}
                className="mt-3.5 flex items-center gap-3 rounded-[10px] bg-ink px-3.5 py-2.5 text-white hover:bg-ink/90"
              >
                <Sparkles className="size-4 flex-none text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-white/60">Up next</span>
                  <span className="block truncate font-medium">{guide.next.title}</span>
                </span>
                <ArrowRight className="size-4 flex-none" />
              </Link>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <GuideChapters chapters={guide.chapters} onNavigate={() => onOpenChange(false)} />
          </div>
          <div className="flex items-center justify-between border-t border-hairline bg-white px-4 py-2.5">
            <button type="button" onClick={onTour} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-2 hover:bg-accent hover:text-ink">
              <PlayCircle className="size-3.5" />
              Replay the tour
            </button>
            {!guide.hidden && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await onboardingAction({ op: "hide" });
                    onOpenChange(false);
                    router.refresh();
                  })
                }
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-2 hover:bg-accent hover:text-ink disabled:opacity-60"
              >
                <EyeOff className="size-3.5" />
                Hide the checklist
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── The tour ─────────────────────────────────────────────────────────────────

type Stop = { target: string | null; title: string; body: string };

function stops(firstName: string, next: StepState | null): Stop[] {
  return [
    {
      target: null,
      title: firstName ? `Welcome to Builder OS, ${firstName}` : "Welcome to Builder OS",
      body: "A quick look round: six stops, about a minute. You can replay it any time from Settings → Getting started.",
    },
    {
      target: "nav",
      title: "Everything, in the order work flows",
      body: "Pipeline holds your enquiries. Quotes turn them into signed jobs. Projects run the work and Payments collects the money. A lock shows what a bigger plan adds.",
    },
    { target: "search", title: "Find anything with ⌘K", body: "Search clients, quotes, jobs and invoices by name or number, or jump straight to a page. It's Ctrl K on Windows." },
    { target: "new", title: "Start anything from here", body: "New starts a quote, lead, client or job from whichever screen you're on." },
    { target: "bell", title: "Know when clients act", body: "You'll hear when a client opens a quote, asks a question, signs, books a survey or pays." },
    { target: "guide", title: "Your getting-started checklist", body: "Short chapters take you from setting up to your first paid invoice. Steps tick themselves off as you work, and you can skip any that aren't for you." },
    { target: "account", title: "Settings live here", body: "Company details, payments, your plan and your team. Settings → Getting started brings back the checklist or this tour." },
    {
      target: null,
      title: "You're ready",
      body: next ? `Up next: ${next.title.toLowerCase()}. ${next.why}` : "Everything's set up. Open the checklist any time from Settings → Getting started.",
    },
  ];
}

const CARD_W = 340;
const GAP = 14;

function Tour({ firstName, next, onEnd }: { firstName: string; next: StepState | null; onEnd: () => void }) {
  const router = useRouter();
  // Only stops whose target is on this page (the checklist pill is hidden once it's done).
  const [list] = React.useState(() => stops(firstName, next).filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`)));
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const stop = list[i];
  const last = i === list.length - 1;

  React.useLayoutEffect(() => {
    const measure = () => {
      const el = stop.target ? document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    if (stop.target) document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [stop]);

  React.useEffect(() => {
    cardRef.current?.focus();
  }, [i]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, list.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length, onEnd]);

  // Beside the target if there's room, else below it, else above; centred when there's no target.
  let pos: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = Math.min(Math.max(12, rect.top), vh - 240);
    if (rect.right + GAP + CARD_W < vw - 12) pos = { left: rect.right + GAP, top };
    else if (rect.bottom + GAP + 220 < vh) pos = { left: Math.min(Math.max(12, rect.right - CARD_W), vw - CARD_W - 12), top: rect.bottom + GAP };
    else pos = { left: Math.min(Math.max(12, rect.right - CARD_W), vw - CARD_W - 12), top: Math.max(12, rect.top - GAP - 220) };
  }
  const pad = 6;

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[10px] transition-all duration-300 ease-out"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgb(16 16 15 / 0.55), 0 0 0 2px var(--color-brand)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-ink/55 transition-opacity duration-300" />
      )}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="absolute rounded-[14px] bg-white p-4 text-[13px] text-ink shadow-pop outline-none transition-[left,top] duration-300 ease-out"
        style={{ width: CARD_W, ...pos }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-brand tabular">{i === 0 ? "Tour" : last ? "Done" : `${i} of ${list.length - 2}`}</span>
          <button type="button" onClick={onEnd} aria-label="End the tour" className="-mr-1 rounded-md p-1 text-subtle hover:bg-accent hover:text-ink">
            <X className="size-3.5" />
          </button>
        </div>
        {last && (
          <div className="mt-2 flex size-9 items-center justify-center rounded-full bg-success text-white animate-in zoom-in-50 duration-300">
            <Check className="size-5" strokeWidth={2.5} />
          </div>
        )}
        <h2 id="tour-title" className="mt-1.5 text-[15.5px] font-semibold tracking-[-0.01em]">
          {stop.title}
        </h2>
        <p className="mt-1 leading-relaxed text-ink-2">{stop.body}</p>
        <div className="mt-3.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {list.map((s, n) => (
              <span key={s.title} className={cn("h-1 rounded-full transition-all duration-300", n === i ? "w-4 bg-brand" : n < i ? "w-1.5 bg-brand/40" : "w-1.5 bg-line")} />
            ))}
          </div>
          {i === 0 ? (
            <>
              <button type="button" onClick={onEnd} className="h-8 rounded-md px-2.5 text-ink-2 hover:bg-accent hover:text-ink">
                Not now
              </button>
              <button type="button" onClick={() => setI(1)} className="h-8 rounded-md bg-ink px-3 font-medium text-white hover:bg-ink/90">
                Show me round
              </button>
            </>
          ) : last ? (
            <>
              <button type="button" onClick={onEnd} className="h-8 rounded-md px-2.5 text-ink-2 hover:bg-accent hover:text-ink">
                Close
              </button>
              {next && (
                <button
                  type="button"
                  onClick={() => {
                    onEnd();
                    router.push(next.href);
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 font-medium text-white hover:bg-ink/90"
                >
                  {next.cta}
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setI(i - 1)} className="h-8 rounded-md px-2.5 text-ink-2 hover:bg-accent hover:text-ink">
                Back
              </button>
              <button type="button" onClick={() => setI(i + 1)} className="h-8 rounded-md bg-ink px-3 font-medium text-white hover:bg-ink/90">
                Next
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chapter complete ─────────────────────────────────────────────────────────

const SEEN_KEY = "builderos.guide.chapters";

/** A short note when a chapter is newly finished (remembered per browser, so it shows once). */
function ChapterToast({ chapters, level, levels }: { chapters: ChapterState[]; level: number; levels: number }) {
  const [shown, setShown] = React.useState<ChapterState | null>(null);
  const completeIds = chapters.filter((c) => c.complete).map((c) => c.id).join(",");

  React.useEffect(() => {
    let seen: string[] | null = null;
    try {
      const raw = window.localStorage.getItem(SEEN_KEY);
      seen = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return;
    }
    const complete = completeIds ? completeIds.split(",") : [];
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(complete));
    } catch {
      // Private window: no note, no harm.
    }
    // First visit on this browser: remember what's done without celebrating old news.
    if (seen === null) return;
    const fresh = complete.find((id) => !seen.includes(id));
    if (!fresh) return;
    const show = window.setTimeout(() => setShown(chapters.find((c) => c.id === fresh) ?? null), 400);
    const hide = window.setTimeout(() => setShown(null), 7400);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the set of finished chapters changes
  }, [completeIds]);

  if (!shown) return null;
  const allDone = level >= levels && chapters.every((c) => c.locked || c.complete);
  return (
    <div role="status" className="fixed right-5 bottom-5 z-50 flex w-[320px] items-start gap-3 rounded-[12px] bg-ink p-3.5 text-white shadow-pop animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
      <span className="flex size-8 flex-none items-center justify-center rounded-full bg-success animate-in zoom-in-50 duration-500">
        <Check className="size-4" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-white/60">Chapter complete</span>
        <span className="block font-medium">{shown.title}</span>
        <span className="mt-0.5 block text-[12px] text-white/70">{allDone ? "That's every chapter. You know Builder OS inside out." : `On to level ${level} of ${levels}.`}</span>
      </span>
      <button type="button" onClick={() => setShown(null)} aria-label="Dismiss" className="rounded p-0.5 text-white/60 hover:text-white">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
