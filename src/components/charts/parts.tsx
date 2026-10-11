import type { ReactNode } from "react";
import { formatPeriod } from "@/lib/format";
import type { Period } from "@/lib/period";

/** Pieces every chart shares, so they read as one family. */

export const CHART_COLORS = {
  actual: "var(--chart-actual)",
  plan: "var(--chart-plan)",
  projection: "var(--accent)",
  axis: "var(--chart-axis)",
  baseline: "var(--border-strong)",
  cursor: "var(--chart-cursor)",
};

/** Axis styling: small grey ticks, no lines. */
export const AXIS = {
  tick: { fill: CHART_COLORS.axis, fontSize: 10 },
  axisLine: false,
  tickLine: false,
} as const;

/** Year on the first month and on every January, month name otherwise. */
export function periodTick(period: Period, index: number): string {
  return index === 0 || period.endsWith("-01")
    ? `${formatPeriod(period, { short: true })} ’${period.slice(2, 4)}`
    : formatPeriod(period, { short: true });
}

/** Months along the bottom, a few of them. */
export const X_AXIS = {
  ...AXIS,
  dataKey: "period",
  tickFormatter: periodTick,
  interval: "preserveStartEnd",
  minTickGap: 32,
} as const;

/** Values on the right: three ticks are enough to read the scale. */
export const Y_AXIS = { ...AXIS, orientation: "right", tickCount: 3, width: 44 } as const;

/** The dashes every dashed line uses. */
export const DASH = "4 4";

/** Hover marks a month with a thin vertical line. */
export const CURSOR = { stroke: CHART_COLORS.baseline };

export interface TooltipRow {
  label: string;
  value: string;
}

export function ChartTooltipBox({ period, rows }: { period: Period; rows: TooltipRow[] }) {
  return (
    <div className="rounded-md bg-foreground px-2.5 py-1.5 text-[11px] text-background">
      <div className="mb-0.5 font-medium">{formatPeriod(period)}</div>
      {rows.map((r) => (
        <div key={r.label} className="num flex justify-between gap-4">
          <span className="text-background/60">{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Legend under a chart: a line or bar key, then the name. */
export function ChartLegend({ children }: { children: ReactNode }) {
  return <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">{children}</ul>;
}

export function LegendItem({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={swatch} />
      {children}
    </li>
  );
}
