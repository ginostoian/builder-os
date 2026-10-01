"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  GripVertical,
  Library,
  Link as LinkIcon,
  MapPin,
  Paperclip,
  Send,
  StickyNote,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_MARKUP,
  paymentPlan,
  quote,
  quoteSections,
  services,
  targetMargin,
  VAT_RATE,
} from "@/lib/demo-data";
import { formatBps, formatGBP, formatRate, parsePence } from "@/lib/money";
import { lineTotal, quoteTotals, sectionTotal, stageAmounts, type QuoteLine, type QuoteSection } from "@/lib/quote";
import { cn } from "@/lib/utils";
import { appRoutes } from "../routes";
import { TabStrip } from "../tab-strip";

const GRID = "grid grid-cols-[28px_44px_minmax(0,1fr)_60px_56px_92px_66px_104px_36px]";
const HEAD_GRID = "grid grid-cols-[28px_44px_minmax(0,1fr)_120px_104px_36px]";

type Field = "name" | "qty" | "unit" | "rate" | "markup";
const FIELDS: Field[] = ["name", "qty", "unit", "rate", "markup"];
const COLUMN: Record<Field, string> = { name: "C", qty: "D", unit: "E", rate: "F", markup: "G" };

type Cell = { lineId: string; field: Field };

function display(line: QuoteLine, field: Field): string {
  switch (field) {
    case "name":
      return line.name;
    case "qty":
      return String(line.qty);
    case "unit":
      return line.unit;
    case "rate":
      return formatRate(line.rate);
    case "markup":
      return formatBps(line.markup);
  }
}

function applyEdit(line: QuoteLine, field: Field, raw: string): QuoteLine {
  const value = raw.trim();
  switch (field) {
    case "name":
      return value ? { ...line, name: value } : line;
    case "unit":
      return value ? { ...line, unit: value } : line;
    case "qty": {
      const n = Number(value.replace(/,/g, ""));
      return Number.isFinite(n) && n >= 0 ? { ...line, qty: n } : line;
    }
    case "rate": {
      const p = parsePence(value);
      return p !== null && p >= 0 ? { ...line, rate: p } : line;
    }
    case "markup": {
      const n = Number(value.replace("%", ""));
      return Number.isFinite(n) ? { ...line, markup: Math.round(n * 100) } : line;
    }
  }
}

const tabs = [{ label: "Items" }, { label: "Payment plan" }, { label: "Notes & terms" }, { label: "Activity" }];

export function QuoteBuilderScreen() {
  const [sections, setSections] = React.useState<QuoteSection[]>(quoteSections);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(["1"]));
  const [selected, setSelected] = React.useState<Cell | null>({ lineId: "2.1", field: "rate" });
  const [editing, setEditing] = React.useState<string | null>(null);
  const [noteFor, setNoteFor] = React.useState<string | null>("2.1");
  const [draft, setDraft] = React.useState({ sectionId: "3", text: "plast", open: true, highlighted: 0 });
  const [tab, setTab] = React.useState("Items");
  const [status, setStatus] = React.useState<"Draft" | "Sent">("Draft");
  const [toast, setToast] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const totals = quoteTotals(sections, VAT_RATE);
  const stages = stageAmounts(totals.total, paymentPlan);
  const lines = sections.flatMap((s) => s.lines);
  const selectedLine = selected ? lines.find((l) => l.id === selected.lineId) : undefined;

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function updateLine(lineId: string, fn: (l: QuoteLine) => QuoteLine) {
    setSections((prev) => prev.map((s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? fn(l) : l)) })));
  }

  function moveSelection(cell: Cell, dx: number, dy: number) {
    const visible = sections.filter((s) => !collapsed.has(s.id)).flatMap((s) => s.lines);
    const row = visible.findIndex((l) => l.id === cell.lineId);
    const col = FIELDS.indexOf(cell.field);
    const nextCol = Math.min(FIELDS.length - 1, Math.max(0, col + dx));
    const nextRow = Math.min(visible.length - 1, Math.max(0, row + dy));
    if (visible[nextRow]) setSelected({ lineId: visible[nextRow].id, field: FIELDS[nextCol] });
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    if (!selected || editing) return;
    const moves: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
      Tab: [e.shiftKey ? -1 : 1, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveSelection(selected, ...moves[e.key]);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setEditing(`${selected.lineId}:${selected.field}`);
    }
  }

  function insertLine(sectionId: string, partial: Pick<QuoteLine, "name" | "unit" | "rate">) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const id = `${s.id}.${s.lines.length + 1}`;
        return { ...s, lines: [...s.lines, { id, qty: 1, markup: DEFAULT_MARKUP, ...partial }] };
      }),
    );
    setDraft((d) => ({ ...d, text: "", open: false, highlighted: 0 }));
  }

  const suggestions = React.useMemo(() => {
    const q = draft.text.trim().toLowerCase();
    if (!q) return [];
    return services.filter((s) => `${s.name} ${s.category}`.toLowerCase().includes(q)).slice(0, 5);
  }, [draft.text]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`https://${quote.link}`);
    } catch {
      /* clipboard can be blocked; still show feedback */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const marginTone = totals.margin >= targetMargin ? "text-success" : "text-warning";
  const costShare = totals.net === 0 ? 100 : Math.round((totals.cost / totals.net) * 100);

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-4 px-6 pt-[18px] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{quote.title}</h1>
              <Badge tone={status === "Draft" ? "grey" : "amber"}>{status}</Badge>
            </div>
            <div className="mt-1 flex gap-3.5 whitespace-nowrap text-subtle">
              <span className="flex items-center gap-[5px]">
                <User className="size-[13px]" />
                {quote.client}
              </span>
              <span className="flex items-center gap-[5px]">
                <MapPin className="size-[13px]" />
                {quote.siteShort}
              </span>
              <span className="flex items-center gap-[5px]">
                <Clock className="size-[13px]" />
                Saved just now
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href={appRoutes.library}>
                <Library className="text-ink-2" />
                Library
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => setToast("PDF export lands with the quoting release.")}>
              <Download className="text-ink-2" />
              PDF
            </Button>
            <Button
              className="px-3.5"
              onClick={() => {
                setStatus("Sent");
                setToast("Sent to Sarah. We'll tell you when she opens it.");
              }}
            >
              <Send />
              Send quote
            </Button>
          </div>
        </div>

        <div className="flex items-center border-b border-hairline px-6">
          <TabStrip tabs={tabs} active={tab} onSelect={setTab} />
          <div className="flex-1" />
          <div className="flex gap-1.5 text-xs text-ink-2">
            <span className="rounded-md bg-muted px-2 py-[3px]">Default markup {formatBps(DEFAULT_MARKUP)}</span>
            <span className="rounded-md bg-muted px-2 py-[3px]">VAT {formatBps(VAT_RATE)}</span>
          </div>
        </div>

        {tab === "Items" && (
          <>
            <div className="flex h-9 items-center border-b border-hairline text-[12.5px]">
              <div className="flex h-full w-[72px] items-center border-r border-hairline px-3 font-mono text-[11.5px] whitespace-nowrap text-ink-2">
                {selected ? `${selected.lineId} · ${COLUMN[selected.field]}` : "—"}
              </div>
              <div className="px-3 font-mono text-[11.5px] text-subtle italic">fx</div>
              <div className="font-mono text-xs">
                {selectedLine
                  ? `= ${selectedLine.qty} × ${formatRate(selectedLine.rate)} × (1 + ${formatBps(selectedLine.markup)})`
                  : ""}
              </div>
            </div>
            <div className={cn(GRID, "h-8 items-center border-b border-hairline bg-surface-2 text-[11.5px] font-medium text-subtle")}>
              <span />
              <span>#</span>
              <span>Item</span>
              <span className="pr-2.5 text-right">Qty</span>
              <span>Unit</span>
              <span className="pr-2.5 text-right">Rate</span>
              <span className="pr-2.5 text-right">Markup</span>
              <span className="pr-3 text-right">Total</span>
              <span />
            </div>
            <div className="min-h-0 flex-1 overflow-auto" role="grid" aria-label="Quote lines" tabIndex={-1} onKeyDown={onGridKeyDown}>
              {sections.map((s) => {
                const isOpen = !collapsed.has(s.id);
                return (
                  <React.Fragment key={s.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                      className={cn(HEAD_GRID, "h-9 w-full items-center border-b border-hairline bg-surface text-left font-semibold")}
                    >
                      {isOpen ? (
                        <ChevronDown className="size-3.5 justify-self-center text-subtle" />
                      ) : (
                        <ChevronRight className="size-3.5 justify-self-center text-subtle" />
                      )}
                      <span className="font-mono text-xs text-ink-2">{s.id}</span>
                      <span>{s.name}</span>
                      <span className="pr-2.5 text-right text-xs font-normal text-subtle">{s.lines.length} items</span>
                      <span className="pr-3 text-right tabular">{formatGBP(sectionTotal(s))}</span>
                      <span />
                    </button>
                    {isOpen &&
                      s.lines.map((l) => (
                        <LineRow
                          key={l.id}
                          line={l}
                          selected={selected?.lineId === l.id ? selected.field : null}
                          editing={editing?.startsWith(`${l.id}:`) ? (editing.split(":")[1] as Field) : null}
                          noteOpen={noteFor === l.id}
                          onSelect={(field) => {
                            setSelected({ lineId: l.id, field });
                            if (editing && editing !== `${l.id}:${field}`) setEditing(null);
                          }}
                          onEdit={(field) => setEditing(`${l.id}:${field}`)}
                          onCommit={(field, value, move) => {
                            updateLine(l.id, (line) => applyEdit(line, field, value));
                            setEditing(null);
                            if (move) moveSelection({ lineId: l.id, field }, move[0], move[1]);
                          }}
                          onCancel={() => setEditing(null)}
                          onToggleNote={() => setNoteFor((n) => (n === l.id ? null : l.id))}
                          onNoteChange={(note) => updateLine(l.id, (line) => ({ ...line, note }))}
                        />
                      ))}
                    {isOpen && draft.sectionId === s.id && (
                      <DraftRow
                        code={`${s.id}.${s.lines.length + 1}`}
                        text={draft.text}
                        open={draft.open && suggestions.length > 0}
                        highlighted={draft.highlighted}
                        suggestions={suggestions}
                        onChange={(text) => setDraft((d) => ({ ...d, text, open: true, highlighted: 0 }))}
                        onHighlight={(i) => setDraft((d) => ({ ...d, highlighted: i }))}
                        onClose={() => setDraft((d) => ({ ...d, open: false }))}
                        onPick={(i) => {
                          const svc = suggestions[i];
                          if (svc) insertLine(s.id, { name: svc.name, unit: svc.unit, rate: svc.rate });
                        }}
                        onCustom={() => draft.text.trim() && insertLine(s.id, { name: draft.text.trim(), unit: "item", rate: 0 })}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}

        {tab === "Payment plan" && (
          <div className="flex-1 bg-surface-2 p-6">
            <div className="max-w-[560px] rounded-xl bg-white shadow-ring">
              {paymentPlan.map((p, i) => (
                <div key={p.label} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <StageNumber n={i + 1} />
                  <span className="flex-1">{p.label}</span>
                  <span className="text-xs text-subtle">{formatBps(p.share)}</span>
                  <span className="w-24 text-right tabular">{formatGBP(stages[i])}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-subtle">Stages are raised as invoices when you tick them off on the project.</p>
          </div>
        )}

        {tab === "Notes & terms" && (
          <div className="flex-1 bg-surface-2 p-6">
            <label className="flex max-w-[640px] flex-col gap-1.5 text-xs font-medium text-subtle">
              Terms shown to the client
              <textarea
                defaultValue="Prices exclude VAT unless stated. Provisional sums are adjusted to actual cost once confirmed. This quote is valid for 30 days."
                className="min-h-[140px] rounded-md bg-white p-3 text-[13px] font-normal text-ink shadow-ring outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-ink)]"
              />
            </label>
          </div>
        )}

        {tab === "Activity" && (
          <div className="flex-1 bg-surface-2 p-6">
            <ul className="flex max-w-[560px] flex-col gap-2.5">
              {[
                ["Quote created from the extension template", "Thu 1 Oct, 21:14"],
                ["Line 2.1 rate changed from £1,750.00 to £1,850.00", "Thu 1 Oct, 21:32"],
                ["Note added to 3.2 Quartz worktops", "Thu 1 Oct, 21:40"],
              ].map(([what, when]) => (
                <li key={what} className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-faint" />
                  <span className="flex-1 text-ink-3">{what}</span>
                  <span className="text-xs text-subtle">{when}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside className="flex w-[296px] flex-none flex-col gap-4 border-l border-hairline bg-surface-2 p-[18px]">
        <div>
          <div className="mb-2.5 text-xs font-medium text-subtle">Summary</div>
          <dl className="flex flex-col gap-2 tabular">
            <SummaryRow label="Cost" value={formatGBP(totals.cost)} />
            <SummaryRow label="Markup" value={formatGBP(totals.markup)} />
            <SummaryRow label="Subtotal" value={formatGBP(totals.net)} />
            <SummaryRow label={`VAT ${formatBps(VAT_RATE)}`} value={formatGBP(totals.vat)} />
            <div className="my-1 h-px bg-hairline" />
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">Total</dt>
              <dd className="text-[22px] font-semibold tracking-[-0.02em]">{formatGBP(totals.total)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-[10px] bg-white px-3.5 py-3 shadow-ring">
          <div className="flex justify-between text-[12.5px]">
            <span className="font-medium">Gross margin</span>
            <span className={cn("font-medium", marginTone)}>{Math.round(totals.margin / 100)}%</span>
          </div>
          <div className="mt-2.5 flex h-1.5 gap-0.5" aria-hidden>
            <div className="rounded-l-[3px] bg-ink" style={{ flex: costShare }} />
            <div className="rounded-r-[3px] bg-brand" style={{ flex: 100 - costShare }} />
          </div>
          <div className="mt-2 text-[11.5px] text-subtle">
            Target {formatBps(targetMargin)} · {totals.margin >= targetMargin ? "you're above it" : "you're below it"}
          </div>
        </div>
        <div>
          <div className="mb-2.5 text-xs font-medium text-subtle">Payment plan</div>
          <div className="flex flex-col gap-0.5">
            {paymentPlan.map((p, i) => (
              <div key={p.label} className="flex items-center gap-2.5 py-[7px]">
                <StageNumber n={i + 1} />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <span className="text-xs text-subtle">{formatBps(p.share)}</span>
                <span className="w-16 text-right tabular">{formatGBP(stages[i], 0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2 rounded-[10px] bg-white px-3 py-2.5 shadow-ring">
          <LinkIcon className="size-3.5 text-subtle" />
          <span className="flex-1 truncate font-mono text-[11.5px] text-ink-2">{quote.link}</span>
          <button type="button" onClick={copyLink} className="text-xs font-medium hover:text-ink-2">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </aside>

      {toast && (
        <div role="status" className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-white shadow-pop animate-in fade-in-0 slide-in-from-bottom-1">
          {toast}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StageNumber({ n }: { n: number }) {
  return (
    <span className="flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold text-ink-2 shadow-[inset_0_0_0_1.5px_#D6D5CF]">
      {n}
    </span>
  );
}

function LineRow({
  line,
  selected,
  editing,
  noteOpen,
  onSelect,
  onEdit,
  onCommit,
  onCancel,
  onToggleNote,
  onNoteChange,
}: {
  line: QuoteLine;
  selected: Field | null;
  editing: Field | null;
  noteOpen: boolean;
  onSelect: (f: Field) => void;
  onEdit: (f: Field) => void;
  onCommit: (f: Field, value: string, move?: [number, number]) => void;
  onCancel: () => void;
  onToggleNote: () => void;
  onNoteChange: (note: string) => void;
}) {
  const cell = (field: Field, className: string, content: React.ReactNode) => {
    const isSel = selected === field;
    return (
      <span
        role="gridcell"
        aria-selected={isSel}
        onClick={() => onSelect(field)}
        onDoubleClick={() => onEdit(field)}
        className={cn(
          "flex h-full cursor-cell items-center",
          className,
          isSel && "bg-white shadow-[inset_0_0_0_2px_var(--color-brand)]",
        )}
      >
        {editing === field ? (
          <CellEditor initial={display(line, field)} align={field === "name" || field === "unit" ? "left" : "right"} onCommit={(v, m) => onCommit(field, v, m)} onCancel={onCancel} />
        ) : (
          content
        )}
      </span>
    );
  };

  return (
    <div
      role="row"
      className={cn(GRID, "relative h-[34px] items-center border-b border-line tabular", selected ? "bg-brand-tint" : "bg-white")}
    >
      <GripVertical className="size-[13px] justify-self-center text-grip" aria-hidden />
      <span className="font-mono text-[11.5px] text-subtle">{line.id}</span>
      {cell("name", "min-w-0 pr-2", <span className="truncate">{line.name}</span>)}
      {cell("qty", "justify-end pr-2.5", line.qty)}
      {cell("unit", "text-subtle", line.unit)}
      {cell("rate", "justify-end pr-2.5", formatRate(line.rate))}
      {cell("markup", "justify-end pr-2.5 text-ink-2", formatBps(line.markup))}
      <span className="pr-3 text-right font-medium">{formatGBP(lineTotal(line))}</span>
      <button
        type="button"
        aria-label={line.note ? "Show note" : "Add note"}
        aria-expanded={noteOpen}
        onClick={onToggleNote}
        className="flex h-full items-center justify-center"
      >
        <StickyNote className={cn("size-3.5", line.note ? "text-brand" : "text-grip")} />
      </button>
      {noteOpen && (
        <div className="absolute top-[38px] right-[30px] z-10 w-[280px] rounded-[10px] bg-white px-3.5 py-3 shadow-pop">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold">Note · visible to client</span>
            <Eye className="size-[13px] text-subtle" />
          </div>
          {line.note !== undefined ? (
            <div className="leading-normal text-ink-2">{line.note}</div>
          ) : (
            <textarea
              autoFocus
              placeholder="What should the client know about this line?"
              onBlur={(e) => e.target.value.trim() && onNoteChange(e.target.value.trim())}
              className="min-h-[64px] w-full resize-none rounded-md bg-surface p-2 leading-normal shadow-ring outline-none"
            />
          )}
          {line.attachment && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs text-ink-2">
              <Paperclip className="size-3" />
              {line.attachment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CellEditor({
  initial,
  align,
  onCommit,
  onCancel,
}: {
  initial: string;
  align: "left" | "right";
  onCommit: (value: string, move?: [number, number]) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onCommit(value, [0, 1]);
        else if (e.key === "Tab") {
          e.preventDefault();
          onCommit(value, [e.shiftKey ? -1 : 1, 0]);
        } else if (e.key === "Escape") onCancel();
      }}
      className={cn("h-full w-full min-w-0 bg-transparent outline-none", align === "right" && "text-right")}
    />
  );
}

function DraftRow({
  code,
  text,
  open,
  highlighted,
  suggestions,
  onChange,
  onHighlight,
  onClose,
  onPick,
  onCustom,
}: {
  code: string;
  text: string;
  open: boolean;
  highlighted: number;
  suggestions: typeof services;
  onChange: (t: string) => void;
  onHighlight: (i: number) => void;
  onClose: () => void;
  onPick: (i: number) => void;
  onCustom: () => void;
}) {
  const listId = React.useId();
  return (
    <div className={cn(GRID, "relative h-[34px] items-center border-b border-line")}>
      <span />
      <span className="font-mono text-[11.5px] text-subtle">{code}</span>
      <span className="mr-2 flex h-[26px] items-center rounded-[5px] px-2 shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
        <input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTimeout(onClose, 120)}
          placeholder="Type to add a line"
          aria-label="Add a line from your service library"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              onHighlight(Math.min(suggestions.length - 1, highlighted + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              onHighlight(Math.max(0, highlighted - 1));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              onPick(highlighted);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCustom();
            }
          }}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-subtle"
        />
      </span>
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      {open && (
        <div id={listId} role="listbox" className="absolute top-[34px] left-[72px] z-10 w-[420px] rounded-[10px] bg-white p-1.5 shadow-pop">
          <div className="px-2 py-1.5 text-[11px] font-medium text-subtle">From your service library</div>
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              role="option"
              aria-selected={i === highlighted}
              onMouseEnter={() => onHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(i);
              }}
              className={cn("flex cursor-pointer items-center gap-2.5 rounded-md p-2", i === highlighted && "bg-muted")}
            >
              <Library className="size-3.5 text-subtle" />
              <span className="flex-1">{s.name}</span>
              <span className="text-xs text-subtle">{s.unit}</span>
              <span className="w-[60px] text-right font-medium tabular">{formatGBP(s.rate)}</span>
            </div>
          ))}
          <div className="mt-1 flex gap-3.5 border-t border-line px-2 pt-2 pb-1 text-[11.5px] text-subtle">
            <span>↵ insert</span>
            <span>⇥ next cell</span>
            <span>esc custom item</span>
          </div>
        </div>
      )}
    </div>
  );
}
