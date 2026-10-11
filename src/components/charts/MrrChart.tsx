"use client";

import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatMoney } from "@/lib/format";
import type { Period } from "@/lib/period";
import {
  CHART_COLORS as COLORS,
  CURSOR,
  ChartLegend,
  ChartTooltipBox,
  DASH,
  LegendItem,
  X_AXIS,
  Y_AXIS,
} from "./parts";

export interface MrrChartPoint {
  period: Period;
  /** Real MRR the user entered (or synced). */
  actual?: number;
  /** The goal's reference line. */
  plan?: number;
}

function ChartTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as MrrChartPoint;
  const rows = [
    { label: "Revenue", value: point.actual, whole: false },
    { label: "Plan", value: point.plan, whole: true },
  ]
    .filter((r) => r.value !== undefined)
    .map((r) => ({ label: r.label, value: formatMoney(r.value!, currency, { whole: r.whole }) }));
  return <ChartTooltipBox period={point.period} rows={rows} />;
}

/** Revenue as one line, the plan to the goal as a dashed one. */
export function MrrChart({
  data,
  currency,
  height = 240,
}: {
  data: MrrChartPoint[];
  currency: string;
  height?: number;
}) {
  const hasPlan = data.some((d) => d.plan !== undefined);
  const last = data.findLast((d) => d.actual !== undefined);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis {...X_AXIS} />
            <YAxis {...Y_AXIS} tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} />
            <Tooltip
              cursor={CURSOR}
              content={(props) => (
                <ChartTooltip {...(props as TooltipContentProps<number, string>)} currency={currency} />
              )}
            />
            {hasPlan && (
              <Line
                type="linear"
                dataKey="plan"
                stroke={COLORS.plan}
                strokeWidth={1.5}
                strokeDasharray={DASH}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Line
              type="linear"
              dataKey="actual"
              stroke={COLORS.actual}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            {/* The latest month: where you are now. */}
            {last && (
              <ReferenceDot
                x={last.period}
                y={last.actual}
                r={3.5}
                fill={COLORS.actual}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasPlan && (
        <ChartLegend>
          <LegendItem swatch="w-4 border-t-2 border-chart-actual">Your revenue</LegendItem>
          <LegendItem swatch="w-4 border-t-[1.5px] border-dashed border-chart-plan">Plan to goal</LegendItem>
        </ChartLegend>
      )}
    </div>
  );
}
