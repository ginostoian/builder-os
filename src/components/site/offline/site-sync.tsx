"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import { remove, type Op } from "./outbox";
import { flush, useOutbox } from "./sync";

const Ctx = React.createContext<{ memberId: string; ops: Op[] } | null>(null);

/** Who's signed in and what's waiting to send, for the site app's buttons. */
export const useSiteSync = () => React.useContext(Ctx);

function useOnline() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

const describe = (op: Op) =>
  op.kind === "check_in" ? `Check in at ${op.projectName}` : op.kind === "check_out" ? "Check out" : op.kind === "task" ? "A task update" : op.kind === "update" ? `Site update for ${op.projectName}` : `Receipt for ${op.projectName}`;

/**
 * Makes the site app work with no signal: saves its pages on the phone (service worker), sends queued
 * changes when the signal comes back, and shows what's waiting.
 */
export function SiteSync({ memberId, jobIds, children }: { memberId: string; jobIds?: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const online = useOnline();
  const ops = useOutbox(memberId);
  const waiting = ops.filter((o) => !o.failed);
  const failed = ops.filter((o) => o.failed);
  const [sending, setSending] = React.useState(false);
  const jobsKey = jobIds?.join(",");

  // Save the pages for offline use (Today and every current job).
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/site-sw.js", { scope: "/m" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (cancelled || !reg.active) return;
        reg.active.postMessage({ type: "identity", memberId });
        // Only Today knows the jobs; it saves itself and each of them.
        if (jobsKey !== undefined) reg.active.postMessage({ type: "warm", paths: ["/m", ...jobsKey.split(",").filter(Boolean).map((id) => `/m/jobs/${id}`)] });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [memberId, jobsKey]);

  const sendNow = React.useCallback(async () => {
    setSending(true);
    try {
      if ((await flush(memberId)) > 0) router.refresh();
    } finally {
      setSending(false);
    }
  }, [memberId, router]);

  // Send when the signal comes back, when the app is opened again, and every 30 seconds while waiting.
  const pending = waiting.length > 0;
  React.useEffect(() => {
    if (!pending || !online) return;
    const first = setTimeout(() => void sendNow(), 0);
    const t = setInterval(() => void sendNow(), 30_000);
    const visible = () => document.visibilityState === "visible" && void sendNow();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pending, online, sendNow]);

  const value = React.useMemo(() => ({ memberId, ops }), [memberId, ops]);

  return (
    <Ctx.Provider value={value}>
      {(!online || waiting.length > 0) && (
        <div role="status" className="flex items-center gap-2.5 rounded-2xl bg-ink px-3.5 py-3 text-[13px] text-white">
          <CloudOff className="size-4 flex-none" />
          <span className="min-w-0 flex-1">
            {!online ? "No signal. Keep going: what you do is saved on this phone and sent when you're back online." : `Sending ${waiting.length} change${waiting.length > 1 ? "s" : ""} saved while you had no signal…`}
            {!online && waiting.length > 0 && <span className="block text-night-text">{waiting.length} waiting to send.</span>}
          </span>
          {online && (
            <button type="button" onClick={() => void sendNow()} disabled={sending} aria-label="Send now" className="flex size-9 flex-none items-center justify-center rounded-full bg-white/10 disabled:opacity-60">
              <RefreshCw className={sending ? "size-4 animate-spin" : "size-4"} />
            </button>
          )}
        </div>
      )}
      {failed.map((op) => (
        <div key={op.id} role="alert" className="flex items-start gap-2.5 rounded-2xl bg-danger-soft px-3.5 py-3 text-[13px]">
          <TriangleAlert className="mt-0.5 size-4 flex-none text-danger" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{describe(op)} couldn&apos;t be sent.</span> {op.failed}
          </span>
          <button type="button" onClick={() => void remove(op.id)} aria-label="Dismiss" className="flex size-8 flex-none items-center justify-center rounded-full hover:bg-white/50">
            <X className="size-4" />
          </button>
        </div>
      ))}
      {children}
    </Ctx.Provider>
  );
}
