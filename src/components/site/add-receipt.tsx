"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Receipt, X } from "lucide-react";
import { useSiteSync } from "./offline/site-sync";
import { send } from "./offline/sync";
import { newId, type QueuedPhoto } from "./offline/outbox";
import { shrinkPhoto } from "@/components/app/shrink-photo";
import { useReceiptReader } from "@/components/receipt-reader";
import { MAX_RECEIPTS } from "@/core/costs";
import { formatGBP, parsePence } from "@/core/money";

const input = "h-12 w-full min-w-0 rounded-xl bg-surface px-3 text-[15px] shadow-ring-input outline-none";

/**
 * Log something bought for the job, with a photo of the receipt: it goes straight into the job's costs
 * for the office. Big targets; the camera opens from the photo button.
 */
export function AddReceipt({ projectId, projectName, photosEnabled }: { projectId: string; projectName: string; photosEnabled: boolean }) {
  const router = useRouter();
  const sync = useSiteSync();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ description: "", supplier: "", total: "", includesVat: true, forClient: false });
  const [photos, setPhotos] = React.useState<{ file: File; url: string }[]>([]);
  // The first photo fills in whatever hasn't been typed yet.
  const reader = useReceiptReader((r) =>
    setV((x) => ({
      ...x,
      description: x.description.trim() ? x.description : (r.description ?? ""),
      supplier: x.supplier.trim() ? x.supplier : (r.supplier ?? ""),
      total: x.total.trim() || r.totalPence === null ? x.total : (r.totalPence / 100).toFixed(2),
      includesVat: r.vatPence === null ? x.includesVat : r.vatPence > 0,
    })),
  );
  const [status, setStatus] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const urls = React.useRef(new Set<string>());
  React.useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const submit = () =>
    startTransition(async () => {
      setStatus(undefined);
      const total = parsePence(v.total);
      if (total === null || total === 0) return setStatus({ ok: false, text: "Enter the total from the receipt." });
      if (!sync) return setStatus({ ok: false, text: "Reload the page and try again." });
      const ready: QueuedPhoto[] = [];
      let unreadable = 0;
      for (const p of photos) {
        try {
          ready.push(
            p.file.type === "application/pdf"
              ? { opId: newId(), blob: p.file, name: "receipt.pdf", type: "application/pdf" }
              : { opId: newId(), blob: await shrinkPhoto(p.file), name: "receipt.jpg", type: "image/jpeg" },
          );
        } catch {
          unreadable++;
        }
      }
      const r = await send(sync.memberId, {
        kind: "receipt",
        projectId,
        projectName,
        input: { description: v.description, supplier: v.supplier, totalPence: total, includesVat: v.includesVat, forClient: v.forClient },
        photos: ready,
      });
      if (r.status === "failed") return setStatus({ ok: false, text: r.message });
      setV({ description: "", supplier: "", total: "", includesVat: true, forClient: false });
      setPhotos([]);
      setOpen(false);
      if (r.status === "queued") return setStatus({ ok: true, text: `No signal, so ${formatGBP(total)} is saved on this phone. It'll send by itself.` });
      const problem = r.warning ?? (unreadable ? "A photo couldn't be read." : undefined);
      setStatus(problem ? { ok: false, text: `Saved ${formatGBP(total)}, but the photo didn't upload. ${problem}` } : { ok: true, text: `Saved ${formatGBP(total)} for the office.` });
      router.refresh();
    });

  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold shadow-ring">
          <Receipt className="size-[17px]" />
          Add a receipt
        </button>
        {status && <p className={status.ok ? "text-center text-[13px] text-success" : "text-center text-[13px] text-danger"}>{status.text}</p>}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5 shadow-ring"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">Add a receipt</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex size-10 items-center justify-center rounded-full text-subtle">
          <X className="size-5" />
        </button>
      </div>
      {photosEnabled && (
        <>
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {photos.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={p.url} alt="" className="size-full object-cover" />
                  <button type="button" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_RECEIPTS && (
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface font-semibold shadow-ring">
              <Camera className="size-[17px]" />
              {photos.length ? "Another photo" : "Photo of the receipt"}
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const url = URL.createObjectURL(f);
                    urls.current.add(url);
                    if (photos.length === 0) void reader.read(f);
                    setPhotos((x) => [...x, { file: f, url }]);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </>
      )}
      {(reader.reading || reader.note) && <p className="text-[13px] text-ink-2">{reader.reading ? "Reading the receipt…" : reader.note}</p>}
      <input value={v.description} onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))} maxLength={300} placeholder="What for? e.g. Screws and silicone" aria-label="What for" className={input} />
      <div className="flex gap-2">
        <input value={v.supplier} onChange={(e) => setV((x) => ({ ...x, supplier: e.target.value }))} maxLength={120} placeholder="Shop" aria-label="Shop" className={input} />
        <span className="relative w-[40%] flex-none">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle">£</span>
          <input value={v.total} onChange={(e) => setV((x) => ({ ...x, total: e.target.value }))} inputMode="decimal" placeholder="Total" aria-label="Total" className={`${input} pl-7 tabular`} />
        </span>
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={v.includesVat} onChange={(e) => setV((x) => ({ ...x, includesVat: e.target.checked }))} className="size-5" />
        <span>The receipt shows VAT</span>
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={v.forClient} onChange={(e) => setV((x) => ({ ...x, forClient: e.target.checked }))} className="size-5" />
        <span>Bought for the client (they&apos;ll pay it back)</span>
      </label>
      <button type="submit" disabled={pending || !v.description.trim() || !v.total.trim()} className="h-12 rounded-xl bg-ink font-semibold text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save receipt"}
      </button>
      {status && <p className={status.ok ? "text-[13px] text-success" : "text-[13px] text-danger"}>{status.text}</p>}
    </form>
  );
}
