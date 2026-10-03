"use client";

import * as React from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { getPortalLink, resetPortalLink } from "@/app/app/clients/portal-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Panel } from "../app-shell";
import { SectionHeading } from "../form-fields";

/** The client's private portal link: every quote sent to them is there. Copy it, or reset it if it leaked. */
export function PortalLinkPanel({ clientId, clientName, canReset }: { clientId: string; clientName: string; canReset: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const [message, setMessage] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const copy = (link: string) =>
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1_500);
      },
      () => window.prompt("Copy this link:", link),
    );
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <SectionHeading title="Client portal" hint={`${clientName}'s private link. Every quote you send them appears there.`} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await getPortalLink(clientId);
              if (r.ok) await copy(r.link);
              else setMessage(r.message);
            })
          }
        >
          {copied ? <Check className="text-success" /> : <Copy className="text-ink-2" />}
          {copied ? "Copied" : "Copy portal link"}
        </Button>
        {canReset && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" disabled={pending}>
                <RotateCcw />
                Reset link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Reset {clientName}&apos;s link?</DialogTitle>
              <DialogDescription>The current link stops working straight away, for anyone who has it. Use this if it was sent to the wrong person. You&apos;ll need to send {clientName} the new one.</DialogDescription>
              <div className="mt-5 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await resetPortalLink(clientId);
                        if (r.ok) {
                          await copy(r.link);
                          setMessage("New link copied. The old one no longer works.");
                        } else setMessage(r.message);
                      })
                    }
                  >
                    Reset link
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {message && <p className="text-[12.5px] text-ink-2">{message}</p>}
    </Panel>
  );
}
