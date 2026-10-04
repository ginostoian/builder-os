import { cn } from "@/lib/utils";

/**
 * Small SVG charts for the platform dashboard. Server-rendered, no library: bars with an optional line on
 * top, and a stacked share bar. Hovering a bar shows its value (native tooltip).
 */

export type BarPoint = { label: string; value: number; line?: number; title?: string };

export function BarChart({
  points,
  height = 200,
  format = (v: number) => String(v),
  lineLabel,
  barLabel,
  tickEvery = 1,
  width = 1100,
}: {
  points: BarPoint[];
  height?: number;
  format?: (v: number) => string;
  lineLabel?: string;
  barLabel?: string;
  /** Show every nth label under the bars. */
  tickEvery?: number;
  /** viewBox width: about the panel's width in pixels, so labels render near their set size. */
  width?: number;
}) {
  const pad = { top: 12, right: 8, bottom: 22, left: 8 };
  const max = Math.max(1, ...points.map((p) => Math.max(p.value, p.line ?? 0)));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = innerW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(44, step * 0.62));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const x = (i: number) => pad.left + step * i + step / 2;
  const hasLine = points.some((p) => p.line !== undefined);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.line ?? 0).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={barLabel}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.left} x2={width - pad.right} y1={y(max * f)} y2={y(max * f)} stroke="#EFEEEA" strokeWidth={1} />
        ))}
        <text x={width - pad.right} y={y(max) - 3} textAnchor="end" className="fill-[#8A8A85] text-[12px]">
          {format(max)}
        </text>
        {points.map((p, i) => (
          <g key={p.label + i}>
            <rect x={x(i) - barW / 2} y={y(p.value)} width={barW} height={Math.max(0, pad.top + innerH - y(p.value))} rx={2} className="fill-brand/75 hover:fill-brand">
              <title>{p.title ?? `${p.label}: ${format(p.value)}${p.line !== undefined && lineLabel ? ` · ${lineLabel} ${format(p.line)}` : ""}`}</title>
            </rect>
            {i % tickEvery === 0 && (
              <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-[#8A8A85] text-[12px]">
                {p.label}
              </text>
            )}
          </g>
        ))}
        {hasLine && <path d={line} fill="none" stroke="#10100F" strokeWidth={1.5} strokeLinejoin="round" />}
      </svg>
      {(barLabel || lineLabel) && (
        <div className="mt-1.5 flex gap-4 text-[11.5px] text-subtle">
          {barLabel && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-brand/75" />
              {barLabel}
            </span>
          )}
          {hasLine && lineLabel && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-ink" />
              {lineLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export type Share = { label: string; value: number; className: string };

/** One bar split by share, with a legend of counts. */
export function ShareBar({ parts }: { parts: Share[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
        {total > 0 && parts.map((p) => p.value > 0 && <div key={p.label} className={cn("h-full", p.className)} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2">
            <span className={cn("size-2 flex-none rounded-sm", p.className)} />
            <span className="text-ink-2">{p.label}</span>
            <span className="ml-auto font-medium tabular">
              {p.value}
              <span className="ml-1 font-normal text-subtle">{total > 0 ? `${Math.round((p.value / total) * 100)}%` : ""}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A headline number with a label and a quiet note under it. */
export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-white p-3.5 shadow-ring">
      <div className="text-[12px] text-subtle">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] tabular">{value}</div>
      {note && <div className={cn("mt-0.5 text-[12px]", tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-subtle")}>{note}</div>}
    </div>
  );
}
