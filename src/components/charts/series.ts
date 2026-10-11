import type { MetricSnapshot } from "@/domain";
import { periodRange, type Period } from "@/lib/period";
import type { MrrChartPoint } from "./MrrChart";

/** One point per month from `from` to `to`, merging the series that exist. */
export function mrrSeries({
  from,
  to,
  snapshots,
  plan = [],
}: {
  from: Period;
  to: Period;
  snapshots: MetricSnapshot[];
  plan?: { period: Period; mrr: number }[];
}): MrrChartPoint[] {
  const actual = new Map(snapshots.map((s) => [s.period, s.mrr]));
  const planned = new Map(plan.map((p) => [p.period, p.mrr]));
  return periodRange(from, to).map((period) => ({
    period,
    actual: actual.get(period),
    plan: planned.get(period),
  }));
}
