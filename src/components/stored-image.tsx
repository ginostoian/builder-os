"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

const RETRIES = [1_500, 4_000, 9_000];

/**
 * A photo from our file storage (Bunny CDN). A just-uploaded photo can take a few seconds to reach the CDN,
 * so a failed load is retried (with a cache-busting query) before it shows as missing. `preview` (a local
 * object URL) shows the person's own copy straight after they upload it.
 */
export function StoredImage({ src, preview, alt, className }: { src: string; preview?: string; alt: string; className?: string }) {
  const [attempt, setAttempt] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [usePreview, setUsePreview] = React.useState(Boolean(preview));
  if (failed) {
    return (
      <span className={cn("flex flex-col items-center justify-center gap-1 bg-muted text-center text-[10.5px] text-subtle", className)} title="This photo couldn't be loaded. An Admin can run Settings → Company → Check file storage.">
        <ImageOff className="size-4" />
        Not available
      </span>
    );
  }
  const url = usePreview && preview ? preview : attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;
  return (
    // Our own CDN, per environment: a plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={className}
      onError={() => {
        if (usePreview) return setUsePreview(false);
        if (attempt >= RETRIES.length) return setFailed(true);
        setTimeout(() => setAttempt((a) => a + 1), RETRIES[attempt]);
      }}
    />
  );
}
