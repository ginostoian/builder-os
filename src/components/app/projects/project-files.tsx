"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FileImage, FileText, Trash2, Upload } from "lucide-react";
import { deleteFileAction, setFileSharedAction, uploadProjectFile } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { MAX_FILE_BYTES } from "@/core/files";
import { cn } from "@/lib/utils";

export type ProjectFile = { id: string; name: string; url: string; contentType: string; sizeBytes: number; shareWithClient: boolean; uploadedByName: string | null; createdAt: Date };

const size = (n: number) => (n < 1_000_000 ? `${Math.max(1, Math.round(n / 1000))} KB` : `${(n / 1_000_000).toFixed(1)} MB`);
const when = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(d);

/** Drawings, specs, certificates and photos for the job. Share a file and the client can open it in their portal. */
export function ProjectFiles({ projectId, files, canEdit, storageEnabled, shareProgress }: { projectId: string; files: ProjectFile[]; canEdit: boolean; storageEnabled: boolean; shareProgress: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [dragOver, setDragOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  const upload = async (list: File[]) => {
    setError(undefined);
    const errors: string[] = [];
    for (const [i, file] of list.entries()) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      if (file.size > MAX_FILE_BYTES) {
        errors.push(`${file.name} is over 4 MB.`);
        continue;
      }
      const form = new FormData();
      form.set("projectId", projectId);
      form.set("file", file);
      const r = await uploadProjectFile(form).catch(() => ({ ok: false as const, message: "The upload didn't go through." }));
      if (!r.ok) errors.push(`${file.name}: ${r.message}`);
    }
    setBusy(undefined);
    if (errors.length) setError(errors.join(" "));
    router.refresh();
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2 px-6 py-4">
      <div className="mx-auto flex max-w-[960px] flex-col gap-3">
        {canEdit && storageEnabled && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void upload(Array.from(e.dataTransfer.files));
            }}
            className={cn("flex items-center gap-3 rounded-[12px] border border-dashed border-faint bg-white px-4 py-3.5", dragOver && "border-ink bg-surface")}
          >
            <Upload className="size-4 text-subtle" />
            <span className="flex-1 text-ink-2">Drop drawings, specs or certificates here. PDFs and images, up to 4 MB each.</span>
            {busy && <span className="text-[12px] text-subtle">{busy}</span>}
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
              Choose files
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = "";
                void upload(list);
              }}
            />
          </div>
        )}
        {!storageEnabled && <p className="text-subtle">File storage isn&apos;t set up yet, so files can&apos;t be uploaded.</p>}
        {error && <p className="text-danger">{error}</p>}
        {files.length === 0 ? (
          <p className="rounded-[12px] bg-white px-5 py-8 text-center text-subtle shadow-ring">No files yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-[12px] bg-white shadow-ring">
            {files.map((f) => (
              <FileRow key={f.id} projectId={projectId} file={f} canEdit={canEdit} shareProgress={shareProgress} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FileRow({ projectId, file, canEdit, shareProgress }: { projectId: string; file: ProjectFile; canEdit: boolean; shareProgress: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const Icon = file.contentType.startsWith("image/") ? FileImage : FileText;
  return (
    <li className="flex items-center gap-3 border-b border-muted px-4 py-2.5 last:border-b-0">
      <Icon className="size-4 flex-none text-subtle" />
      <a href={file.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 hover:underline">
        <span className="block truncate font-medium">{file.name}</span>
        <span className="block text-[11.5px] text-subtle">
          {size(file.sizeBytes)} · {file.uploadedByName ?? "Team"} · {when(file.createdAt)}
        </span>
      </a>
      {canEdit ? (
        <button
          type="button"
          disabled={pending || (!shareProgress && !file.shareWithClient)}
          onClick={() => startTransition(async () => void (await setFileSharedAction(projectId, file.id, !file.shareWithClient), router.refresh()))}
          className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] disabled:opacity-50", file.shareWithClient ? "bg-success-soft text-success" : "bg-muted text-ink-2 hover:text-ink")}
          title={!shareProgress ? "Turn on sharing in the project's details first." : file.shareWithClient ? "The client can open this in their portal." : "Only your team sees this."}
        >
          {file.shareWithClient ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {file.shareWithClient ? "Shared" : "Team only"}
        </button>
      ) : (
        file.shareWithClient && <span className="text-[12px] text-success">Shared</span>
      )}
      {canEdit && (
        <button
          type="button"
          aria-label={`Delete ${file.name}`}
          title={confirm ? "Click again to delete" : "Delete"}
          disabled={pending}
          onBlur={() => setConfirm(false)}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            startTransition(async () => void (await deleteFileAction(projectId, file.id), router.refresh()));
          }}
          className={cn("grid size-7 place-items-center rounded-md hover:bg-muted", confirm ? "text-danger" : "text-subtle")}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}
