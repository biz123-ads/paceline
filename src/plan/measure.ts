import type { MetricSnapshot } from "@/domain";
import { addMonths, monthsBetween } from "@/lib/period";

/** How many recent months feed the averages. */
export const MEASURE_WINDOW = 6;
/** Below this many months the measured values are only indicative. */
export const MIN_CONFIDENT_MONTHS = 3;
/** Used when churn cannot be measured; always labelled as an assumption. */
export const DEFAULT_CHURN_RATE = 0.05;

/**
 * Where a lever value comes from:
 * - `measured`: computed directly from fields the user entered;
 * - `estimated`: inferred indirectly (e.g. new customers from the net change);
 * - `default`: not enough data, a stated assumption;
 * - `user`: the user moved the lever.
 */
export type ValueSource = "measured" | "estimated" | "default" | "user";

export interface Sourced<T> {
  value: T;
  source: ValueSource;
}

export interface HistoryMeasures {
  monthsOfHistory: number;
  lowConfidence: boolean;
  latest: MetricSnapshot | null;
  previous: MetricSnapshot | null;
  /** Latest MRR minus the previous month's, or null without two consecutive months. */
  mrrChange: number | null;
  /** Compound monthly MRR growth over the last (up to) 3 months. */
  recentMrrGrowth: { rate: number; months: number } | null;
  /** Revenue per paying customer in the latest month; null without customers. */
  arpu: Sourced<number> | null;
  churnRate: Sourced<number>;
  newCustomersPerMonth: Sourced<number>;
  /** Costs of the most recent month that has them; null if never entered. */
  monthlyCosts: Sourced<number> | null;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Consecutive (previous, current) pairs, most recent last. */
function consecutivePairs(history: MetricSnapshot[]) {
  const pairs: { prev: MetricSnapshot; cur: MetricSnapshot }[] = [];
  for (let i = 1; i < history.length; i++) {
    if (monthsBetween(history[i - 1].period, history[i].period) === 1) {
      pairs.push({ prev: history[i - 1], cur: history[i] });
    }
  }
  return pairs;
}

/**
 * Derives the plan's starting values from the months the user entered.
 * `history` must be sorted oldest first (as storage returns it).
 */
export function measureHistory(history: MetricSnapshot[]): HistoryMeasures {
  const recent = history.slice(-MEASURE_WINDOW - 1);
  const latest = history.at(-1) ?? null;
  const beforeLatest = history.at(-2) ?? null;
  const previous =
    latest && beforeLatest && monthsBetween(beforeLatest.period, latest.period) === 1
      ? beforeLatest
      : null;
  const pairs = consecutivePairs(recent).slice(-MEASURE_WINDOW);

  const arpu: Sourced<number> | null =
    latest && latest.payingCustomers > 0
      ? {
          value: Math.round(latest.mrr / latest.payingCustomers),
          source: "measured",
        }
      : null;

  const churnRates = pairs
    .filter((p) => p.cur.churnedCustomers !== undefined && p.prev.payingCustomers > 0)
    .map((p) => Math.min(1, p.cur.churnedCustomers! / p.prev.payingCustomers));
  const churnRate: Sourced<number> = churnRates.length
    ? { value: average(churnRates), source: "measured" }
    : { value: DEFAULT_CHURN_RATE, source: "default" };

  const newCounts = recent
    .slice(-MEASURE_WINDOW)
    .filter((s) => s.newCustomers !== undefined)
    .map((s) => s.newCustomers!);
  let newCustomersPerMonth: Sourced<number>;
  if (newCounts.length) {
    newCustomersPerMonth = { value: average(newCounts), source: "measured" };
  } else if (pairs.length) {
    // Net change plus the customers churn must have taken away.
    const inferred = pairs.map(
      (p) =>
        p.cur.payingCustomers -
        p.prev.payingCustomers +
        churnRate.value * p.prev.payingCustomers,
    );
    newCustomersPerMonth = {
      value: Math.max(0, average(inferred)),
      source: "estimated",
    };
  } else {
    newCustomersPerMonth = { value: 0, source: "default" };
  }

  let recentMrrGrowth: HistoryMeasures["recentMrrGrowth"] = null;
  if (latest) {
    const byPeriod = new Map(history.map((s) => [s.period, s]));
    for (let k = 3; k >= 1; k--) {
      const earlier = byPeriod.get(addMonths(latest.period, -k));
      if (earlier && earlier.mrr > 0) {
        recentMrrGrowth = { rate: (latest.mrr / earlier.mrr) ** (1 / k) - 1, months: k };
        break;
      }
    }
  }

  const withCosts = history.filter((s) => s.costs !== undefined);
  const lastCosts = withCosts.at(-1);

  return {
    monthsOfHistory: history.length,
    lowConfidence: history.length < MIN_CONFIDENT_MONTHS,
    latest,
    previous,
    mrrChange: latest && previous ? latest.mrr - previous.mrr : null,
    recentMrrGrowth,
    arpu,
    churnRate,
    newCustomersPerMonth,
    monthlyCosts: lastCosts ? { value: lastCosts.costs!, source: "measured" } : null,
  };
}
