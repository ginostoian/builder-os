"use client";

import * as React from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { removeLogo, uploadLogo } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";

/** Upload or remove the company logo. Saves straight away (separately from the rest of the form). */
export function LogoUpload({ logoUrl, onChange, disabled }: { logoUrl: string; onChange: (url: string) => void; disabled: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium">Logo</span>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-[120px] flex-none items-center justify-center rounded-md bg-surface shadow-ring">
          {logoUrl ? (
            // Our own CDN or a link the Admin entered. Plain <img>: no proxying of arbitrary hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Company logo" referrerPolicy="no-referrer" className="max-h-10 max-w-[108px] object-contain" />
          ) : (
            <span className="text-[11.5px] text-subtle">No logo</span>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Logo image"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const form = new FormData();
            form.set("logo", file);
            startTransition(async () => {
              const r = await uploadLogo(form);
              if (r.ok) {
                setError(undefined);
                onChange(r.logoUrl ?? "");
              } else setError(r.message);
              if (input.current) input.current.value = "";
            });
          }}
        />
        <Button type="button" variant="secondary" disabled={disabled || pending} onClick={() => input.current?.click()}>
          <ImageUp className="text-ink-2" />
          {pending ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
        </Button>
        {logoUrl && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || pending}
            aria-label="Remove logo"
            onClick={() =>
              startTransition(async () => {
                const r = await removeLogo();
                if (r.ok) onChange("");
                else setError(r.message);
              })
            }
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <p className={error ? "text-[12px] text-danger" : "text-[12px] text-subtle"}>{error ?? "PNG, JPEG or WebP, up to 1 MB. A wide logo on a transparent background looks best."}</p>
    </div>
  );
}
