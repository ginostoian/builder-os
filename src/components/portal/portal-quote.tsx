"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock, MessageSquare, PenLine, Printer, ShieldCheck, X } from "lucide-react";
import { decideQuote, markViewed, postComment } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { formatGBP } from "@/core/money";
import { cn } from "@/lib/utils";
import { longDate, type QuoteSnapshot } from "@/core/quote-snapshot";
import { CompanyMark, QuoteDocument } from "./quote-document";

export type PortalComment = { id: string; lineId: string | null; authorKind: string; authorName: string; body: string; createdAt: Date };
export type PortalDecision = { decision: string; fullName: string; signature: string | null; reason: string | null; createdAt: Date; contentHash: string } | null;

const input =
  "h-10 w-full rounded-lg bg-white px-3 text-[14px] shadow-ring-input outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]";
const NAME_KEY = "builderos.portal.name";

/**
 * The client's quote page. `token` null means the team's preview: same page, but nothing is recorded and
 * the buttons are inert.
 */
export function PortalQuote({
  token,
  snapshot,
  version,
  decision,
  comments,
  revising,
  expired,
}: {
  token: string | null;
  snapshot: QuoteSnapshot;
  version: { versionNo: number; sentAt: Date; contentHash: string };
  decision: PortalDecision;
  comments: PortalComment[];
  revising: boolean;
  expired: boolean;
}) {
  const router = useRouter();
  const preview = token === null;
  const number = snapshot.quote.number;
  const [dialog, setDialog] = React.useState<"accept" | "decline" | null>(null);
  const [aboutLine, setAboutLine] = React.useState<{ id: string; name: string } | null>(null);
  const commentBox = React.useRef<HTMLTextAreaElement>(null);
  const company = snapshot.company.tradingName ?? snapshot.company.name;
  const open = !decision && !revising && !expired;

  // Count an open once the page has actually been on screen for a moment (not a prefetch or a scanner).
  React.useEffect(() => {
    if (preview) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (document.visibilityState !== "visible" || timer) return;
      timer = setTimeout(() => void markViewed(token, number).catch(() => {}), 1_500);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      document.removeEventListener("visibilitychange", arm);
      clearTimeout(timer);
    };
  }, [preview, token, number]);

  const counts = new Map<string, number>();
  for (const c of comments) if (c.lineId) counts.set(c.lineId, (counts.get(c.lineId) ?? 0) + 1);
  const lineNames = new Map(snapshot.sections.flatMap((s) => s.lines.map((l) => [l.id, l.name] as const)));

  return (
    <div className="min-h-screen bg-muted font-sans text-[13.5px] leading-[1.45] text-ink antialiased print:bg-white">
      <header className="flex h-[60px] items-center gap-3 border-b border-hairline bg-white px-4 sm:px-10 print:border-0">
        {!preview && (
          <Link href={`/portal/${token}`} aria-label="All your quotes" className="flex size-8 items-center justify-center rounded-md text-subtle hover:bg-accent print:hidden">
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <CompanyMark company={snapshot.company} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{company}</div>
          <div className="text-xs text-subtle">Quote {snapshot.quote.ref}</div>
        </div>
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => window.print()} className="h-9 print:hidden">
          <Printer className="text-ink-2" />
          <span className="hidden sm:inline">Print or save PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </header>

      {preview && (
        <div className="bg-ink px-4 py-2 text-center text-[12.5px] text-white print:hidden">
          Preview: this is what {snapshot.client.name} sees. Nothing you do here is recorded, and opening it doesn&apos;t count as a view.
        </div>
      )}

      <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:px-10 lg:py-8">
        <div className="min-w-0 flex-1">
          <QuoteDocument
            snapshot={snapshot}
            sentAt={version.sentAt}
            commentCounts={counts}
            onCommentLine={
              preview
                ? undefined
                : (l) => {
                    setAboutLine(l);
                    commentBox.current?.focus();
                    commentBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
            }
          />
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:sticky lg:top-6 lg:w-[340px] print:hidden">
          <section className="rounded-[14px] bg-white px-[22px] py-5 shadow-[0_0_0_1px_#E8E7E3,0_12px_32px_-16px_rgb(16_16_15/0.16)]">
            <div className="text-[12.5px] text-subtle">Total inc. VAT</div>
            <div className="mt-0.5 mb-1 text-[32px] font-semibold tracking-[-0.03em] tabular">{formatGBP(snapshot.totals.total)}</div>
            <div className="text-xs text-subtle tabular">
              {formatGBP(snapshot.totals.net)} + {formatGBP(snapshot.totals.vat)} VAT
            </div>
            <DecisionArea
              decision={decision}
              revising={revising}
              expired={expired}
              open={open}
              preview={preview}
              company={company}
              onAccept={() => setDialog("accept")}
              onDecline={() => setDialog("decline")}
            />
          </section>

          <Conversation
            comments={comments}
            lineNames={lineNames}
            company={company}
            disabled={preview}
            aboutLine={aboutLine}
            clearLine={() => setAboutLine(null)}
            textarea={commentBox}
            onSend={async (name, body) => {
              const r = await postComment(token!, number, { name, body, lineId: aboutLine?.id });
              if (r.ok) {
                setAboutLine(null);
                router.refresh();
              }
              return r;
            }}
          />

          <div className="flex items-center gap-1.5 px-1 text-xs text-subtle">
            <ShieldCheck className="size-[13px] flex-none" />
            Private link from {company}. Powered by Builder OS.
          </div>
        </aside>
      </main>

      {/* Phones: the decision card is below the whole quote, so keep the total and Accept in reach. */}
      {open && (
        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-hairline bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgb(16_16_15/0.25)] lg:hidden print:hidden">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] text-subtle">Total inc. VAT</div>
            <div className="text-[17px] font-semibold tabular">{formatGBP(snapshot.totals.total)}</div>
          </div>
          <Button className="h-11 rounded-[9px] px-5" onClick={() => setDialog("accept")} disabled={preview}>
            <PenLine className="size-[15px]" />
            Accept &amp; sign
          </Button>
        </div>
      )}

      {!preview && open && (
        <>
          <AcceptDialog
            open={dialog === "accept"}
            onOpenChange={(o) => setDialog(o ? "accept" : null)}
            description={
              <>
                You&apos;re accepting {snapshot.quote.ref}, {snapshot.quote.title}, from {company} for {formatGBP(snapshot.totals.total)} inc. VAT. We record your name, signature, the time and the
                exact version you sign.
              </>
            }
            onSubmit={async (fullName, signature) => {
              const r = await decideQuote(token, number, { decision: "accepted", fullName, signature, agree: true });
              if (r.ok) router.refresh();
              return r;
            }}
          />
          <DeclineDialog
            open={dialog === "decline"}
            onOpenChange={(o) => setDialog(o ? "decline" : null)}
            company={company}
            onSubmit={async (fullName, reason) => {
              const r = await decideQuote(token, number, { decision: "declined", fullName, reason: reason || undefined });
              if (r.ok) router.refresh();
              return r;
            }}
          />
        </>
      )}
    </div>
  );
}

function DecisionArea({
  decision,
  revising,
  expired,
  open,
  preview,
  company,
  onAccept,
  onDecline,
}: {
  decision: PortalDecision;
  revising: boolean;
  expired: boolean;
  open: boolean;
  preview: boolean;
  company: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (decision?.decision === "accepted") {
    return (
      <div className="mt-4 rounded-[10px] bg-success-soft px-3.5 py-3 text-success">
        <div className="flex items-center gap-2 font-medium">
          <Check className="size-4" />
          Accepted on {longDate(decision.createdAt)}
        </div>
        <div className="mt-1.5 text-[12.5px] text-ink-2">
          Signed by <span className="font-signature text-[17px] text-ink">{decision.signature}</span> ({decision.fullName})
        </div>
        <div className="mt-1 font-mono text-[10.5px] break-all text-subtle">Ref {decision.contentHash.slice(0, 16)}</div>
      </div>
    );
  }
  if (decision?.decision === "declined") {
    return <div className="mt-4 rounded-[10px] bg-surface px-3.5 py-3 text-ink-2">You declined this quote on {longDate(decision.createdAt)}. Changed your mind? Leave a comment for {company}.</div>;
  }
  if (revising) {
    return (
      <div className="mt-4 flex gap-2 rounded-[10px] bg-surface px-3.5 py-3 text-ink-2">
        <Clock className="mt-0.5 size-4 flex-none" />
        {company} is updating this quote. You&apos;ll be able to accept the new version when it arrives.
      </div>
    );
  }
  if (expired) return <div className="mt-4 rounded-[10px] bg-surface px-3.5 py-3 text-ink-2">This quote has expired. Leave a comment to ask {company} for an updated one.</div>;
  return (
    <>
      <Button className="mt-4 h-11 w-full gap-2 rounded-[9px]" onClick={onAccept} disabled={preview || !open}>
        <PenLine className="size-[15px]" />
        Accept &amp; sign
      </Button>
      <Button variant="ghost" className="mt-1.5 h-9 w-full rounded-[9px]" onClick={onDecline} disabled={preview || !open}>
        Decline
      </Button>
    </>
  );
}

function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function Conversation({
  comments,
  lineNames,
  company,
  disabled,
  aboutLine,
  clearLine,
  textarea,
  onSend,
}: {
  comments: PortalComment[];
  lineNames: Map<string, string>;
  company: string;
  disabled: boolean;
  aboutLine: { id: string; name: string } | null;
  clearLine: () => void;
  textarea: React.RefObject<HTMLTextAreaElement | null>;
  onSend: (name: string, body: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  return (
    <section className="rounded-[14px] bg-white px-[22px] py-[18px] shadow-ring">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <MessageSquare className="size-4 text-subtle" />
        Questions and comments
      </h2>
      <p className="mb-3 text-[12.5px] text-subtle">Ask {company} anything about this quote. They&apos;ll reply here.</p>
      {comments.length > 0 && (
        <ol className="mb-3 flex flex-col gap-2.5">
          {comments.map((c) => (
            <li key={c.id} className={cn("rounded-[10px] px-3 py-2.5", c.authorKind === "staff" ? "bg-surface" : "bg-brand-tint")}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-medium">{c.authorKind === "staff" ? `${c.authorName}, ${company}` : c.authorName}</span>
                <span className="flex-none text-subtle">{longDate(c.createdAt)}</span>
              </div>
              {c.lineId && lineNames.has(c.lineId) && <div className="mt-0.5 text-[11.5px] text-subtle">About: {lineNames.get(c.lineId)}</div>}
              <p className="mt-1 whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled) return;
          startTransition(async () => {
            const r = await onSend(name.trim(), body.trim());
            if (r.ok) {
              setBody("");
              setError(undefined);
              try {
                localStorage.setItem(NAME_KEY, name.trim());
              } catch {
                /* private mode: fine */
              }
            } else setError(r.message);
          });
        }}
      >
        {aboutLine && (
          <div className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate">About: {aboutLine.name}</span>
            <button type="button" aria-label="Not about this line" onClick={clearLine} className="text-subtle hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <textarea
          ref={textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={TEXT.note}
          rows={3}
          disabled={disabled || pending}
          placeholder="Could we use oak flooring instead?"
          aria-label="Your comment"
          className={cn(input, "h-auto resize-y py-2 leading-normal")}
        />
        <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => !name && setName(rememberedName())} maxLength={TEXT.name} disabled={disabled || pending} placeholder="Your name" aria-label="Your name" autoComplete="name" className={input} />
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        <Button type="submit" variant="secondary" className="h-10" disabled={disabled || pending || !body.trim() || !name.trim()}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </section>
  );
}

/** Name + typed signature + explicit agreement. Shared by quotes and variations. */
export function AcceptDialog({
  open,
  onOpenChange,
  title = "Accept and sign",
  description,
  agreement = "I accept this quote and its terms. I understand that typing my name above is my electronic signature.",
  submitLabel = "Sign and accept",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description: React.ReactNode;
  agreement?: string;
  submitLabel?: string;
  onSubmit: (fullName: string, signature: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [fullName, setFullName] = React.useState("");
  const [signature, setSignature] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          className="mt-5 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await onSubmit(fullName.trim(), signature.trim());
              if (r.ok) onOpenChange(false);
              else setError(r.message);
            });
          }}
        >
          <label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
            Your full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} onBlur={() => !signature && setSignature(fullName.trim())} maxLength={TEXT.name} autoComplete="name" required autoFocus className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
            Signature (type your name)
            <input value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={TEXT.name} required className={cn(input, "h-12 font-signature text-[22px]")} />
          </label>
          <label className="flex items-start gap-2.5 text-[12.5px] leading-normal text-ink-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            {agreement}
          </label>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <Button type="submit" size="md" className="w-full" disabled={pending || !agree || !fullName.trim() || !signature.trim()}>
            <PenLine />
            {pending ? "Signing…" : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeclineDialog({
  open,
  onOpenChange,
  company,
  title = "Decline this quote",
  submitLabel = "Decline quote",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  company: string;
  title?: string;
  submitLabel?: string;
  onSubmit: (fullName: string, reason: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [fullName, setFullName] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{company} will be told. A reason helps them, but it&apos;s optional.</DialogDescription>
        <form
          className="mt-5 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await onSubmit(fullName.trim(), reason.trim());
              if (r.ok) onOpenChange(false);
              else setError(r.message);
            });
          }}
        >
          <label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
            Your name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={TEXT.name} autoComplete="name" required autoFocus className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-medium">
            Reason (optional)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={TEXT.note} rows={3} className={cn(input, "h-auto resize-y py-2")} />
          </label>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <Button type="submit" variant="secondary" size="md" className="w-full" disabled={pending || !fullName.trim()}>
            {pending ? "Sending…" : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
