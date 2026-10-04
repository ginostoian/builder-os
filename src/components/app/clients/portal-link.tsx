"use client";

import * as React from "react";
import { Check, Copy, LogOut, RotateCcw, ShieldCheck } from "lucide-react";
import { getPortalLink, resetPortalLink, signOutEverywhereAction } from "@/app/app/clients/portal-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Panel } from "../app-shell";
import { SectionHeading } from "../form-fields";

/** The client's private portal link: every quote sent to them is there. Copy it, or reset it if it leaked. */
export function PortalLinkPanel({
  clientId,
  clientName,
  canReset,
  security,
}: {
  clientId: string;
  clientName: string;
  canReset: boolean;
  /** Sign-in on (company setting and email set up), whether they have an email, devices signed in now. */
  security: { on: boolean; hasEmail: boolean; devices: number };
}) {
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
      <p className="flex items-start gap-1.5 text-[12.5px] text-ink-2">
        <ShieldCheck className="mt-px size-3.5 flex-none" />
        <span>
          {!security.on
            ? "Anyone with the link can open it (sign-in is off for your company, or email isn't set up)."
            : !security.hasEmail
              ? "No email address, so the link alone opens it. Add their email to protect it with a sign-in code."
              : `Protected: on a new device they confirm their email with a code. Signed in on ${security.devices} device${security.devices === 1 ? "" : "s"}.`}
        </span>
      </p>
      {canReset && security.on && security.devices > 0 && (
        <Button
          variant="ghost"
          className="self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await signOutEverywhereAction(clientId);
              setMessage(r.ok ? `Signed out of ${r.count} device${r.count === 1 ? "" : "s"}. They'll need a new code to get back in.` : r.message);
            })
          }
        >
          <LogOut />
          Sign out everywhere
        </Button>
      )}
      {message && <p className="text-[12.5px] text-ink-2">{message}</p>}
    </Panel>
  );
}
