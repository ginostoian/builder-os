"use client";

import { StoredImage } from "@/components/stored-image";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CloudRain, Eye, EyeOff, Snowflake, Sun, Trash2, Wind, X } from "lucide-react";
import { addDiaryEntryAction, deleteDiaryEntryAction, setDiarySharedAction, uploadDiaryPhoto } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { TEXT } from "@/core/limits";
import { MAX_DIARY_PHOTOS, WEATHER, WEATHER_LABEL, type Weather } from "@/core/projects";
import { longDate } from "@/core/quote-snapshot";
import { cn } from "@/lib/utils";
import { control } from "../form-fields";
import { shrinkPhoto } from "../shrink-photo";

export type DiaryEntry = { id: string; entryDate: string; body: string; weather: string | null; photos: { url: string }[]; shareWithClient: boolean; authorName: string | null };

const WEATHER_ICON: Record<Weather, React.ComponentType<{ className?: string }>> = { dry: Sun, rain: CloudRain, wind: Wind, cold: Snowflake, hot: Sun };

/**
 * The site diary: what happened each day, the weather, who was on site, photos. Entries are for the team
 * unless shared, and shared ones show in the client's portal.
 */
export function SiteDiary({ projectId, entries, today, canEdit, storageEnabled, shareProgress }: { projectId: string; entries: DiaryEntry[]; today: string; canEdit: boolean; storageEnabled: boolean; shareProgress: boolean }) {
  const byDate = new Map<string, DiaryEntry[]>();
  for (const e of entries) byDate.set(e.entryDate, [...(byDate.get(e.entryDate) ?? []), e]);
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2 px-4 py-4 lg:px-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        {canEdit && <Composer projectId={projectId} today={today} storageEnabled={storageEnabled} shareProgress={shareProgress} />}
        {entries.length === 0 ? (
          <p className="rounded-[12px] bg-white px-5 py-8 text-center text-subtle shadow-ring">No diary entries yet. Note what happened on site each day: who was there, deliveries, problems, and photos of progress.</p>
        ) : (
          [...byDate.entries()].map(([date, list]) => (
            <section key={date} className="flex flex-col gap-2">
              <h3 className="px-1 text-[12.5px] font-semibold text-ink-2">{date === today ? "Today" : longDate(date)}</h3>
              {list.map((e) => (
                <Entry key={e.id} projectId={projectId} entry={e} canEdit={canEdit} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Entry({ projectId, entry, canEdit }: { projectId: string; entry: DiaryEntry; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const W = entry.weather && (WEATHER as readonly string[]).includes(entry.weather) ? WEATHER_ICON[entry.weather as Weather] : null;
  return (
    <article className="rounded-[12px] bg-white px-4 py-3.5 shadow-ring">
      <header className="mb-1.5 flex items-center gap-2 text-[12px] text-subtle">
        <span className="font-medium text-ink-2">{entry.authorName ?? "Team"}</span>
        {W && (
          <span className="flex items-center gap-1">
            <W className="size-3.5" />
            {WEATHER_LABEL[entry.weather as Weather]}
          </span>
        )}
        <span className="flex-1" />
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => void (await setDiarySharedAction(projectId, entry.id, !entry.shareWithClient), router.refresh()))}
            className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", entry.shareWithClient ? "bg-success-soft text-success" : "bg-muted text-ink-2 hover:text-ink")}
            title={entry.shareWithClient ? "The client sees this in their portal. Click to make it team only." : "Only your team sees this. Click to share it with the client."}
          >
            {entry.shareWithClient ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            {entry.shareWithClient ? "Shared with client" : "Team only"}
          </button>
        ) : (
          entry.shareWithClient && <span className="text-success">Shared with client</span>
        )}
        {canEdit && (
          <button
            type="button"
            aria-label="Delete entry"
            title={confirm ? "Click again to delete" : "Delete entry"}
            disabled={pending}
            onBlur={() => setConfirm(false)}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              startTransition(async () => void (await deleteDiaryEntryAction(projectId, entry.id), router.refresh()));
            }}
            className={cn("grid size-6 place-items-center rounded-md hover:bg-muted", confirm ? "text-danger" : "text-subtle")}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </header>
      <p className="leading-[1.55] whitespace-pre-line">{entry.body}</p>
      {entry.photos.length > 0 && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {entry.photos.map((p, i) => (
            <a key={p.url} href={p.url} target="_blank" rel="noreferrer noopener" className="block aspect-square overflow-hidden rounded-[8px] bg-muted">
              <StoredImage src={p.url} alt={`Site photo ${i + 1}`} className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

/** Write today's update: text, weather, photos, and whether the client sees it. */
function Composer({ projectId, today, storageEnabled, shareProgress }: { projectId: string; today: string; storageEnabled: boolean; shareProgress: boolean }) {
  const router = useRouter();
  const [date, setDate] = React.useState(today);
  const [body, setBody] = React.useState("");
  const [weather, setWeather] = React.useState<Weather | null>(null);
  const [share, setShare] = React.useState(false);
  const [files, setFiles] = React.useState<{ file: File; preview: string }[]>([]);
  const [status, setStatus] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  const post = async () => {
    setBusy(true);
    setError(undefined);
    const r = await addDiaryEntryAction({ projectId, entryDate: date, body: body.trim(), weather: weather ?? undefined, shareWithClient: share });
    if (!r.ok || !r.id) {
      setBusy(false);
      return setError(r.ok ? "Something went wrong." : r.message);
    }
    const failed: string[] = [];
    for (const [i, f] of files.entries()) {
      setStatus(`Uploading photo ${i + 1} of ${files.length}…`);
      try {
        const form = new FormData();
        form.set("projectId", projectId);
        form.set("entryId", r.id);
        form.set("photo", new File([await shrinkPhoto(f.file)], "photo.jpg", { type: "image/jpeg" }));
        const up = await uploadDiaryPhoto(form);
        if (!up.ok) failed.push(up.message);
      } catch {
        failed.push("A photo couldn't be read.");
      }
    }
    for (const f of files) URL.revokeObjectURL(f.preview);
    setFiles([]);
    setBody("");
    setWeather(null);
    setStatus(undefined);
    setBusy(false);
    if (failed.length) setError(`Posted, but ${failed.length} photo${failed.length > 1 ? "s" : ""} didn't upload: ${failed[0]}`);
    router.refresh();
  };

  return (
    <form
      className="flex flex-col gap-2.5 rounded-[12px] bg-white px-4 py-3.5 shadow-ring"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) void post();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Site update</span>
        <input type="date" aria-label="Date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={cn(control, "h-7 w-[150px] text-[12.5px]")} />
        <span className="flex-1" />
        <div className="flex gap-1" role="group" aria-label="Weather">
          {WEATHER.map((w) => {
            const Icon = WEATHER_ICON[w];
            return (
              <button
                key={w}
                type="button"
                aria-pressed={weather === w}
                title={WEATHER_LABEL[w]}
                onClick={() => setWeather((cur) => (cur === w ? null : w))}
                className={cn("flex h-7 items-center gap-1 rounded-full px-2 text-[12px]", weather === w ? "bg-ink text-white" : "bg-surface text-ink-2 hover:bg-muted")}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{WEATHER_LABEL[w]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={TEXT.note}
        rows={3}
        placeholder="What happened today? Who was on site, deliveries, problems, decisions…"
        className={cn(control, "h-auto resize-y py-2 leading-normal")}
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={f.preview} className="relative size-16 overflow-hidden rounded-[8px] bg-muted">
              {/* Local preview of a picked photo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt="" className="size-full object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => (URL.revokeObjectURL(f.preview), setFiles((fs) => fs.filter((_, j) => j !== i)))} className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-ink/70 text-white [&_svg]:size-3">
                <X />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {storageEnabled && (
          <>
            <Button type="button" variant="secondary" disabled={busy || files.length >= MAX_DIARY_PHOTOS} onClick={() => input.current?.click()}>
              <Camera className="text-ink-2" />
              Photos
            </Button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).slice(0, MAX_DIARY_PHOTOS - files.length);
                setFiles((fs) => [...fs, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
                e.target.value = "";
              }}
            />
          </>
        )}
        <label className={cn("flex items-center gap-2", !shareProgress && "text-subtle")} title={shareProgress ? undefined : "Turn on sharing in the project's details to show updates to the client."}>
          <input type="checkbox" checked={share && shareProgress} disabled={!shareProgress} onChange={(e) => setShare(e.target.checked)} />
          Share with the client
        </label>
        <span className="flex-1" />
        {status && <span className="text-[12px] text-subtle">{status}</span>}
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Post update"}
        </Button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </form>
  );
}
