"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
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
  type TooltipRow,
} from "./parts";

export interface CostsChartPoint {
  period: Period;
  /** Revenue of a month the user entered. */
  revenue?: number;
  /** Costs entered for that month. */
  costs?: number;
  /** Revenue at this pace, from the latest month on. */
  projection?: number;
  /** Costs assumed from the latest month on. */
  costsAhead?: number;
}

/** Straight segments, no dots: every line here is drawn the same way. */
const LINE = { type: "linear", dot: false, activeDot: false, isAnimationActive: false } as const;

function CostsTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as CostsChartPoint;
  const money = (cents: number) => formatMoney(cents, currency, { whole: true });
  const revenue = p.revenue ?? p.projection;
  const costs = p.costs ?? p.costsAhead;
  const rows: TooltipRow[] = [];
  if (p.revenue !== undefined) rows.push({ label: "Revenue", value: money(p.revenue) });
  else if (p.projection !== undefined) rows.push({ label: "At this pace", value: money(p.projection) });
  if (costs !== undefined) rows.push({ label: "Costs", value: money(costs) });
  if (revenue !== undefined && costs !== undefined) {
    rows.push({
      label: revenue >= costs ? "Above costs" : "Below costs",
      value: money(Math.abs(revenue - costs)),
    });
  }
  return rows.length ? <ChartTooltipBox period={p.period} rows={rows} /> : null;
}

/**
 * Revenue against costs, one line each: solid for the months entered, dashed
 * ahead, and where the current pace crosses costs (break-even).
 */
export function CostsChart({
  data,
  currency,
  breakEvenAt,
  height = 220,
}: {
  data: CostsChartPoint[];
  currency: string;
  breakEvenAt: Period | null;
  height?: number;
}) {
  const hasProjection = data.some((d) => d.projection !== undefined);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
            <XAxis {...X_AXIS} />
            <YAxis {...Y_AXIS} tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} />
            <Tooltip
              cursor={CURSOR}
              content={(props) => (
                <CostsTooltip {...(props as TooltipContentProps<number, string>)} currency={currency} />
              )}
            />
            {breakEvenAt && (
              <ReferenceLine
                x={breakEvenAt}
                stroke={COLORS.baseline}
                label={{
                  value: "Covers costs",
                  position: "top",
                  fill: "var(--muted)",
                  fontSize: 10,
                }}
              />
            )}
            <Line {...LINE} dataKey="costs" stroke={COLORS.plan} strokeWidth={1.5} connectNulls />
            <Line {...LINE} dataKey="costsAhead" stroke={COLORS.plan} strokeWidth={1.5} strokeDasharray={DASH} />
            {hasProjection && (
              <Line {...LINE} dataKey="projection" stroke={COLORS.projection} strokeWidth={1.5} strokeDasharray={DASH} />
            )}
            <Line {...LINE} dataKey="revenue" stroke={COLORS.actual} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend>
        <LegendItem swatch="w-4 border-t-2 border-chart-actual">Revenue</LegendItem>
        <LegendItem swatch="w-4 border-t-[1.5px] border-chart-plan">Costs</LegendItem>
        {hasProjection && (
          <LegendItem swatch="w-4 border-t-[1.5px] border-dashed border-accent">At this pace</LegendItem>
        )}
      </ChartLegend>
    </div>
  );
}
