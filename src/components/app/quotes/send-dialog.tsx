"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Send } from "lucide-react";
import { sendQuoteToClient, type SendQuoteResult } from "@/app/app/quotes/actions";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/app/whatsapp-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { cn } from "@/lib/utils";
import { control } from "../form-fields";

/** Copy text, with a short "Copied" confirmation. */
export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1_500);
        } catch {
          window.prompt("Copy this link:", text);
        }
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy className="text-ink-2" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/**
 * Send a draft. Saves anything pending first, so the client gets exactly what's on screen, then freezes it
 * as a version and shows the client's link (emailing it too when that's set up).
 */
export function SendDialog({
  quoteId,
  quoteRef,
  title,
  clientName,
  clientEmail,
  clientPhone,
  emailEnabled,
  resend,
  disabled,
  settle,
}: {
  quoteId: string;
  quoteRef: string;
  title: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  emailEnabled: boolean;
  /** Sent before: this sends a new version. */
  resend: boolean;
  disabled: boolean;
  settle: () => Promise<number | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const canEmail = emailEnabled && clientEmail !== null;
  const [email, setEmail] = React.useState(canEmail);
  const [message, setMessage] = React.useState("");
  const [result, setResult] = React.useState<SendQuoteResult>();
  const [pending, startTransition] = React.useTransition();
  const sent = result?.ok ? result : undefined;

  const send = () =>
    startTransition(async () => {
      const version = await settle();
      if (version === null) return setResult({ ok: false, message: "Your latest changes haven't saved yet. Check your connection and try again." });
      setResult(await sendQuoteToClient({ quoteId, baseVersion: version, email: canEmail && email, message: message.trim() || undefined }));
    });

  const mailto =
    sent && clientEmail
      ? `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(`Your quote: ${title}`)}&body=${encodeURIComponent(`${message.trim() || `Hi ${clientName},\n\nHere's your quote for ${title}.`}\n\nView, ask questions and accept it here:\n${sent.link}\n`)}`
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Closing after a send shows the sent quote.
        if (!o && sent) router.refresh();
        if (!o) setResult(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button className="px-3.5" disabled={disabled}>
          <Send />
          {resend ? "Send update" : "Send quote"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[500px]">
        {sent ? (
          <>
            <DialogTitle className="flex items-center gap-2">
              <Check className="size-5 text-success" />
              {sent.versionNo > 1 ? `Version ${sent.versionNo} sent` : "Quote sent"}
            </DialogTitle>
            <DialogDescription>
              {sent.emailed
                ? `We've emailed ${clientName} a link to it. You'll see here when they open it.`
                : `Send ${clientName} this link. You'll see here when they open it.`}
            </DialogDescription>
            {sent.emailError && <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-[12.5px] text-warning">{sent.emailError}</p>}
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{sent.link}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={sent.link} />
              <WhatsAppButton phone={clientPhone} text={`Hi ${clientName.split(" ")[0]}, here's your ${sent.versionNo > 1 ? "updated quote" : "quote"} for ${title}. You can read it, ask questions and accept it here: ${sent.link}`} />
              {!sent.emailed && mailto && (
                <Button variant="secondary" asChild>
                  <a href={mailto}>
                    <Mail className="text-ink-2" />
                    Open in your email app
                  </a>
                </Button>
              )}
              <div className="flex-1" />
              <Button onClick={() => (setOpen(false), router.refresh())}>Done</Button>
            </div>
            <p className="mt-3 text-[12px] leading-normal text-subtle">
              It&apos;s {clientName}&apos;s private portal link: every quote you send them appears there. Opens only count when they view it, not when you preview it.
            </p>
          </>
        ) : (
          <>
            <DialogTitle>{resend ? "Send the updated quote" : "Send this quote"}</DialogTitle>
            <DialogDescription>
              {quoteRef} goes to {clientName}. They can read it, ask questions and accept it online. After sending, it&apos;s locked: to change it, revise it and send an update.
            </DialogDescription>
            <div className="mt-5 flex flex-col gap-3.5">
              {canEmail ? (
                <label className="flex items-center gap-2.5">
                  <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
                  Email the link to <span className="font-medium">{clientEmail}</span>
                </label>
              ) : (
                <p className="rounded-md bg-surface px-3 py-2 text-[12.5px] text-ink-2">
                  {clientEmail ? "Email isn't set up yet, so you'll get a link to send yourself." : `${clientName} has no email address, so you'll get a link to send yourself.`}
                </p>
              )}
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
                Message (optional)
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={TEXT.note}
                  rows={4}
                  placeholder={`Hi ${clientName.split(" ")[0]}, here's the quote we talked about. Any questions, just ask.`}
                  className={cn(control, "h-auto resize-y py-2 font-normal leading-normal")}
                />
              </label>
              {result && !result.ok && <p className="text-danger">{result.message}</p>}
              <Button onClick={send} disabled={pending} size="md">
                <Send />
                {pending ? "Sending…" : resend ? "Send update" : "Send quote"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
