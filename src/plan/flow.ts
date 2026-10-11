import type { MetricSnapshot } from "@/domain";
import type { Period } from "@/lib/period";

/**
 * Customers who joined and who left, month by month: where the change in
 * paying customers comes from. Only months where the user entered at least
 * one of the two count; a missing number is unknown, not zero.
 */
export interface FlowMonth {
  period: Period;
  joined?: number;
  left?: number;
}

export interface CustomerFlow {
  /** Oldest first. */
  months: FlowMonth[];
  /** Totals over those months. */
  joined: number;
  left: number;
  /** Customers who joined for each one who left; null when nobody left. */
  joinedPerLeft: number | null;
}

/** Null when no month has either number. */
export function customerFlow(history: MetricSnapshot[]): CustomerFlow | null {
  const months: FlowMonth[] = history
    .filter((s) => s.newCustomers !== undefined || s.churnedCustomers !== undefined)
    .map((s) => ({ period: s.period, joined: s.newCustomers, left: s.churnedCustomers }));
  if (!months.length) return null;
  const joined = months.reduce((sum, m) => sum + (m.joined ?? 0), 0);
  const left = months.reduce((sum, m) => sum + (m.left ?? 0), 0);
  return { months, joined, left, joinedPerLeft: left > 0 ? joined / left : null };
}
