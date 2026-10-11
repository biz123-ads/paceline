"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatMoney, formatPeriod } from "@/lib/format";
import type { Period } from "@/lib/period";

export interface MrrChartPoint {
  period: Period;
  /** Real MRR the user entered (or synced). */
  actual?: number;
  /** The goal's reference line. */
  plan?: number;
  /** Where the current levers lead. */
  projection?: number;
}

const COLORS = {
  actual: "var(--chart-actual)",
  track: "var(--chart-track)",
  plan: "var(--chart-plan)",
  projection: "var(--accent)",
  axis: "var(--chart-axis)",
};

function ChartTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as MrrChartPoint;
  const rows = [
    { label: "Actual", value: point.actual, color: COLORS.actual, whole: false },
    { label: "Plan", value: point.plan, color: COLORS.plan, whole: true },
    { label: "At this pace", value: point.projection, color: COLORS.projection, whole: true },
  ].filter((r) => r.value !== undefined);
  return (
    <div className="rounded-lg bg-foreground px-3 py-2 text-[11px] text-background shadow-lg">
      <div className="mb-1 font-medium">{formatPeriod(point.period)}</div>
      {rows.map((r) => (
        <div key={r.label} className="num flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-background/60">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <span>{formatMoney(r.value!, currency, { whole: r.whole })}</span>
        </div>
      ))}
    </div>
  );
}

export function MrrChart({
  data,
  currency,
  height = 260,
}: {
  data: MrrChartPoint[];
  currency: string;
  height?: number;
}) {
  const hasPlan = data.some((d) => d.plan !== undefined);
  const hasProjection = data.some((d) => d.projection !== undefined);
  // Year on the first month and on every January, month name otherwise.
  const tick = (period: Period, index: number) =>
    index === 0 || period.endsWith("-01")
      ? `${formatPeriod(period, { short: true })} ’${period.slice(2, 4)}`
      : formatPeriod(period, { short: true });

  return (
    <div>
      <div style={{ height }} className="-mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="period"
              tickFormatter={tick}
              tick={{ fill: COLORS.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              orientation="right"
              tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
              tick={{ fill: COLORS.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-cursor)" }}
              content={(props) => (
                <ChartTooltip {...(props as TooltipContentProps<number, string>)} currency={currency} />
              )}
            />
            <Bar
              dataKey="actual"
              fill={COLORS.actual}
              radius={[4, 4, 4, 4]}
              maxBarSize={18}
              background={{ fill: COLORS.track, radius: 4 }}
              isAnimationActive={false}
            />
            {hasProjection && (
              <Line
                dataKey="projection"
                stroke={COLORS.projection}
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
            {hasPlan && (
              <Line
                dataKey="plan"
                stroke={COLORS.plan}
                strokeWidth={1.5}
                strokeDasharray="6 5"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-chart-actual" /> Actual MRR
        </li>
        {hasPlan && (
          <li className="flex items-center gap-2">
            <span className="w-4 border-t-[1.5px] border-dashed border-chart-plan" /> Plan to
            goal
          </li>
        )}
        {hasProjection && (
          <li className="flex items-center gap-2">
            <span className="w-4 border-t-[1.5px] border-dotted border-accent" /> At this pace
          </li>
        )}
      </ul>
    </div>
  );
}
