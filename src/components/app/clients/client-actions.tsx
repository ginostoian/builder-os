"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { archiveClient, removeClient } from "@/app/app/clients/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Panel } from "../app-shell";
import { SectionHeading } from "../form-fields";

/** Archive / restore, and delete when the client has no quotes. */
export function ClientDangerZone({ clientId, name, archived, quoteCount }: { clientId: string; name: string; archived: boolean; quoteCount: number }) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string>();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await archiveClient(clientId, !archived);
      setMessage(result.ok ? undefined : result.message);
    });
  const remove = () =>
    startTransition(async () => {
      // On success the action redirects to the client list, so only a failure comes back here.
      const result = await removeClient(clientId);
      if (!result.ok) {
        setConfirmOpen(false);
        setMessage(result.message);
      }
    });

  return (
    <Panel className="flex flex-col gap-3 p-5">
      <SectionHeading
        title={archived ? "Archived" : "Archive or delete"}
        hint={
          archived
            ? "Hidden from the client list. Restore to use them on new quotes again."
            : "Archiving hides a client from the list and keeps their history. Only clients without quotes can be deleted."
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={toggleArchive} disabled={pending}>
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? "Restore client" : "Archive client"}
        </Button>
        {quoteCount === 0 && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={pending}>
                <Trash2 />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Delete {name}?</DialogTitle>
              <DialogDescription>This permanently removes the client and their details. It can&apos;t be undone.</DialogDescription>
              <div className="mt-5 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={remove} disabled={pending}>
                  {pending ? "Deleting…" : "Delete client"}
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
