"use client";

import {
  Bar,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatNumber } from "@/lib/format";
import { periodRange, type Period } from "@/lib/period";
import type { FlowMonth } from "@/plan/flow";
import {
  CHART_COLORS as COLORS,
  ChartLegend,
  ChartTooltipBox,
  LegendItem,
  X_AXIS,
  Y_AXIS,
  type TooltipRow,
} from "./parts";

interface FlowPoint {
  period: Period;
  joined?: number;
  /** Drawn below the line, so stored negative. */
  left?: number;
}

function FlowTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as FlowPoint;
  const joined = point.joined;
  const left = point.left === undefined ? undefined : -point.left;
  if (joined === undefined && left === undefined) return null;
  const rows: TooltipRow[] = [];
  if (joined !== undefined) rows.push({ label: "Joined", value: formatNumber(joined) });
  if (left !== undefined) rows.push({ label: "Left", value: formatNumber(left) });
  if (joined !== undefined && left !== undefined) {
    const net = joined - left;
    rows.push({ label: "Net", value: `${net > 0 ? "+" : net < 0 ? "−" : ""}${formatNumber(Math.abs(net))}` });
  }
  return <ChartTooltipBox period={point.period} rows={rows} />;
}

/** Customers who joined (above the line) and who left (below), per month. */
export function FlowChart({
  months,
  from,
  to,
  height = 260,
}: {
  months: FlowMonth[];
  from: Period;
  to: Period;
  height?: number;
}) {
  const byPeriod = new Map(months.map((m) => [m.period, m]));
  const data: FlowPoint[] = periodRange(from, to).map((period) => {
    const m = byPeriod.get(period);
    return {
      period,
      joined: m?.joined,
      left: m?.left === undefined ? undefined : -m.left,
    };
  });

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} stackOffset="sign" margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis {...X_AXIS} />
            <YAxis {...Y_AXIS} allowDecimals={false} tickFormatter={(v: number) => formatNumber(Math.abs(v))} />
            <Tooltip cursor={{ fill: COLORS.cursor }} content={(props) => <FlowTooltip {...(props as TooltipContentProps<number, string>)} />} />
            <Bar
              dataKey="joined"
              stackId="flow"
              fill={COLORS.actual}
              radius={2}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <Bar
              dataKey="left"
              stackId="flow"
              fill={COLORS.plan}
              radius={2}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <ReferenceLine y={0} stroke={COLORS.baseline} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend>
        <LegendItem swatch="h-2.5 w-2.5 rounded-[2px] bg-chart-actual">Joined</LegendItem>
        <LegendItem swatch="h-2.5 w-2.5 rounded-[2px] bg-chart-plan">Left</LegendItem>
      </ChartLegend>
    </div>
  );
}
