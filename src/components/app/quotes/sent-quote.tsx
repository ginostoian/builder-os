"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, FilePen, MessageSquare, Send, ThumbsDown, User, X } from "lucide-react";
import { replyToClient, reviseSentQuote } from "@/app/app/quotes/actions";
import { QuoteDocument } from "@/components/portal/quote-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { formatGBP } from "@/core/money";
import { longDate, type QuoteSnapshot } from "@/core/quote-snapshot";
import { cn } from "@/lib/utils";
import { control } from "../form-fields";
import { DuplicateButton } from "./duplicate-button";
import { PaymentSchedule, type BillableRecharge, type BillableVariation, type ScheduleRow } from "./payment-schedule";
import { VariationsPanel, type VariationRow } from "@/components/app/variations/variations-panel";
import { StartProject } from "@/components/app/projects/start-project";
import { CopyButton } from "./send-dialog";
import { QUOTE_STATUS } from "./status";

type Event = { id: string; kind: string; actor: string; createdAt: Date; memberName: string | null; versionId: string | null };
type Comment = { id: string; lineId: string | null; authorKind: string; authorName: string; body: string; createdAt: Date };
type Decision = { versionId: string; decision: string; fullName: string; signature: string | null; reason: string | null; ip: string | null; userAgent: string | null; contentHash: string; createdAt: Date };

const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

const EVENT_TEXT: Record<string, (e: Event, client: string) => string> = {
  sent: (e) => `${e.memberName ?? "Your team"} sent it`,
  viewed: (_, c) => `${c} opened it`,
  commented: (_, c) => `${c} commented`,
  replied: (e) => `${e.memberName ?? "Your team"} replied`,
  accepted: (_, c) => `${c} accepted and signed`,
  declined: (_, c) => `${c} declined`,
  revised: (e) => `${e.memberName ?? "Your team"} reopened it for changes`,
};

/** A sent quote from the team's side: what the client sees, plus opens, the conversation and the decision. */
export function SentQuote({
  quoteId,
  status,
  clientName,
  clientId,
  snapshot,
  version,
  link,
  events,
  comments,
  decision,
  viewCount,
  lastViewedAt,
  versionCount,
  schedule,
  canInvoice,
  bankReady,
  emailEnabled,
  clientEmail,
  variations,
  billable,
  recharges = [],
  canEdit,
  project,
}: {
  quoteId: string;
  status: string;
  clientName: string;
  clientId: string;
  snapshot: QuoteSnapshot;
  version: { versionNo: number; sentAt: Date; contentHash: string };
  link: string | null;
  events: Event[];
  comments: Comment[];
  decision: Decision | null;
  viewCount: number;
  lastViewedAt: Date | null;
  versionCount: number;
  schedule: ScheduleRow[] | null;
  canInvoice: boolean;
  bankReady: boolean;
  emailEnabled: boolean;
  clientEmail: string | null;
  variations: VariationRow[] | null;
  billable: BillableVariation[];
  recharges?: BillableRecharge[];
  canEdit: boolean;
  /** For accepted quotes: the project, if started, and whether this person can start one. */
  project?: { id: string | null; canStart: boolean };
}) {
  const router = useRouter();
  const [revising, startRevise] = React.useTransition();
  const [reviseError, setReviseError] = React.useState<string>();
  const s = QUOTE_STATUS[status] ?? QUOTE_STATUS.sent;
  const counts = new Map<string, number>();
  for (const c of comments) if (c.lineId) counts.set(c.lineId, (counts.get(c.lineId) ?? 0) + 1);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-surface-2">
        <div className="flex items-start gap-4 border-b border-hairline bg-white px-6 pt-[18px] pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[12px] text-subtle">{snapshot.quote.ref}</span>
              <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{snapshot.quote.title}</h1>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-subtle">
              <Link href={`/app/clients/${clientId}`} className="flex items-center gap-[5px] hover:text-ink">
                <User className="size-[13px]" />
                {clientName}
              </Link>
              <span className="flex items-center gap-[5px]">
                <Send className="size-[13px]" />
                Version {version.versionNo} sent {time(version.sentAt)}
              </span>
              <span className="flex items-center gap-[5px]">
                <Eye className="size-[13px]" />
                {viewCount === 0 ? "Not opened yet" : `Opened ${viewCount}× · last ${time(lastViewedAt!)}`}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {link && <CopyButton text={link} label="Copy client link" />}
            {status === "accepted" && project && (project.id || project.canStart) && (
              <StartProject quoteId={quoteId} projectId={project.id} sections={snapshot.sections.length} lines={snapshot.sections.reduce((a, s) => a + s.lines.length, 0)} />
            )}
            <DuplicateButton quoteId={quoteId} />
            <Button variant="secondary" asChild>
              <Link href={`/app/quotes/${quoteId}/preview`} target="_blank">
                <Eye className="text-ink-2" />
                Preview as client
              </Link>
            </Button>
            {status !== "accepted" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <FilePen className="text-ink-2" />
                    Revise
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Revise this quote?</DialogTitle>
                  <DialogDescription>
                    It reopens for changes. {clientName} keeps seeing version {version.versionNo} (and can&apos;t accept it) until you send the update as version {versionCount + 1}.
                  </DialogDescription>
                  {reviseError && <p className="mt-3 text-danger">{reviseError}</p>}
                  <div className="mt-5 flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button
                      disabled={revising}
                      onClick={() =>
                        startRevise(async () => {
                          const r = await reviseSentQuote(quoteId);
                          if (r.ok) router.refresh();
                          else setReviseError(r.message);
                        })
                      }
                    >
                      {revising ? "Reopening…" : "Revise quote"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[820px] px-4 py-5 lg:px-6">
          <p className="mb-3 text-[12.5px] text-subtle">This is exactly what {clientName} sees. Costs and markups aren&apos;t shown to clients.</p>
          <QuoteDocument snapshot={snapshot} sentAt={version.sentAt} commentCounts={counts} />
        </div>
      </div>

      <aside className="flex w-[340px] flex-none flex-col gap-4 overflow-auto border-l border-hairline bg-white p-[18px]">
        <div>
          <div className="text-[12.5px] text-subtle">Total inc. VAT</div>
          <div className="text-[24px] font-semibold tracking-[-0.02em] tabular">{formatGBP(snapshot.totals.total)}</div>
        </div>
        {decision && <DecisionCard decision={decision} />}
        {schedule && schedule.length > 0 && (
          <PaymentSchedule quoteId={quoteId} rows={schedule} billable={billable} recharges={recharges} canInvoice={canInvoice} bankReady={bankReady} emailEnabled={emailEnabled} clientName={clientName} clientEmail={clientEmail} />
        )}
        {variations && <VariationsPanel quoteId={quoteId} rows={variations} canEdit={canEdit} />}
        <Conversation quoteId={quoteId} comments={comments} clientName={clientName} snapshot={snapshot} />
        <div>
          <div className="mb-2 text-xs font-medium text-subtle">Activity</div>
          <ol className="flex flex-col gap-2">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="flex gap-2.5 text-[12.5px]">
                <span className={cn("mt-1.5 size-2 flex-none rounded-full", e.actor === "client" ? "bg-brand" : "bg-faint")} />
                <span className="flex-1 text-ink-2">{(EVENT_TEXT[e.kind] ?? (() => e.kind))(e, clientName)}</span>
                <span className="flex-none text-subtle">{time(e.createdAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  if (decision.decision === "declined") {
    return (
      <div className="rounded-[10px] bg-surface px-3.5 py-3">
        <div className="flex items-center gap-2 font-medium text-ink-2">
          <ThumbsDown className="size-4" />
          Declined by {decision.fullName}
        </div>
        <div className="mt-0.5 text-[12px] text-subtle">{time(decision.createdAt)}</div>
        {decision.reason && <p className="mt-2 whitespace-pre-line text-ink-2">&ldquo;{decision.reason}&rdquo;</p>}
      </div>
    );
  }
  return (
    <div className="rounded-[10px] bg-success-soft px-3.5 py-3">
      <div className="flex items-center gap-2 font-medium text-success">
        <Check className="size-4" />
        Accepted {longDate(decision.createdAt)}
      </div>
      <div className="mt-2 font-signature text-[22px] leading-tight">{decision.signature}</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
        <dt className="text-subtle">Name</dt>
        <dd>{decision.fullName}</dd>
        <dt className="text-subtle">Time</dt>
        <dd>{time(decision.createdAt)}</dd>
        {decision.ip && (
          <>
            <dt className="text-subtle">IP</dt>
            <dd className="font-mono">{decision.ip}</dd>
          </>
        )}
        <dt className="text-subtle">Version</dt>
        <dd className="font-mono break-all">{decision.contentHash.slice(0, 16)}</dd>
      </dl>
    </div>
  );
}

function Conversation({ quoteId, comments, clientName, snapshot }: { quoteId: string; comments: Comment[]; clientName: string; snapshot: QuoteSnapshot }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const lineNames = new Map(snapshot.sections.flatMap((s) => s.lines.map((l) => [l.id, l.name] as const)));
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-subtle">
        <MessageSquare className="size-3.5" />
        Conversation with {clientName}
      </div>
      {comments.length === 0 ? (
        <p className="mb-2 text-[12.5px] text-subtle">No comments yet. When {clientName} asks a question on the quote, it shows here.</p>
      ) : (
        <ol className="mb-2.5 flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className={cn("rounded-[10px] px-3 py-2", c.authorKind === "staff" ? "ml-6 bg-surface" : "mr-6 bg-brand-tint")}>
              <div className="flex justify-between gap-2 text-[11.5px]">
                <span className="font-medium">{c.authorName}</span>
                <span className="text-subtle">{time(c.createdAt)}</span>
              </div>
              {c.lineId && lineNames.has(c.lineId) && <div className="text-[11px] text-subtle">About: {lineNames.get(c.lineId)}</div>}
              <p className="mt-0.5 text-[12.5px] whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await replyToClient({ quoteId, body: body.trim() });
            if (r.ok) {
              setBody("");
              setError(undefined);
              router.refresh();
            } else setError(r.message);
          });
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={TEXT.note}
          rows={3}
          placeholder={`Reply to ${clientName}. They'll see it on the quote.`}
          aria-label="Reply"
          className={cn(control, "h-auto resize-y py-2 leading-normal")}
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          {body && (
            <Button type="button" variant="ghost" onClick={() => setBody("")}>
              <X />
              Clear
            </Button>
          )}
          <Button type="submit" variant="secondary" disabled={pending || !body.trim()}>
            {pending ? "Sending…" : "Reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
