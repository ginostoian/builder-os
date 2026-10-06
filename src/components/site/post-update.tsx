"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { useSiteSync } from "./offline/site-sync";
import { send } from "./offline/sync";
import { newId, type QueuedPhoto } from "./offline/outbox";
import { shrinkPhoto } from "@/components/app/shrink-photo";
import { MAX_DIARY_PHOTOS } from "@/core/projects";

type Picked = { file: File; url: string };

/** Post a site update (what got done, any problems) with photos. It goes into the job's site diary. */
export function PostUpdate({ projectId, projectName, photosEnabled }: { projectId: string; projectName: string; photosEnabled: boolean }) {
  const router = useRouter();
  const sync = useSiteSync();
  const [body, setBody] = React.useState("");
  const [photos, setPhotos] = React.useState<Picked[]>([]);
  const [status, setStatus] = React.useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = React.useTransition();
  const urls = React.useRef(new Set<string>());
  React.useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_DIARY_PHOTOS - photos.length;
    setPhotos((p) => [...p, ...[...files].slice(0, room).map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { file, url };
      })]);
  };

  const submit = () =>
    startTransition(async () => {
      setStatus(undefined);
      if (!sync) return setStatus({ ok: false, text: "Reload the page and try again." });
      // Shrink the photos now, on the phone: they may have to wait in the outbox for a while.
      setStatus({ ok: true, text: photos.length ? "Getting the photos ready…" : "Posting…" });
      const ready: QueuedPhoto[] = [];
      let unreadable = 0;
      for (const p of photos) {
        try {
          ready.push({ opId: newId(), blob: await shrinkPhoto(p.file), name: "photo.jpg", type: "image/jpeg" });
        } catch {
          unreadable++;
        }
      }
      const r = await send(sync.memberId, { kind: "update", projectId, projectName, body, photos: ready });
      if (r.status === "failed") return setStatus({ ok: false, text: r.message });
      setBody("");
      setPhotos([]);
      if (r.status === "queued") return setStatus({ ok: true, text: "No signal, so it's saved on this phone. It'll post by itself when you're back online." });
      const problem = r.warning ?? (unreadable ? "A photo couldn't be read." : undefined);
      setStatus(problem ? { ok: false, text: `Posted, but not every photo went up. ${problem}` } : { ok: true, text: "Posted to the site diary." });
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5 shadow-ring"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="What got done today? Any problems?"
        className="w-full resize-none rounded-xl bg-surface px-3 py-2.5 text-[15px] leading-normal shadow-ring-input outline-none"
      />
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
      <div className="flex gap-2">
        {photosEnabled && (
          <label className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface font-semibold shadow-ring has-[:disabled]:opacity-50">
            <Camera className="size-[17px]" />
            Photos
            <input type="file" accept="image/*" multiple disabled={pending || photos.length >= MAX_DIARY_PHOTOS} onChange={(e) => (add(e.target.files), (e.target.value = ""))} className="sr-only" />
          </label>
        )}
        <button type="submit" disabled={pending || (!body.trim() && photos.length === 0)} className="h-12 flex-1 rounded-xl bg-ink font-semibold text-white disabled:opacity-50">
          {pending ? "Posting…" : "Post update"}
        </button>
      </div>
      {status && <p className={status.ok ? "text-[13px] text-success" : "text-[13px] text-danger"}>{status.text}</p>}
    </form>
  );
}
