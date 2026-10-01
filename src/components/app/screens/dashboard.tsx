import { Calendar, ChevronDown } from "lucide-react";
import { dashboard } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { Panel } from "../app-shell";

const toneClass = { success: "text-success", subtle: "text-subtle", danger: "text-danger" } as const;
const CHART_HEIGHT = 160;

export function DashboardScreen() {
  const { chart } = dashboard;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] bg-surface-2 px-7 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{dashboard.greeting}</h1>
          <div className="mt-0.5 text-subtle">{dashboard.date}</div>
        </div>
        <button type="button" className="flex h-8 items-center gap-1.5 rounded-md bg-white px-3 shadow-ring">
          <Calendar className="size-3.5 text-subtle" />
          Last 12 months
          <ChevronDown className="size-[13px] text-subtle" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {dashboard.kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-white px-4 py-3.5 shadow-card">
            <div className="text-[12.5px] text-ink-2">{k.label}</div>
            <div className="mt-1.5 mb-1 text-2xl font-semibold tracking-[-0.02em] tabular">{k.value}</div>
            <div className={cn("text-xs", toneClass[k.tone])}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3">
        <Panel className="px-[18px] py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Invoiced vs collected</h2>
            <div className="flex gap-3.5 text-xs text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-ink" />
                Invoiced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-brand" />
                Collected
              </span>
            </div>
          </div>
          <div
            className="mt-4 flex h-[170px] items-end gap-2.5 border-b border-hairline px-1"
            role="img"
            aria-label="Monthly invoiced and collected totals for the last 12 months"
          >
            {chart.months.map((m, i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center gap-[3px]">
                <div
                  className="w-[9px] rounded-t-[3px] bg-ink"
                  style={{ height: Math.round((chart.invoiced[i] / chart.max) * CHART_HEIGHT) }}
                  title={`Invoiced £${chart.invoiced[i]}k`}
                />
                <div
                  className="w-[9px] rounded-t-[3px] bg-brand"
                  style={{ height: Math.round((chart.collected[i] / chart.max) * CHART_HEIGHT) }}
                  title={`Collected £${chart.collected[i]}k`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 px-1 pt-1.5">
            {chart.months.map((m, i) => (
              <div key={i} className="flex-1 text-center text-[11px] text-subtle">
                {m}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col px-[18px] py-4">
          <div className="flex justify-between">
            <h2 className="font-semibold">Upcoming stage payments</h2>
            <span className="text-xs text-subtle">View all</span>
          </div>
          <div className="mt-2 flex flex-col">
            {dashboard.upcoming.map((u) => (
              <div key={u.who} className="flex items-center gap-3 border-b border-line py-2.5">
                <div className="w-[34px] flex-none text-center">
                  <div className="text-[10.5px] tracking-[0.04em] text-subtle uppercase">{u.dow}</div>
                  <div className="text-[15px] font-semibold">{u.day}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{u.who}</div>
                  <div className="text-xs text-subtle">{u.stage}</div>
                </div>
                <div className="font-medium tabular">{u.amount}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_110px_80px] gap-3 border-b border-hairline bg-surface-2 px-[18px] py-2.5 text-xs text-subtle">
          <span>Active project</span>
          <span>Stage</span>
          <span>Progress</span>
          <span className="text-right">Contract</span>
          <span className="text-right">Margin</span>
        </div>
        {dashboard.projects.map((p) => (
          <div
            key={p.name}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_110px_80px] items-center gap-3 border-b border-line px-[18px] py-2.5"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-subtle">{p.address}</div>
            </div>
            <div className="text-ink-2">{p.stage}</div>
            <div className="flex items-center gap-2.5">
              <div className="h-[5px] flex-1 rounded-[5px] bg-line">
                <div className="h-[5px] rounded-[5px] bg-ink" style={{ width: `${p.progress}%` }} />
              </div>
              <span className="w-8 text-xs text-ink-2 tabular">{p.progress}%</span>
            </div>
            <div className="text-right font-medium tabular">{p.value}</div>
            <div className="text-right text-success tabular">{p.margin}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
