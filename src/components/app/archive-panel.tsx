"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Panel } from "./app-shell";
import { SectionHeading } from "./form-fields";

export type RecordActionResult = { ok: true } | { ok: false; message: string };

/**
 * Archive / restore a record, and delete it when nothing depends on it. Pass Server Actions bound to the
 * record's id (`archiveClient.bind(null, id)`). A successful delete redirects on the server.
 */
export function ArchivePanel({
  noun,
  name,
  archived,
  hint,
  archivedHint,
  archive,
  remove,
}: {
  noun: string;
  name: string;
  archived: boolean;
  hint: string;
  archivedHint: string;
  archive: (archived: boolean) => Promise<RecordActionResult>;
  /** Omit when the record can't be deleted (the hint should say why). */
  remove?: () => Promise<RecordActionResult>;
}) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string>();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await archive(!archived);
      setMessage(result.ok ? undefined : result.message);
    });
  const doRemove = () =>
    startTransition(async () => {
      const result = await remove!();
      if (!result.ok) {
        setConfirmOpen(false);
        setMessage(result.message);
      }
    });

  return (
    <Panel className="flex flex-col gap-3 p-5">
      <SectionHeading title={archived ? "Archived" : "Archive or delete"} hint={archived ? archivedHint : hint} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={toggleArchive} disabled={pending}>
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? `Restore ${noun}` : `Archive ${noun}`}
        </Button>
        {remove && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={pending}>
                <Trash2 />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Delete {name}?</DialogTitle>
              <DialogDescription>This permanently removes the {noun}. It can&apos;t be undone.</DialogDescription>
              <div className="mt-5 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={doRemove} disabled={pending}>
                  {pending ? "Deleting…" : `Delete ${noun}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {message && (
        <p role="alert" className="text-danger">
          {message}
        </p>
      )}
    </Panel>
  );
}
