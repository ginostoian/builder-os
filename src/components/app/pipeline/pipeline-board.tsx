"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Globe, Phone } from "lucide-react";
import { setStageAction } from "@/app/app/pipeline/actions";
import { formatGBP } from "@/core/money";
import { LEAD_SOURCE_LABEL, LEAD_STAGE_LABEL, LOST_REASON_LABEL, OPEN_STAGES, STAGE_HINT, followUpState, shortWhen, type LeadStage } from "@/core/pipeline";
import { cn } from "@/lib/utils";
import { shortDay } from "../projects/types";
import { StageDialog } from "./stage-dialog";
import { STAGE_DOT, ago, type LeadCard } from "./types";

type Dialog = { lead: LeadCard; target: "lost" | "site_visit" } | null;

/**
 * Every open lead by stage. Drag a card to move it; drop it on Won or Lost to close it. Each card shows
 * what's next and when, in red when it's overdue.
 */
export function PipelineBoard({ leads, today, canEdit }: { leads: LeadCard[]; today: string; canEdit: boolean }) {
  const router = useRouter();
  const [optimistic, move] = React.useOptimistic(leads, (state, m: { id: string; stage: LeadStage }) => state.map((l) => (l.id === m.id ? { ...l, stage: m.stage } : l)));
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<LeadStage | null>(null);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [error, setError] = React.useState<string>();
  const [, startTransition] = React.useTransition();

  const drop = (stage: LeadStage) => {
    const lead = optimistic.find((l) => l.id === dragging);
    setDragging(null);
    setOver(null);
    if (!lead || lead.stage === stage) return;
    if (stage === "lost" || stage === "site_visit") return setDialog({ lead, target: stage });
    startTransition(async () => {
      move({ id: lead.id, stage });
      const r = await setStageAction(lead.id, { stage });
      if (!r.ok) setError(r.message);
      router.refresh();
    });
  };

  const column = (stage: LeadStage, closed = false) => {
    const items = optimistic.filter((l) => l.stage === stage);
    const value = items.reduce((s, l) => s + (l.valuePence ?? 0), 0);
    return (
      <div
        key={stage}
        onDragOver={(e) => {
          if (!canEdit || !dragging) return;
          e.preventDefault();
          setOver(stage);
        }}
        onDragLeave={() => setOver((o) => (o === stage ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          drop(stage);
        }}
        className={cn("flex min-h-0 flex-col rounded-[12px] bg-surface p-2 transition-shadow", closed ? "min-h-0 flex-1" : "min-w-[170px] flex-1", over === stage && "shadow-[0_0_0_2px_var(--color-ink)]")}
      >
        <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
          <span className={cn("size-2 rounded-full", STAGE_DOT[stage])} />
          <span className="flex-1 font-semibold">{LEAD_STAGE_LABEL[stage]}</span>
          <span className="text-[12px] text-subtle tabular">{items.length}</span>
        </div>
        {!closed && <div className="px-1.5 pb-2 text-[11.5px] text-subtle">{value > 0 ? `${formatGBP(value, 0)} · ` : ""}{STAGE_HINT[stage]}</div>}
        {closed && <div className="px-1.5 pb-2 text-[11.5px] text-subtle">Last 30 days{canEdit ? ". Drop a card here." : ""}</div>}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {items.map((l) => (
            <Card key={l.id} lead={l} today={today} closed={closed} canEdit={canEdit} onDrag={setDragging} dragging={dragging === l.id} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && <p className="px-6 pb-2 text-danger">{error}</p>}
      <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto px-6 pb-4">
        {OPEN_STAGES.map((s) => column(s))}
        <div className="flex w-[190px] flex-none flex-col gap-2.5">
          {column("won", true)}
          {column("lost", true)}
        </div>
      </div>
      {dialog && <StageDialog leadId={dialog.lead.id} name={dialog.lead.name} target={dialog.target} visitAt={dialog.lead.visitAt} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Card({ lead: l, today, closed, canEdit, onDrag, dragging }: { lead: LeadCard; today: string; closed: boolean; canEdit: boolean; onDrag: (id: string | null) => void; dragging: boolean }) {
  const due = followUpState(l.nextActionOn, today);
  return (
    <Link
      href={`/app/pipeline/${l.id}`}
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDrag(l.id);
      }}
      onDragEnd={() => onDrag(null)}
      className={cn("flex flex-col gap-1 rounded-[10px] bg-white p-2.5 shadow-ring hover:shadow-[0_0_0_1px_var(--color-faint),0_2px_6px_rgb(16_16_15/0.06)]", dragging && "opacity-50")}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{l.name}</span>
          <span className="block truncate text-[12px] text-subtle">{[l.projectType, l.postcode].filter(Boolean).join(" · ") || LEAD_SOURCE_LABEL[l.source]}</span>
        </span>
        {l.valuePence ? <span className="text-[12px] font-medium tabular">{formatGBP(l.valuePence, 0)}</span> : null}
      </div>
      {closed ? (
        <span className="text-[11.5px] text-subtle">{l.stage === "lost" && l.lostReason ? LOST_REASON_LABEL[l.lostReason] : ago(l.stageChangedAt)}</span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
          {l.stage === "site_visit" && l.visitAt && (
            <span className="flex items-center gap-1 text-info">
              <CalendarClock className="size-3" />
              {shortWhen(new Date(l.visitAt))}
            </span>
          )}
          {due !== "none" && (
            <span className={cn("flex items-center gap-1", due === "overdue" ? "font-medium text-danger" : due === "today" ? "font-medium text-warning" : "text-subtle")}>
              <Phone className="size-3" />
              {l.nextAction ?? "Follow up"} {due === "today" ? "today" : due === "overdue" ? `since ${shortDay(l.nextActionOn!)}` : shortDay(l.nextActionOn!)}
            </span>
          )}
          {l.viaWebForm && l.stage === "new" && (
            <span className="flex items-center gap-1 text-subtle">
              <Globe className="size-3" />
              {ago(l.createdAt)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
