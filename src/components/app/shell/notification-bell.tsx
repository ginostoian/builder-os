"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { Bell, BadgeCheck, CalendarCheck2, CalendarX2, PoundSterling, CheckCheck, CircleX, ClipboardList, Eye, FileCheck2, Inbox, MessageSquare, Receipt, ShieldAlert, Undo2, UserPlus } from "lucide-react";
import { bellAction, markReadAction, type BellItem } from "@/app/shell-actions";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  quote_opened: Eye,
  quote_comment: MessageSquare,
  quote_accepted: FileCheck2,
  quote_declined: CircleX,
  variation_approved: BadgeCheck,
  variation_rejected: CircleX,
  enquiry: Inbox,
  lead_assigned: UserPlus,
  task_assigned: ClipboardList,
  receipt_added: Receipt,
  certificate_expiring: ShieldAlert,
  survey_booked: CalendarCheck2,
  survey_cancelled: CalendarX2,
  invoice_paid: PoundSterling,
  invoice_refunded: Undo2,
};

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The top bar's bell: what happened that's mine to know about. Checks every minute while the tab is
 * visible, and straight away when it's opened or the tab comes back into view.
 */
export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<{ items: BellItem[]; unread: number; now: number } | null>(null);

  // Bumped by every local change, so a check that started before it can't undo it.
  const changes = React.useRef(0);
  const refresh = React.useCallback(async () => {
    const seen = changes.current;
    try {
      const next = await bellAction();
      if (seen === changes.current) setData({ ...next, now: Date.now() });
    } catch {
      // Offline or signed out: keep what we have; the next poll tries again.
    }
  }, []);

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const openItem = (item: BellItem) => {
    setOpen(false);
    if (!item.read) {
      changes.current++;
      setData((d) => d && { ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)) });
      void markReadAction(item.id);
    }
    router.push(item.href);
  };

  const markAll = () => {
    changes.current++;
    setData((d) => d && { ...d, unread: 0, items: d.items.map((i) => ({ ...i, read: true })) });
    void markReadAction();
  };

  const unread = data?.unread ?? 0;
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refresh();
      }}
    >
      <Popover.Trigger
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn("relative flex size-8 flex-none items-center justify-center rounded-md text-ink-2 hover:bg-accent data-[state=open]:bg-accent", className)}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[9.5px] font-semibold text-white tabular">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex max-h-[min(520px,calc(100vh-80px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-[12px] bg-white text-[13px] text-ink shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5">
            <div className="font-semibold">Notifications</div>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-accent hover:text-ink">
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {data === null ? (
              <div className="px-3.5 py-8 text-center text-subtle">Loading…</div>
            ) : data.items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="mx-auto size-5 text-faint" />
                <div className="mt-2 font-medium">Nothing yet</div>
                <div className="mt-0.5 text-[12px] text-subtle">Quotes opened or signed, new enquiries, tasks and receipts show up here.</div>
              </div>
            ) : (
              <ul className="py-1">
                {data.items.map((item) => {
                  const Icon = ICONS[item.kind] ?? Bell;
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => openItem(item)} className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface">
                        <span className={cn("mt-px flex size-7 flex-none items-center justify-center rounded-full", item.read ? "bg-surface text-subtle" : "bg-brand/10 text-brand")}>
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block leading-snug", !item.read && "font-medium")}>{item.title}</span>
                          {item.body && <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-2">{item.body}</span>}
                          <span className="mt-0.5 block text-[11.5px] text-subtle">{ago(item.at, data.now)}</span>
                        </span>
                        {!item.read && <span className="mt-2 size-1.5 flex-none rounded-full bg-brand" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
