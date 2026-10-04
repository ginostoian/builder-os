"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ClipboardList, FileText, FolderKanban, Loader2, Package, PoundSterling, Search, User, Users } from "lucide-react";
import { searchAction } from "@/app/shell-actions";
import type { SearchHit, SearchKind } from "@/db/search";
import { cn } from "@/lib/utils";
import type { QuickAction } from "./quick-actions";
import { QUICK_ICONS } from "./quick-icons";

const KINDS: Record<SearchKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  client: { label: "Clients", icon: Users },
  lead: { label: "Leads", icon: ClipboardList },
  quote: { label: "Quotes", icon: FileText },
  project: { label: "Projects", icon: FolderKanban },
  invoice: { label: "Invoices", icon: PoundSterling },
  person: { label: "Team", icon: User },
  order: { label: "Purchase orders", icon: Package },
};
const ORDER: SearchKind[] = ["client", "lead", "quote", "project", "invoice", "person", "order"];

type Row = { key: string; group: string; label: string; detail: string | null; href: string; icon: React.ComponentType<{ className?: string }> };

/**
 * ⌘K (Ctrl K on Windows): find any client, lead, quote, project, invoice, person or purchase order by
 * name, address or number, or jump straight to starting something new.
 */
export function CommandSearch({ actions }: { actions: QuickAction[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const latest = React.useRef(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onQuery = (value: string) => {
    setQ(value);
    setActive(0);
    const ticket = ++latest.current;
    if (value.trim().length === 0) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    window.setTimeout(async () => {
      if (ticket !== latest.current) return;
      try {
        const found = await searchAction(value);
        if (ticket === latest.current) setHits(found);
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    }, 180);
  };

  const needle = q.trim().toLowerCase();
  const rows: Row[] = [];
  for (const kind of ORDER) {
    for (const h of hits.filter((x) => x.kind === kind)) rows.push({ key: `${h.kind}:${h.id}`, group: KINDS[kind].label, label: h.title, detail: h.detail, href: h.href, icon: KINDS[kind].icon });
  }
  const matching = actions.filter((a) => !needle || `${a.label} ${a.keywords ?? ""}`.toLowerCase().includes(needle));
  for (const a of matching) rows.push({ key: a.id, group: a.group === "new" ? "Start something" : "Go to", label: a.label, detail: null, href: a.href, icon: QUICK_ICONS[a.icon] });

  const go = (row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = rows.length === 0 ? 0 : (active + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          latest.current++;
          setQ("");
          setHits([]);
          setLoading(false);
          setActive(0);
        }
      }}
    >
      <Dialog.Trigger className="flex h-8 items-center gap-2 rounded-md bg-white px-2.5 text-subtle shadow-ring hover:text-ink-2">
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded bg-line px-[5px] py-px font-mono text-[10.5px] text-ink-2">⌘K</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[calc(100%-32px)] max-w-[600px] -translate-x-1/2 flex-col overflow-hidden rounded-[14px] bg-white text-[13px] text-ink shadow-pop"
          onKeyDown={onKeyDown}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-hairline px-4">
            {loading ? <Loader2 className="size-4 animate-spin text-subtle" /> : <Search className="size-4 text-subtle" />}
            <input
              autoFocus
              value={q}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search clients, leads, quotes, jobs, people… or type Q-12, INV 7"
              aria-label="Search"
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={rows[active] ? `cmd-${rows[active].key}` : undefined}
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle focus-visible:shadow-none focus-visible:outline-none"
            />
            <kbd className="rounded bg-line px-[5px] py-px font-mono text-[10.5px] text-ink-2">esc</kbd>
          </div>
          <div ref={listRef} id="command-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {rows.length === 0 ? (
              <div className="px-3 py-8 text-center text-subtle">{loading ? "Searching…" : `Nothing matches “${q.trim()}”.`}</div>
            ) : (
              rows.map((row, i) => (
                <React.Fragment key={row.key}>
                  {(i === 0 || rows[i - 1].group !== row.group) && <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-subtle">{row.group}</div>}
                  <div
                    id={`cmd-${row.key}`}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(row)}
                    className={cn("flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5", i === active && "bg-accent")}
                  >
                    <row.icon className="size-[15px] flex-none text-ink-2" />
                    <span className="truncate">{row.label}</span>
                    {row.detail && <span className="truncate text-[12px] text-subtle">{row.detail}</span>}
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-hairline px-4 py-2 text-[11.5px] text-subtle">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
