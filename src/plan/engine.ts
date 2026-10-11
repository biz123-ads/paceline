import type { Assumptions, Goal, MetricSnapshot } from "@/domain";
import { addMonths, monthsBetween, type Period } from "@/lib/period";
import { measureHistory, type HistoryMeasures, type Sourced } from "./measure";

/**
 * The plan engine. Pure functions: history, goal and levers in, numbers out.
 * No storage, no React, no clock.
 *
 * Model, per month:
 *   customers(t+1) = customers(t) × (1 − churn) + newPerMonth
 *   MRR(t)         = customers(t) × ARPU
 * Customers stay fractional inside the model; round only for display.
 */

/** How far "at this pace" looks before giving up (10 years). */
export const MAX_PROJECTION_MONTHS = 120;

export interface Levers {
  /** Null when there are no customers yet and the user has not set a price. */
  arpu: Sourced<number> | null;
  churnRate: Sourced<number>;
  newCustomersPerMonth: Sourced<number>;
  monthlyCosts: Sourced<number> | null;
}

/** The user's levers win; otherwise the measured (or default) value. */
export function resolveLevers(
  measures: HistoryMeasures,
  assumptions: Assumptions | undefined,
): Levers {
  const user = <T>(value: T): Sourced<T> => ({ value, source: "user" });
  return {
    arpu: assumptions?.arpu != null ? user(assumptions.arpu) : measures.arpu,
    churnRate:
      assumptions?.monthlyChurnRate != null
        ? user(assumptions.monthlyChurnRate)
        : measures.churnRate,
    newCustomersPerMonth:
      assumptions?.newCustomersPerMonth != null
        ? user(assumptions.newCustomersPerMonth)
        : measures.newCustomersPerMonth,
    monthlyCosts:
      assumptions?.monthlyCosts != null
        ? user(assumptions.monthlyCosts)
        : measures.monthlyCosts,
  };
}

/** Customers after `months` months, closed form of the model above. */
export function customersAfter(
  start: number,
  churn: number,
  newPerMonth: number,
  months: number,
): number {
  if (churn === 0) return start + newPerMonth * months;
  const keep = (1 - churn) ** months;
  return start * keep + (newPerMonth * (1 - keep)) / churn;
}

/**
 * New customers needed every month to go from `start` to `target` customers
 * in `months` months. Zero when churn alone still leaves enough customers.
 */
export function requiredNewPerMonth(
  start: number,
  target: number,
  churn: number,
  months: number,
): number {
  if (months <= 0) throw new Error("months must be positive");
  const needed =
    churn === 0
      ? (target - start) / months
      : ((target - start * (1 - churn) ** months) * churn) /
        (1 - (1 - churn) ** months);
  return Math.max(0, needed);
}

/** Customer count the business levels off at: newPerMonth / churn. */
export function customerCeiling(
  start: number,
  churn: number,
  newPerMonth: number,
): number {
  if (churn === 0) return newPerMonth > 0 ? Infinity : start;
  return newPerMonth / churn;
}

export interface PaceResult {
  /** Months from the latest month until MRR >= target; null if never. */
  monthsToTarget: number | null;
  reachedAt: Period | null;
  /** MRR the business levels off at with these levers (Infinity without churn). */
  ceilingMrr: number;
}

export function paceToTarget(
  from: Period,
  startCustomers: number,
  arpu: number,
  churn: number,
  newPerMonth: number,
  targetMrr: number,
): PaceResult {
  const ceilingMrr = customerCeiling(startCustomers, churn, newPerMonth) * arpu;
  // Tolerance of half a cent against floating point drift.
  const reached = (customers: number) => customers * arpu >= targetMrr - 0.5;
  for (let t = 0; t <= MAX_PROJECTION_MONTHS; t++) {
    if (reached(customersAfter(startCustomers, churn, newPerMonth, t))) {
      return { monthsToTarget: t, reachedAt: addMonths(from, t), ceilingMrr };
    }
  }
  return { monthsToTarget: null, reachedAt: null, ceilingMrr };
}

export interface ProjectionPoint {
  period: Period;
  customers: number;
  mrr: number;
}

/** Month-by-month path with the given levers, starting from the latest month. */
export function project(
  from: Period,
  startCustomers: number,
  arpu: number,
  churn: number,
  newPerMonth: number,
  months: number,
): ProjectionPoint[] {
  return Array.from({ length: months + 1 }, (_, t) => {
    const customers = customersAfter(startCustomers, churn, newPerMonth, t);
    return {
      period: addMonths(from, t),
      customers,
      mrr: Math.round(customers * arpu),
    };
  });
}

export interface PlanLinePoint {
  period: Period;
  mrr: number;
}

/**
 * The goal's reference line, from the frozen baseline to the target:
 * constant compound growth, or a straight line when starting from zero.
 */
export function planLine(goal: Goal): PlanLinePoint[] {
  const months = monthsBetween(goal.baselinePeriod, goal.deadline);
  if (months <= 0) return [{ period: goal.deadline, mrr: goal.targetMrr }];
  const { baselineMrr: from, targetMrr: to } = goal;
  return Array.from({ length: months + 1 }, (_, k) => ({
    period: addMonths(goal.baselinePeriod, k),
    mrr: Math.round(
      from > 0 ? from * (to / from) ** (k / months) : (to * k) / months,
    ),
  }));
}

/** Plan value for a month, or null outside the plan's range. */
export function planValueAt(line: PlanLinePoint[], period: Period): number | null {
  return line.find((p) => p.period === period)?.mrr ?? null;
}

export interface GoalAnalysis {
  /** Months between the latest month and the deadline. */
  monthsLeft: number;
  deadlinePassed: boolean;
  reached: boolean;
  /** Share of the target already reached, 0..1+ */
  progress: number;
  /** Null without an ARPU (no customers and no price set). */
  customersNeeded: number | null;
  /** New customers needed per month to make the deadline. */
  requiredNewPerMonth: number | null;
  /** Net monthly MRR growth needed to make the deadline. */
  requiredMonthlyGrowth: number | null;
  /** With the current levers. */
  pace: PaceResult | null;
  /** Latest MRR versus the plan line for the same month. */
  vsPlan: { planMrr: number; delta: number } | null;
}

export interface PlanInput {
  /** Months entered by the user, oldest first. */
  history: MetricSnapshot[];
  goal: Goal | undefined;
  assumptions: Assumptions | undefined;
  /** Cash on hand, for runway. */
  cashBalance: number;
}

export interface PlanResult {
  measures: HistoryMeasures;
  levers: Levers;
  goal: GoalAnalysis | null;
  planLine: PlanLinePoint[];
  /** Months of cash left at the current burn; null when not burning or no costs. */
  runwayMonths: number | null;
  /** True when costs are known and MRR covers them. */
  profitable: boolean | null;
  /** First month MRR >= costs at the current pace; null if never or unknown. */
  breakEvenAt: Period | null;
}

function analyseGoal(
  goal: Goal,
  measures: HistoryMeasures,
  levers: Levers,
  line: PlanLinePoint[],
): GoalAnalysis | null {
  const latest = measures.latest;
  if (!latest) return null;
  const monthsLeft = monthsBetween(latest.period, goal.deadline);
  const reached = latest.mrr >= goal.targetMrr;
  const arpu = levers.arpu?.value ?? null;
  const churn = levers.churnRate.value;
  const customersNeeded = arpu ? Math.ceil(goal.targetMrr / arpu) : null;
  // The model starts from the latest customer count.
  const start = latest.payingCustomers;

  const canPlan = monthsLeft > 0 && !reached;
  const planMrr = planValueAt(line, latest.period);

  return {
    monthsLeft,
    deadlinePassed: monthsLeft < 0 || (monthsLeft === 0 && !reached),
    reached,
    progress: goal.targetMrr > 0 ? latest.mrr / goal.targetMrr : 0,
    customersNeeded,
    requiredNewPerMonth:
      canPlan && customersNeeded !== null
        ? requiredNewPerMonth(start, customersNeeded, churn, monthsLeft)
        : null,
    requiredMonthlyGrowth:
      canPlan && latest.mrr > 0
        ? (goal.targetMrr / latest.mrr) ** (1 / monthsLeft) - 1
        : null,
    pace: arpu
      ? paceToTarget(
          latest.period,
          start,
          arpu,
          churn,
          levers.newCustomersPerMonth.value,
          goal.targetMrr,
        )
      : null,
    vsPlan: planMrr !== null ? { planMrr, delta: latest.mrr - planMrr } : null,
  };
}

export function buildPlan(input: PlanInput): PlanResult {
  const measures = measureHistory(input.history);
  const levers = resolveLevers(measures, input.assumptions);
  const line = input.goal ? planLine(input.goal) : [];
  const latest = measures.latest;
  const costs = levers.monthlyCosts?.value ?? null;

  let runwayMonths: number | null = null;
  let profitable: boolean | null = null;
  let breakEvenAt: Period | null = null;
  if (latest && costs !== null && costs > 0) {
    profitable = latest.mrr >= costs;
    if (!profitable) {
      runwayMonths = input.cashBalance / (costs - latest.mrr);
      if (levers.arpu) {
        breakEvenAt = paceToTarget(
          latest.period,
          latest.payingCustomers,
          levers.arpu.value,
          levers.churnRate.value,
          levers.newCustomersPerMonth.value,
          costs,
        ).reachedAt;
      }
    }
  } else if (latest && costs === 0) {
    profitable = true;
  }

  return {
    measures,
    levers,
    goal: input.goal ? analyseGoal(input.goal, measures, levers, line) : null,
    planLine: line,
    runwayMonths,
    profitable,
    breakEvenAt,
  };
}
