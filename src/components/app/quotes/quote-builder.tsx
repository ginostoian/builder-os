"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Layers,
  Library,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { removeDraft } from "@/app/app/quotes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatAddress } from "@/core/clients";
import { MAX_MARKUP_BPS, MAX_VAT_BPS, TEXT } from "@/core/limits";
import { formatBps, formatGBP, formatRate, parsePence, parsePercentToBps } from "@/core/money";
import { lineTotal, quoteRef, quoteTotals, sectionTotal, type QuoteSection } from "@/core/quote";
import { LINE_KINDS, qty as qtySchema, quoteHeaderInput, singleLine, type Address, type QuoteHeaderInput, type QuoteOp } from "@/core/schemas";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";
import { useQuoteSaver, type SaveStatus } from "./use-quote-saver";

// ── Types ────────────────────────────────────────────────────────────────────

type LineKind = (typeof LINE_KINDS)[number];
type LineChange = Extract<QuoteOp, { op: "updateLine" }>["change"];
export type BuilderLine = {
  id: string;
  serviceId: string | null;
  name: string;
  qty: number;
  unit: string;
  ratePence: number;
  markupBps: number;
  note: string | null;
  noteVisible: boolean;
  kind: LineKind;
};
export type BuilderSection = { id: string; name: string; lines: BuilderLine[] };
export type BuilderQuote = {
  id: string;
  number: number;
  status: string;
  version: number;
  title: string;
  clientId: string;
  siteAddress: Address | null;
  validUntil: string | null;
  markupBps: number;
  vatRateBps: number;
  sections: BuilderSection[];
};
export type LibraryOption = {
  id: string;
  kind: "service" | "bundle";
  category: string;
  name: string;
  description: string | null;
  unit: string;
  ratePence: number;
  defaultMarkupBps: number | null;
  items: { serviceId: string; qty: number; name: string; unit: string; ratePence: number; defaultMarkupBps: number | null }[];
};
type ClientOption = { id: string; name: string; address: Address | null };

const KIND_LABEL: Record<LineKind, string> = { normal: "Item", pc_sum: "PC sum", provisional: "Provisional sum" };
const GRID = "grid grid-cols-[44px_minmax(0,1fr)_76px_64px_100px_72px_108px_64px]";
const VAT_OPTIONS = [2000, 500, 0];

const toCore = (sections: BuilderSection[]): QuoteSection[] =>
  sections.map((s) => ({ id: s.id, name: s.name, lines: s.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit, rate: l.ratePence, markup: l.markupBps })) }));
const lineInput = (l: BuilderLine) => ({
  serviceId: l.serviceId ?? undefined,
  name: l.name,
  qty: l.qty,
  unit: l.unit,
  ratePence: l.ratePence,
  markupBps: l.markupBps,
  note: l.note ?? undefined,
  noteVisible: l.noteVisible,
  kind: l.kind,
});
const uuid = () => crypto.randomUUID();
const qtyText = (n: number) => String(Number(n.toFixed(3)));
const bpsText = (bps: number) => String(Number((bps / 100).toFixed(2)));

// ── Builder ──────────────────────────────────────────────────────────────────

export function QuoteBuilder({
  initial,
  clients,
  library,
  clientName,
}: {
  initial: BuilderQuote;
  clients: ClientOption[];
  library: LibraryOption[];
  clientName: string;
}) {
  const saver = useQuoteSaver(initial.id, initial.version);
  const [sections, setSections] = React.useState<BuilderSection[]>(initial.sections);
  const [header, setHeader] = React.useState<QuoteHeaderInput>(() => ({
    clientId: initial.clientId,
    title: initial.title,
    markupBps: initial.markupBps,
    vatRateBps: initial.vatRateBps,
    siteAddress: initial.siteAddress ?? undefined,
    validUntil: initial.validUntil ?? undefined,
  }));
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [tab, setTab] = React.useState<"items" | "details">("items");
  const blocked = saver.status === "blocked";

  const totals = quoteTotals(toCore(sections), header.vatRateBps);
  const lineNumbers = new Map<string, string>();
  sections.forEach((s, si) => s.lines.forEach((l, li) => lineNumbers.set(l.id, `${si + 1}.${li + 1}`)));
  const client = clients.find((c) => c.id === header.clientId);

  // Every change updates the screen at once and queues the matching op for autosave.
  const change = (fn: (prev: BuilderSection[]) => BuilderSection[], ...ops: QuoteOp[]) => {
    if (blocked) return;
    setSections(fn);
    saver.push(...ops);
  };
  const updateLine = (lineId: string, patch: Partial<BuilderLine>, op: QuoteOp) =>
    change((prev) => prev.map((s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) })), op);

  const addLines = (sectionId: string, lines: BuilderLine[]) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const start = section.lines.length;
    change(
      (prev) => prev.map((s) => (s.id === sectionId ? { ...s, lines: [...s.lines, ...lines] } : s)),
      ...lines.map((l, i): QuoteOp => ({ op: "addLine", sectionId, lineId: l.id, position: start + i, line: lineInput(l) })),
    );
  };
  const moveLine = (lineId: string, dir: -1 | 1) => {
    const si = sections.findIndex((s) => s.lines.some((l) => l.id === lineId));
    const li = sections[si].lines.findIndex((l) => l.id === lineId);
    const target = li + dir;
    // Past the top or bottom of a section: move into the neighbouring section.
    if (target < 0 || target >= sections[si].lines.length) {
      const nsi = si + dir;
      if (nsi < 0 || nsi >= sections.length) return;
      const line = sections[si].lines[li];
      const position = dir === 1 ? 0 : sections[nsi].lines.length;
      change(
        (prev) =>
          prev.map((s, i) =>
            i === si ? { ...s, lines: s.lines.filter((l) => l.id !== lineId) } : i === nsi ? { ...s, lines: dir === 1 ? [line, ...s.lines] : [...s.lines, line] } : s,
          ),
        { op: "moveLine", lineId, sectionId: sections[nsi].id, position },
      );
      return;
    }
    change(
      (prev) =>
        prev.map((s, i) => {
          if (i !== si) return s;
          const lines = [...s.lines];
          [lines[li], lines[target]] = [lines[target], lines[li]];
          return { ...s, lines };
        }),
      { op: "moveLine", lineId, sectionId: sections[si].id, position: target },
    );
  };
  const removeLine = (lineId: string) =>
    change((prev) => prev.map((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== lineId) })), { op: "removeLine", lineId });

  const addSection = () => {
    const id = uuid();
    change((prev) => [...prev, { id, name: `Section ${prev.length + 1}`, lines: [] }], { op: "addSection", sectionId: id, name: `Section ${sections.length + 1}`, position: sections.length });
  };
  const moveSection = (sectionId: string, dir: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === sectionId);
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    change(
      (prev) => {
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      },
      { op: "moveSection", sectionId, position: j },
    );
  };

  const commitHeader = (next: QuoteHeaderInput) => {
    if (blocked) return;
    const parsed = quoteHeaderInput.safeParse(next);
    setHeader(next);
    if (parsed.success) saver.saveHeader(parsed.data);
  };

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-4 px-6 pt-[18px] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[12px] text-subtle">{quoteRef(initial.number)}</span>
              <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{header.title || "Untitled quote"}</h1>
              <Badge tone="grey">Draft</Badge>
            </div>
            <div className="mt-1 flex gap-3.5 whitespace-nowrap text-subtle">
              <span className="flex items-center gap-[5px]">
                <User className="size-[13px]" />
                {client?.name ?? clientName}
              </span>
              {header.siteAddress && (
                <span className="flex min-w-0 items-center gap-[5px]">
                  <MapPin className="size-[13px] flex-none" />
                  <span className="truncate">{formatAddress(header.siteAddress)}</span>
                </span>
              )}
              <SaveIndicator status={saver.status} savedAt={saver.savedAt} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/app/library">
                <Library className="text-ink-2" />
                Library
              </Link>
            </Button>
          </div>
        </div>

        {blocked && (
          <div role="alert" className="mx-6 mb-3 flex items-center gap-2.5 rounded-lg bg-danger-soft px-3.5 py-2.5 text-danger">
            <AlertTriangle className="size-4 flex-none" />
            <span className="flex-1">{saver.message} Changes since the last save weren&apos;t kept.</span>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )}

        <div className="flex items-center border-b border-hairline px-6">
          <div className="flex gap-5" role="tablist">
            {(["items", "details"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("-mb-px border-b-2 py-2.5 font-medium", tab === t ? "border-ink text-ink" : "border-transparent text-subtle hover:text-ink-2")}
              >
                {t === "items" ? "Items" : "Details"}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex gap-1.5 text-xs text-ink-2">
            <span className="rounded-md bg-muted px-2 py-[3px]">Default markup {formatBps(header.markupBps)}</span>
            <span className="rounded-md bg-muted px-2 py-[3px]">VAT {formatBps(header.vatRateBps)}</span>
          </div>
        </div>

        {tab === "items" ? (
          <fieldset disabled={blocked} className="flex min-h-0 flex-1 flex-col">
            <div className={cn(GRID, "h-8 flex-none items-center border-b border-hairline bg-surface-2 text-[11.5px] font-medium text-subtle")}>
              <span className="pl-3">#</span>
              <span>Item</span>
              <span className="pr-2.5 text-right">Qty</span>
              <span>Unit</span>
              <span className="pr-2.5 text-right">Rate</span>
              <span className="pr-2.5 text-right">Markup</span>
              <span className="pr-3 text-right">Total</span>
              <span />
            </div>
            <div className="min-h-0 flex-1 overflow-auto pb-24" data-grid>
              {sections.map((s, si) => (
                <SectionBlock
                  key={s.id}
                  section={s}
                  index={si}
                  count={sections.length}
                  open={!collapsed.has(s.id)}
                  numbers={lineNumbers}
                  library={library}
                  quoteMarkup={header.markupBps}
                  onToggle={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                  onRename={(name) => change((prev) => prev.map((x) => (x.id === s.id ? { ...x, name } : x)), { op: "renameSection", sectionId: s.id, name })}
                  onMove={(dir) => moveSection(s.id, dir)}
                  onRemove={() => change((prev) => prev.filter((x) => x.id !== s.id), { op: "removeSection", sectionId: s.id })}
                  onAddLines={(lines) => addLines(s.id, lines)}
                  onUpdateLine={updateLine}
                  onMoveLine={moveLine}
                  onRemoveLine={removeLine}
                />
              ))}
              <div className="px-6 py-4">
                <Button variant="secondary" onClick={addSection}>
                  <Plus />
                  Add section
                </Button>
              </div>
            </div>
          </fieldset>
        ) : (
          <DetailsTab header={header} clients={clients} quoteId={initial.id} disabled={blocked} onChange={commitHeader} />
        )}
      </div>

      <aside className="flex w-[296px] flex-none flex-col gap-4 overflow-auto border-l border-hairline bg-surface-2 p-[18px]">
        <div>
          <div className="mb-2.5 text-xs font-medium text-subtle">Summary</div>
          <dl className="flex flex-col gap-2 tabular">
            <SummaryRow label="Cost" value={formatGBP(totals.cost)} />
            <SummaryRow label="Markup" value={formatGBP(totals.markup)} />
            <SummaryRow label="Subtotal" value={formatGBP(totals.net)} />
            <SummaryRow label={`VAT ${formatBps(header.vatRateBps)}`} value={formatGBP(totals.vat)} />
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
            <span className="font-medium tabular">{totals.net === 0 ? "–" : formatBps(totals.margin)}</span>
          </div>
          <div className="mt-2.5 flex h-1.5 gap-0.5" aria-hidden>
            {totals.net > 0 && (
              <>
                <div className="rounded-l-[3px] bg-ink" style={{ flex: Math.max(0, totals.cost) }} />
                <div className="rounded-r-[3px] bg-brand" style={{ flex: Math.max(0, totals.markup) }} />
              </>
            )}
          </div>
          <div className="mt-2 text-[11.5px] text-subtle">Cost in black, your markup in orange. Only your team sees this.</div>
        </div>
        <div>
          <div className="mb-2.5 text-xs font-medium text-subtle">Sections</div>
          <div className="flex flex-col gap-1.5 tabular">
            {sections.map((s, i) => (
              <div key={s.id} className="flex justify-between gap-2">
                <span className="truncate text-ink-2">
                  {i + 1}. {s.name}
                </span>
                <span>{formatGBP(sectionTotal(toCore([s])[0]))}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-auto text-[11.5px] leading-normal text-subtle">Sending, the client link and PDFs come next. Everything here saves as you type.</p>
      </aside>
    </div>
  );
}

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt?: Date }) {
  const text: Record<SaveStatus, string> = {
    saved: savedAt ? `Saved ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "All changes saved",
    pending: "Unsaved changes",
    saving: "Saving…",
    retrying: "Offline. Will retry…",
    blocked: "Not saving",
  };
  const Icon = status === "saving" ? Loader2 : status === "saved" ? Check : status === "blocked" || status === "retrying" ? AlertTriangle : Cloud;
  return (
    <span role="status" aria-live="polite" className={cn("flex items-center gap-[5px]", (status === "blocked" || status === "retrying") && "text-danger")}>
      <Icon className={cn("size-[13px]", status === "saving" && "animate-spin")} />
      {text[status]}
    </span>
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

// ── Sections and lines ───────────────────────────────────────────────────────

function SectionBlock({
  section,
  index,
  count,
  open,
  numbers,
  library,
  quoteMarkup,
  onToggle,
  onRename,
  onMove,
  onRemove,
  onAddLines,
  onUpdateLine,
  onMoveLine,
  onRemoveLine,
}: {
  section: BuilderSection;
  index: number;
  count: number;
  open: boolean;
  numbers: Map<string, string>;
  library: LibraryOption[];
  quoteMarkup: number;
  onToggle: () => void;
  onRename: (name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddLines: (lines: BuilderLine[]) => void;
  onUpdateLine: (lineId: string, patch: Partial<BuilderLine>, op: QuoteOp) => void;
  onMoveLine: (lineId: string, dir: -1 | 1) => void;
  onRemoveLine: (lineId: string) => void;
}) {
  const total = sectionTotal(toCore([section])[0]);
  return (
    <section aria-label={section.name}>
      <div className={cn(GRID, "h-9 items-center border-b border-hairline bg-surface font-semibold")}>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Collapse section" : "Expand section"} className="flex h-full items-center pl-3 text-subtle">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <span className="ml-1 font-mono text-xs font-normal text-ink-2">{index + 1}</span>
        </button>
        <span className="min-w-0 pr-2">
          <TextCell value={section.name} label="Section name" max={TEXT.name} onCommit={onRename} className="font-semibold" />
        </span>
        <span className="col-span-4 pr-2.5 text-right text-xs font-normal text-subtle">
          {section.lines.length} {section.lines.length === 1 ? "item" : "items"}
        </span>
        <span className="pr-3 text-right tabular">{formatGBP(total)}</span>
        <RowMenu
          label={`Section ${section.name}`}
          items={[
            { label: "Move up", icon: ArrowUp, disabled: index === 0, onSelect: () => onMove(-1) },
            { label: "Move down", icon: ArrowDown, disabled: index === count - 1, onSelect: () => onMove(1) },
          ]}
          danger={{
            label: "Delete section",
            confirm: section.lines.length > 0 ? `Delete "${section.name}" and its ${section.lines.length} ${section.lines.length === 1 ? "line" : "lines"}?` : undefined,
            disabled: count === 1,
            onSelect: onRemove,
          }}
        />
      </div>
      {open && (
        <>
          {section.lines.map((l) => (
            <LineRow
              key={l.id}
              line={l}
              number={numbers.get(l.id) ?? ""}
              onUpdate={(patch, op) => onUpdateLine(l.id, patch, op)}
              onMove={(dir) => onMoveLine(l.id, dir)}
              onRemove={() => onRemoveLine(l.id)}
            />
          ))}
          <AddLineRow library={library} quoteMarkup={quoteMarkup} next={`${index + 1}.${section.lines.length + 1}`} onAdd={onAddLines} />
        </>
      )}
    </section>
  );
}

function LineRow({
  line,
  number,
  onUpdate,
  onMove,
  onRemove,
}: {
  line: BuilderLine;
  number: string;
  onUpdate: (patch: Partial<BuilderLine>, op: QuoteOp) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [noteOpen, setNoteOpen] = React.useState(false);
  const total = lineTotal({ qty: line.qty, rate: line.ratePence, markup: line.markupBps });
  const set = (change: LineChange) =>
    onUpdate({ [change.field]: change.field === "note" && change.value === "" ? null : change.value } as Partial<BuilderLine>, { op: "updateLine", lineId: line.id, change });

  return (
    <div className="border-b border-line bg-white">
      <div className={cn(GRID, "group h-[34px] items-center tabular")}>
        <span className="pl-3 font-mono text-[11.5px] text-subtle">{number}</span>
        <span className="flex min-w-0 items-center gap-1.5 pr-2">
          <TextCell value={line.name} label="Item" max={TEXT.line} onCommit={(v) => set({ field: "name", value: v })} col="name" />
          {line.kind !== "normal" && (
            <Badge tone="amber" shape="tag" className="flex-none">
              {KIND_LABEL[line.kind]}
            </Badge>
          )}
        </span>
        <NumberCell
          value={qtyText(line.qty)}
          label="Quantity"
          col="qty"
          parse={(t) => {
            const r = qtySchema.safeParse(Number(t.replace(/,/g, "")));
            return t.trim() !== "" && r.success ? r.data : null;
          }}
          onCommit={(v) => set({ field: "qty", value: v })}
        />
        <TextCell value={line.unit} label="Unit" max={TEXT.short} onCommit={(v) => set({ field: "unit", value: v })} col="unit" className="text-subtle" />
        <NumberCell value={formatRate(line.ratePence)} label="Rate" col="rate" parse={(t) => { const p = parsePence(t); return p !== null && p >= 0 ? p : null; }} onCommit={(v) => set({ field: "ratePence", value: v })} />
        <NumberCell value={`${bpsText(line.markupBps)}%`} label="Markup" col="markup" parse={(t) => parsePercentToBps(t, MAX_MARKUP_BPS)} onCommit={(v) => set({ field: "markupBps", value: v })} className="text-ink-2" />
        <span className="pr-3 text-right font-medium">{formatGBP(total)}</span>
        <span className="flex items-center justify-end pr-2">
          <button
            type="button"
            aria-label={line.note ? "Edit note" : "Add note"}
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((o) => !o)}
            className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
          >
            <StickyNote className={cn("size-3.5", line.note ? (line.noteVisible ? "text-brand" : "text-ink-2") : "text-grip")} />
          </button>
          <RowMenu
            label={`Line ${number}`}
            items={[
              { label: "Move up", icon: ArrowUp, onSelect: () => onMove(-1) },
              { label: "Move down", icon: ArrowDown, onSelect: () => onMove(1) },
            ]}
            danger={{ label: "Delete line", onSelect: onRemove }}
          />
        </span>
      </div>
      {noteOpen && (
        <div className="grid grid-cols-[44px_minmax(0,1fr)_260px] gap-3 px-0 pt-1 pb-3 pr-3">
          <span />
          <textarea
            defaultValue={line.note ?? ""}
            maxLength={TEXT.note}
            rows={2}
            autoFocus
            placeholder="A note about this line, e.g. what's included or excluded"
            aria-label="Line note"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (line.note ?? "")) set({ field: "note", value: v });
            }}
            className={cn(control, "h-auto resize-y py-2 leading-normal")}
          />
          <div className="flex flex-col gap-2 text-[12.5px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={line.noteVisible} onChange={(e) => set({ field: "noteVisible", value: e.target.checked })} />
              Show the note to the client
            </label>
            <label className="flex items-center gap-2">
              <span className="text-ink-2">Type</span>
              <select value={line.kind} onChange={(e) => set({ field: "kind", value: e.target.value as LineKind })} className={cn(control, "h-7 w-auto")}>
                {LINE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[11.5px] text-subtle">PC and provisional sums are allowances, adjusted to the actual cost later.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Up/down between rows in the same column, like a spreadsheet. */
function moveFocus(from: HTMLElement, dir: -1 | 1) {
  const col = from.dataset.col;
  const grid = from.closest("[data-grid]");
  if (!col || !grid) return;
  const cells = [...grid.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]`)];
  cells[cells.indexOf(from as HTMLInputElement) + dir]?.focus();
}

const cellInput =
  "h-[26px] w-full min-w-0 rounded-[5px] bg-transparent px-1.5 outline-none hover:shadow-[inset_0_0_0_1px_var(--color-line)] focus:bg-white focus:shadow-[inset_0_0_0_1.5px_var(--color-brand)] disabled:hover:shadow-none";

/**
 * An inline cell. Uncontrolled and keyed on the committed value, so the screen shows what's saved; typing
 * commits on blur or Enter, Escape reverts, ↑/↓ move between rows.
 */
function CellInput({
  value,
  label,
  col,
  commit,
  className,
}: {
  value: string;
  label: string;
  col?: string;
  /** Returns false if the text isn't valid, which reverts the cell. */
  commit: (text: string) => boolean;
  className?: string;
}) {
  const [invalid, setInvalid] = React.useState(false);
  const done = (el: HTMLInputElement) => {
    if (el.value === value) return;
    if (!commit(el.value)) {
      el.value = value;
      setInvalid(true);
      setTimeout(() => setInvalid(false), 1_200);
    }
  };
  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-col={col}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => done(e.target)}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (e.key === "Enter") {
          e.preventDefault();
          done(el);
          moveFocus(el, 1);
        } else if (e.key === "Escape") {
          el.value = value;
          el.blur();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          done(el);
          moveFocus(el, e.key === "ArrowDown" ? 1 : -1);
        }
      }}
      className={cn(cellInput, invalid && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]", className)}
    />
  );
}

function TextCell({ value, label, max, onCommit, col, className }: { value: string; label: string; max: number; onCommit: (v: string) => void; col?: string; className?: string }) {
  const schema = React.useMemo(() => singleLine(max), [max]);
  return (
    <CellInput
      value={value}
      label={label}
      col={col}
      className={className}
      commit={(t) => {
        const r = schema.safeParse(t);
        if (!r.success) return false;
        if (r.data !== value) onCommit(r.data);
        return true;
      }}
    />
  );
}

function NumberCell<T extends number>({ value, label, col, parse, onCommit, className }: { value: string; label: string; col: string; parse: (t: string) => T | null; onCommit: (v: T) => void; className?: string }) {
  return (
    <span className="pr-1">
      <CellInput
        value={value}
        label={label}
        col={col}
        className={cn("text-right", className)}
        commit={(t) => {
          const v = parse(t);
          if (v === null) return false;
          onCommit(v);
          return true;
        }}
      />
    </span>
  );
}

// ── Adding lines ─────────────────────────────────────────────────────────────

/** Match every word of the query against name, category and description; names that start with it first. */
function searchLibrary(library: LibraryOption[], query: string): LibraryOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits = library.filter((s) => {
    const hay = `${s.name} ${s.category} ${s.description ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const q = query.trim().toLowerCase();
  return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q))).slice(0, 8);
}

/** Lines for a library pick. A bundle becomes one line per service, at the bundle's quantities. */
function linesFor(option: LibraryOption, quoteMarkup: number): BuilderLine[] {
  const base = { id: "", note: null, noteVisible: false, kind: "normal" as const };
  if (option.kind === "bundle") {
    return option.items.map((i) => ({ ...base, id: uuid(), serviceId: i.serviceId, name: i.name, qty: i.qty, unit: i.unit, ratePence: i.ratePence, markupBps: i.defaultMarkupBps ?? quoteMarkup }));
  }
  return [
    {
      ...base,
      id: uuid(),
      serviceId: option.id,
      name: option.name,
      qty: 1,
      unit: option.unit,
      ratePence: option.ratePence,
      markupBps: option.defaultMarkupBps ?? quoteMarkup,
      // The library description is written for the client, so it becomes a visible note.
      note: option.description,
      noteVisible: option.description !== null,
    },
  ];
}

function AddLineRow({ library, quoteMarkup, next, onAdd }: { library: LibraryOption[]; quoteMarkup: number; next: string; onAdd: (lines: BuilderLine[]) => void }) {
  const [text, setText] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(0);
  const listId = React.useId();
  const suggestions = React.useMemo(() => searchLibrary(library, text), [library, text]);
  const showList = open && text.trim() !== "";

  const pick = (option: LibraryOption) => {
    onAdd(linesFor(option, quoteMarkup));
    setText("");
    setHighlighted(0);
  };
  const custom = () => {
    const name = singleLine(TEXT.line).safeParse(text);
    if (!name.success) return;
    onAdd([{ id: uuid(), serviceId: null, name: name.data, qty: 1, unit: "item", ratePence: 0, markupBps: quoteMarkup, note: null, noteVisible: false, kind: "normal" }]);
    setText("");
  };

  return (
    <div className={cn(GRID, "relative h-[38px] items-center border-b border-line bg-white")}>
      <span className="pl-3 font-mono text-[11.5px] text-subtle">{next}</span>
      <span className="col-span-6 pr-3">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Type to add a line from your library, or press Enter for a custom line"
          aria-label="Add a line"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          maxLength={TEXT.line}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(suggestions.length, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (highlighted < suggestions.length) pick(suggestions[highlighted]);
              else custom();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-[28px] w-full rounded-[5px] px-2 shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-subtle focus:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
        />
      </span>
      <span />
      {showList && (
        <div id={listId} role="listbox" className="absolute top-[36px] left-[44px] z-20 w-[520px] rounded-[10px] bg-white p-1.5 shadow-pop">
          {suggestions.length > 0 && <div className="px-2 py-1.5 text-[11px] font-medium text-subtle">From your service library</div>}
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              role="option"
              aria-selected={i === highlighted}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              className={cn("flex cursor-pointer items-center gap-2.5 rounded-md p-2", i === highlighted && "bg-muted")}
            >
              {s.kind === "bundle" ? <Layers className="size-3.5 flex-none text-subtle" /> : <Library className="size-3.5 flex-none text-subtle" />}
              <span className="min-w-0 flex-1 truncate">
                {s.name}
                <span className="ml-2 text-xs text-subtle">{s.kind === "bundle" ? `Bundle · ${s.items.length} lines` : s.category}</span>
              </span>
              <span className="text-xs text-subtle">{s.unit}</span>
              <span className="w-[76px] text-right font-medium tabular">{formatGBP(s.ratePence)}</span>
            </div>
          ))}
          <div
            role="option"
            aria-selected={highlighted === suggestions.length}
            onMouseEnter={() => setHighlighted(suggestions.length)}
            onMouseDown={(e) => {
              e.preventDefault();
              custom();
            }}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-md p-2 text-ink-2", highlighted === suggestions.length && "bg-muted")}
          >
            <Plus className="size-3.5 text-subtle" />
            Add &ldquo;{text.trim()}&rdquo; as a custom line
          </div>
          <div className="mt-1 flex gap-3.5 border-t border-line px-2 pt-2 pb-1 text-[11.5px] text-subtle">
            <span>↑↓ choose</span>
            <span>↵ add</span>
            <span>esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Menus ────────────────────────────────────────────────────────────────────

type MenuItem = { label: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean; onSelect: () => void };

function RowMenu({ label, items, danger }: { label: string; items: MenuItem[]; danger: { label: string; confirm?: string; disabled?: boolean; onSelect: () => void } }) {
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative flex justify-end pr-2">
      <button type="button" aria-label={`${label} actions`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-accent hover:text-ink">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute top-8 right-2 z-30 w-[180px] rounded-[10px] bg-white p-1 font-normal shadow-pop">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40"
            >
              <it.icon className="size-3.5 text-subtle" />
              {it.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={danger.disabled}
            onClick={() => {
              setOpen(false);
              if (danger.confirm) setConfirming(true);
              else danger.onSelect();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-danger hover:bg-danger-soft disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            {danger.label}
          </button>
        </div>
      )}
      {danger.confirm && (
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent>
            <DialogTitle>{danger.label}?</DialogTitle>
            <DialogDescription>{danger.confirm}</DialogDescription>
            <div className="mt-5 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirming(false);
                  danger.onSelect();
                }}
              >
                {danger.label}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Details tab ──────────────────────────────────────────────────────────────

function DetailsTab({
  header,
  clients,
  quoteId,
  disabled,
  onChange,
}: {
  header: QuoteHeaderInput;
  clients: ClientOption[];
  quoteId: string;
  disabled: boolean;
  onChange: (h: QuoteHeaderInput) => void;
}) {
  const [title, setTitle] = React.useState(header.title);
  const [markup, setMarkup] = React.useState(bpsText(header.markupBps));
  const [site, setSite] = React.useState({
    line1: header.siteAddress?.line1 ?? "",
    line2: header.siteAddress?.line2 ?? "",
    town: header.siteAddress?.town ?? "",
    postcode: header.siteAddress?.postcode ?? "",
  });
  const [errors, setErrors] = React.useState<{ title?: string; markup?: string; site?: string }>({});
  const [deleting, startDelete] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string>();
  const client = clients.find((c) => c.id === header.clientId);

  const commitTitle = () => {
    const r = singleLine(TEXT.name).safeParse(title);
    setErrors((e) => ({ ...e, title: r.success ? undefined : "Give the quote a title" }));
    if (r.success && r.data !== header.title) onChange({ ...header, title: r.data });
  };
  const commitMarkup = () => {
    const bps = parsePercentToBps(markup, MAX_MARKUP_BPS);
    setErrors((e) => ({ ...e, markup: bps === null ? `Enter a percentage between 0 and ${MAX_MARKUP_BPS / 100}` : undefined }));
    if (bps !== null && bps !== header.markupBps) onChange({ ...header, markupBps: bps });
  };
  const commitSite = (next = site) => {
    const filled = Object.values(next).some((v) => v.trim() !== "");
    if (!filled) {
      setErrors((e) => ({ ...e, site: undefined }));
      if (header.siteAddress) onChange({ ...header, siteAddress: undefined });
      return;
    }
    const candidate = { line1: next.line1, line2: next.line2.trim() || undefined, town: next.town, postcode: next.postcode };
    const r = quoteHeaderInput.shape.siteAddress.safeParse(candidate);
    setErrors((e) => ({ ...e, site: r.success ? undefined : "Fill in the first line, town and a UK postcode, or clear all four" }));
    if (r.success) onChange({ ...header, siteAddress: r.data });
  };

  return (
    <fieldset disabled={disabled} className="min-h-0 flex-1 overflow-auto bg-surface-2 p-6">
      <div className="flex max-w-[640px] flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" error={errors.title} hint="What the client sees at the top, e.g. Kitchen extension." className="col-span-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle} maxLength={TEXT.name} className={control} />
          </Field>
          <Field label="Client">
            <select value={header.clientId} onChange={(e) => onChange({ ...header, clientId: e.target.value })} className={control}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valid until" hint="Leave blank for no expiry date.">
            <input type="date" value={header.validUntil ?? ""} onChange={(e) => onChange({ ...header, validUntil: e.target.value || undefined })} className={control} />
          </Field>
          <Field label="Default markup" error={errors.markup} hint="For new lines. Existing lines keep their own markup.">
            <div className="relative">
              <input value={markup} onChange={(e) => setMarkup(e.target.value)} onBlur={commitMarkup} inputMode="decimal" className={cn(control, "pr-7 tabular")} />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle">%</span>
            </div>
          </Field>
          <Field label="VAT rate">
            <select value={header.vatRateBps} onChange={(e) => onChange({ ...header, vatRateBps: Number(e.target.value) })} className={control}>
              {[...new Set([...VAT_OPTIONS, header.vatRateBps])]
                .filter((b) => b >= 0 && b <= MAX_VAT_BPS)
                .map((b) => (
                  <option key={b} value={b}>
                    {formatBps(b)}
                    {b === 2000 ? " (standard)" : b === 500 ? " (reduced)" : b === 0 ? " (zero-rated)" : ""}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13.5px] font-semibold">Site address</h2>
            {client?.address && (
              <button
                type="button"
                className="text-[12.5px] text-ink-2 underline underline-offset-2 hover:text-ink"
                onClick={() => {
                  const a = client.address!;
                  const next = { line1: a.line1, line2: a.line2 ?? "", town: a.town, postcode: a.postcode };
                  setSite(next);
                  commitSite(next);
                }}
              >
                Use {client.name}&apos;s address
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["line1", "line2", "town", "postcode"] as const).map((f) => (
              <input
                key={f}
                aria-label={{ line1: "Address line 1", line2: "Address line 2", town: "Town or city", postcode: "Postcode" }[f]}
                placeholder={{ line1: "Address line 1", line2: "Address line 2", town: "Town or city", postcode: "Postcode" }[f]}
                value={site[f]}
                onChange={(e) => setSite((s) => ({ ...s, [f]: e.target.value }))}
                onBlur={() => commitSite()}
                maxLength={f === "postcode" ? 8 : TEXT.name}
                className={cn(control, f === "postcode" && "uppercase")}
              />
            ))}
          </div>
          <p className={cn("text-[12px]", errors.site ? "text-danger" : "text-subtle")}>{errors.site ?? "Where the work happens, if it's not the client's own address."}</p>
        </div>

        <div className="flex flex-col items-start gap-2 border-t border-hairline pt-5">
          <h2 className="text-[13.5px] font-semibold">Delete draft</h2>
          <p className="text-subtle">Removes this quote and its lines for good.</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 />
                Delete draft
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Delete this draft?</DialogTitle>
              <DialogDescription>The quote and all its lines are removed. It can&apos;t be undone.</DialogDescription>
              <div className="mt-5 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const r = await removeDraft(quoteId);
                      if (!r.ok) setDeleteError(r.message);
                    })
                  }
                >
                  {deleting ? "Deleting…" : "Delete draft"}
                </Button>
              </div>
              {deleteError && <p className="mt-2 text-danger">{deleteError}</p>}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </fieldset>
  );
}
