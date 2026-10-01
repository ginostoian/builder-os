import { ChevronDown, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pipeline } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export function PipelineScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between border-b border-hairline px-6 pt-[18px] pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Pipeline</h1>
          <div className="mt-0.5 text-subtle">{pipeline.summary}</div>
        </div>
        <div className="flex gap-2">
          {pipeline.filters.map((f) => (
            <Button key={f} variant="secondary" className="bg-transparent text-ink-2">
              {f}
              <ChevronDown className="size-[13px] text-subtle" />
            </Button>
          ))}
          <Button>
            <Plus />
            Add enquiry
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-3 overflow-auto bg-surface-2 px-6 py-4">
        {pipeline.stages.map((col) => (
          <section key={col.name} aria-label={col.name} className="flex min-w-0 flex-col gap-2">
            <div className="border-b-2 px-1 pt-0.5 pb-1.5" style={{ borderColor: col.dot }}>
              <div className="flex justify-between">
                <span className="font-semibold">{col.name}</span>
                <span className="text-subtle">{col.deals.length}</span>
              </div>
              <div className="mt-0.5 text-xs text-subtle tabular">{col.total}</div>
            </div>
            {col.deals.map((d) => (
              <article key={d.name} className="flex flex-col gap-2 rounded-[10px] bg-white px-3 py-[11px] shadow-card-soft">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-semibold">{d.name}</span>
                  <span className="font-medium tabular">{d.value}</span>
                </div>
                <div className="text-xs text-ink-2">{d.job}</div>
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="rounded-[5px] bg-muted px-[7px] py-px text-ink-2">{d.source}</span>
                  <div className="flex-1" />
                  <span className={cn("flex items-center gap-1", d.late ? "text-danger" : "text-subtle")}>
                    <Clock className="size-[11px]" />
                    {d.next}
                  </span>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
