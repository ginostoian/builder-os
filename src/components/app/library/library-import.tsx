"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, FileUp, TriangleAlert } from "lucide-react";
import { importLibrary, previewImport, type ImportResult } from "@/app/app/library/actions";
import { Button } from "@/components/ui/button";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type ImportPlan } from "@/core/library-import";
import { formatGBP } from "@/core/money";
import { cn } from "@/lib/utils";
import { Panel } from "../app-shell";
import { SectionHeading } from "../form-fields";

const SHOWN_ROWS = 200;

/** Pick a CSV → preview what will happen → import. Nothing is written until "Import". */
export function LibraryImport() {
  const [file, setFile] = React.useState<{ name: string; text: string }>();
  const [plan, setPlan] = React.useState<ImportPlan>();
  const [result, setResult] = React.useState<ImportResult>();
  const [pending, startTransition] = React.useTransition();
  const input = React.useRef<HTMLInputElement>(null);

  const choose = async (f: File | undefined) => {
    setResult(undefined);
    setPlan(undefined);
    if (!f) return setFile(undefined);
    if (f.size > MAX_IMPORT_BYTES) {
      setFile(undefined);
      return setPlan({ ok: false, error: "The file is over 1 MB. Split it into smaller files." });
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    startTransition(async () => setPlan(await previewImport(text)));
  };
  const run = () => file && startTransition(async () => setResult(await importLibrary(file.text)));
  const reset = () => {
    setFile(undefined);
    setPlan(undefined);
    setResult(undefined);
    if (input.current) input.current.value = "";
  };

  if (result?.ok) {
    return (
      <Panel className="flex flex-col items-start gap-3 p-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <Check className="size-4 text-success" />
          Added {result.added} {result.added === 1 ? "service" : "services"}
        </div>
        {(result.skipped > 0 || result.failed > 0) && (
          <p className="text-ink-2">
            {result.skipped > 0 && `${result.skipped} already in your library, so skipped. `}
            {result.failed > 0 && `${result.failed} had problems and weren't imported.`}
          </p>
        )}
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/app/library">Open the library</Link>
          </Button>
          <Button variant="secondary" onClick={reset}>
            Import another file
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-4 p-5">
        <SectionHeading
          title="1. Prepare your file"
          hint="A CSV with a heading row. Save from Excel or Google Sheets with File → Save as / Download → CSV."
        />
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-ink-2">
          <span className="font-medium text-ink">Required</span>
          <span>category, name, unit, rate (in pounds, before markup)</span>
          <span className="font-medium text-ink">Optional</span>
          <span>description, markup (a percentage; blank uses your company default)</span>
        </div>
        <p className="text-subtle">
          Columns can be in any order, and common names like &ldquo;price&rdquo; or &ldquo;trade&rdquo; work too. Up to {MAX_IMPORT_ROWS.toLocaleString("en-GB")} services per file.
          Anything already in your library (same category and name) is skipped.
        </p>
        <div>
          <Button variant="secondary" asChild>
            <a href="/app/library/import/template" download>
              <Download className="text-ink-2" />
              Download the template
            </a>
          </Button>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-4 p-5">
        <SectionHeading title="2. Choose the file" />
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line px-6 py-8 text-center hover:bg-surface",
            pending && "pointer-events-none opacity-60",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void choose(e.dataTransfer.files[0]);
          }}
        >
          <FileUp className="size-5 text-subtle" />
          <span className="font-medium">{file ? file.name : "Choose a CSV file or drop it here"}</span>
          <span className="text-subtle">{pending && !plan ? "Checking…" : "Nothing is saved until you press Import."}</span>
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
        </label>
      </Panel>

      {plan && !plan.ok && (
        <p role="alert" className="flex items-center gap-2 text-danger">
          <TriangleAlert className="size-4" />
          {plan.error}
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="flex items-center gap-2 text-danger">
          <TriangleAlert className="size-4" />
          {result.message}
        </p>
      )}

      {plan?.ok && (
        <Panel className="flex flex-col gap-4 p-5">
          <SectionHeading title="3. Check and import" />
          <p className="text-ink-2">
            <span className="font-medium text-ink">{plan.counts.new} to add</span>
            {plan.counts.duplicate > 0 && ` · ${plan.counts.duplicate} already in your library (skipped)`}
            {plan.counts.error > 0 && <span className="text-danger"> · {plan.counts.error} with problems (skipped)</span>}
            {plan.ignoredColumns.length > 0 && ` · Ignoring columns: ${plan.ignoredColumns.join(", ")}`}
          </p>
          <div className="max-h-[420px] overflow-auto rounded-lg shadow-ring">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface text-[12px] text-subtle">
                <tr>
                  <th className="w-14 px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="w-[38%] px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, SHOWN_ROWS).map((r) => (
                  <tr key={r.line} className="border-t border-hairline align-top">
                    <td className="px-3 py-2 text-subtle tabular">{r.line}</td>
                    <td className="px-3 py-2">{r.status === "error" ? r.name || "–" : r.value.name}</td>
                    <td className="px-3 py-2 text-ink-2">{r.status === "error" ? "" : r.value.category}</td>
                    <td className="px-3 py-2 text-right tabular text-ink-2">{r.status === "error" ? "" : `${formatGBP(r.value.ratePence)} / ${r.value.unit}`}</td>
                    <td className={cn("px-3 py-2", r.status === "error" ? "text-danger" : r.status === "duplicate" ? "text-subtle" : "text-success")}>
                      {r.status === "new" ? "Will be added" : r.status === "duplicate" ? "Already in your library" : r.errors.join(". ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.rows.length > SHOWN_ROWS && <p className="text-subtle">Showing the first {SHOWN_ROWS} of {plan.rows.length} rows.</p>}
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={pending || plan.counts.new === 0}>
              {pending ? "Importing…" : `Import ${plan.counts.new} ${plan.counts.new === 1 ? "service" : "services"}`}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Choose a different file
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
