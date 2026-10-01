"use client";

import * as React from "react";
import { Calendar, Camera, ListChecks, Plus } from "lucide-react";
import { Avatar, Placeholder } from "@/components/brand";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { avatarTints, boardColumns, project, type BoardColumn, type Tone } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { TabStrip } from "../tab-strip";

const toneToBadge: Record<Tone, BadgeTone> = { grey: "grey", green: "green", amber: "amber", blue: "blue", brand: "brand", red: "red" };

export function ProjectBoardScreen() {
  const [columns, setColumns] = React.useState<BoardColumn[]>(boardColumns);
  const [tab, setTab] = React.useState("Board");
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  function moveCard(cardId: string, toColumn: string) {
    setColumns((prev) => {
      const card = prev.flatMap((c) => c.cards).find((c) => c.id === cardId);
      if (!card) return prev;
      return prev.map((col) => {
        const without = col.cards.filter((c) => c.id !== cardId);
        return col.id === toColumn ? { ...col, cards: [...without, card] } : { ...col, cards: without };
      });
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-4 px-6 pt-[18px]">
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{project.title}</h1>
            <Badge tone="green">{project.status}</Badge>
          </div>
          <div className="mt-1 text-subtle">{project.meta}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex pl-1.5">
            {project.crew.map((i) => (
              <Avatar key={i} initials={i} tint={avatarTints[i]} size={28} className="-ml-1.5 text-[10.5px] text-ink-3 shadow-[0_0_0_2px_#fff]" />
            ))}
          </div>
          <Button variant="secondary">
            <Camera className="text-ink-2" />
            Post update
          </Button>
        </div>
      </div>
      <TabStrip tabs={project.tabs} active={tab} onSelect={setTab} className="border-b border-hairline px-6 pt-3" />

      {tab === "Board" ? (
        <div className="grid min-h-0 flex-1 grid-cols-5 gap-3 overflow-auto bg-surface-2 px-6 py-4">
          {columns.map((col) => (
            <section
              key={col.id}
              aria-label={col.name}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.id);
              }}
              onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveCard(id, col.id);
                setOver(null);
                setDragging(null);
              }}
              className={cn("flex min-w-0 flex-col gap-2 rounded-xl transition-colors duration-[120ms]", over === col.id && dragging && "bg-line/60")}
            >
              <div className="flex items-center gap-2 px-1 pt-0.5 pb-1">
                <span className="size-2 rounded-full" style={{ background: col.dot }} />
                <span className="font-semibold">{col.name}</span>
                <span className="text-subtle">{col.cards.length}</span>
                <div className="flex-1" />
                <Plus className="size-3.5 text-subtle" aria-label={`Add task to ${col.name}`} />
              </div>
              {col.cards.map((k) => (
                <article
                  key={k.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", k.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(k.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={cn(
                    "flex cursor-grab flex-col gap-[9px] rounded-[10px] bg-white px-3 py-[11px] active:cursor-grabbing",
                    k.highlight ? "shadow-[0_0_0_1.5px_var(--color-brand)]" : "shadow-card-soft",
                    dragging === k.id && "opacity-50",
                  )}
                >
                  {k.photo && <Placeholder label="site photo" variant="xs" className="h-[74px] rounded-[7px] text-[10.5px]" />}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge shape="tag" tone={toneToBadge[k.tone]}>
                      {k.tag}
                    </Badge>
                  </div>
                  <div className="leading-[1.35] font-medium">{k.title}</div>
                  <div className="flex items-center gap-2.5 text-[11.5px] text-subtle">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {k.due}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="size-3" />
                      {k.subtasks}
                    </span>
                    <div className="flex-1" />
                    <Avatar initials={k.who} tint={avatarTints[k.who]} size={22} className="text-[9.5px] text-ink-3" />
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface-2 text-center">
          <div className="text-ink-2">{tab} for 14 Elm Road will show here.</div>
          <Button variant="secondary" onClick={() => setTab("Board")}>
            Back to the board
          </Button>
        </div>
      )}
    </div>
  );
}
