"use client";

import * as React from "react";
import { readReceiptAction, receiptReaderOnAction } from "@/app/receipt-actions";
import { shrinkPhoto } from "@/components/app/shrink-photo";
import type { ReceiptReading } from "@/server/receipt-reader";

let on: Promise<boolean> | null = null;

/**
 * Read the first receipt someone picks and hand back what was on it, to fill in fields they haven't typed
 * yet. Does nothing if receipt reading isn't set up.
 */
export function useReceiptReader(apply: (r: ReceiptReading) => void) {
  const [reading, setReading] = React.useState(false);
  const [note, setNote] = React.useState<string>();
  const applyRef = React.useRef(apply);
  React.useEffect(() => {
    applyRef.current = apply;
  });

  const read = React.useCallback(async (file: File) => {
    on ??= receiptReaderOnAction().catch(() => false);
    if (!(await on)) return;
    setReading(true);
    setNote(undefined);
    try {
      const form = new FormData();
      form.set("file", file.type === "application/pdf" ? file : new File([await shrinkPhoto(file)], "receipt.jpg", { type: "image/jpeg" }));
      const r = await readReceiptAction(form);
      if (r) {
        applyRef.current(r);
        setNote("Filled in from the receipt. Check it before saving.");
      } else setNote("Couldn't read that receipt. Fill it in by hand.");
    } catch {
      setNote("Couldn't read that receipt. Fill it in by hand.");
    } finally {
      setReading(false);
    }
  }, []);

  return { read, reading, note };
}
