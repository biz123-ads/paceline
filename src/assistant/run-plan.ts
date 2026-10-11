import { z } from "zod";
import type { Assumptions, Goal, MetricSnapshot, Project } from "@/domain";
import { formatMoney, formatPeriod } from "@/lib/format";
import { monthsBetween, PERIOD_RE } from "@/lib/period";
import { buildPlan, type PlanResult } from "@/plan/engine";
import { leverImpacts, type LeverName } from "@/plan/impact";

/**
 * The assistant's only calculator: the same plan engine as the app, with
 * "what if" values swapped in. The model never does the plan maths itself,
 * so the numbers in the chat match the numbers on the page.
 */

export interface ProjectSnapshot {
  project: Project;
  snapshots: MetricSnapshot[];
  goal: Goal | undefined;
  assumptions: Assumptions | undefined;
}

export const RUN_PLAN_TOOL_NAME = "run_plan";

/** Every field is a "what if"; null keeps the project's own value. */
export const runPlanInputSchema = z.object({
  price_per_customer: z.number().positive().max(1_000_000).nullable(),
  churn_percent: z.number().min(0).max(100).nullable(),
  new_customers_per_month: z.number().min(0).max(1_000_000).nullable(),
  monthly_costs: z.number().min(0).max(100_000_000).nullable(),
  target_monthly_revenue: z.number().positive().max(100_000_000).nullable(),
  deadline: z.string().regex(PERIOD_RE).nullable(),
});

export type RunPlanInput = z.infer<typeof runPlanInputSchema>;

const nullable = (type: "number" | "string", description: string) => ({
  type: [type, "null"],
  description,
});

/** JSON Schema for the tool definition (strict: every key present). */
export const RUN_PLAN_INPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "price_per_customer",
    "churn_percent",
    "new_customers_per_month",
    "monthly_costs",
    "target_monthly_revenue",
    "deadline",
  ],
  properties: {
    price_per_customer: nullable("number", "Monthly revenue per paying customer, in the project's currency (e.g. 25 for 25 a month). Null keeps the current value."),
    churn_percent: nullable("number", "Percent of paying customers who leave each month, 0-100 (e.g. 3 for 3%). Null keeps the current value."),
    new_customers_per_month: nullable("number", "New paying customers won each month. Null keeps the current value."),
    monthly_costs: nullable("number", "Total monthly costs, in the project's currency. Null keeps the current value."),
    target_monthly_revenue: nullable("number", "A different revenue goal, per month, in the project's currency. Null keeps the current goal."),
    deadline: nullable("string", "A different goal date as YYYY-MM. Null keeps the current deadline (or 12 months out when there is no goal)."),
  },
} as const;

/** What the model reads back: plain numbers with units, and readable dates. */
export function summarizePlan(data: ProjectSnapshot, plan: PlanResult) {
  const currency = data.project.currency;
  const money = (cents: number | null | undefined) =>
    cents === null || cents === undefined ? null : formatMoney(Math.round(cents), currency, { whole: true });
  const latest = plan.measures.latest;
  const { levers } = plan;
  const g = plan.goal;
  const round = (n: number | null | undefined, digits = 1) =>
    n === null || n === undefined || !Number.isFinite(n) ? null : Number(n.toFixed(digits));
  const impact =
    g && !g.reached && data.goal && latest && levers.arpu
      ? leverImpacts({
          from: latest.period,
          startCustomers: latest.payingCustomers,
          arpu: levers.arpu.value,
          churn: levers.churnRate.value,
          newPerMonth: levers.newCustomersPerMonth.value,
          targetMrr: data.goal.targetMrr,
          deadline: data.goal.deadline,
        })
      : null;
  const leverValue: Record<LeverName, (v: number) => string | number | null> = {
    price: (v) => money(v),
    churn: (v) => round(v * 100, 2),
    newCustomers: (v) => round(v),
  };

  return {
    latest_month: latest ? formatPeriod(latest.period) : null,
    monthly_revenue: money(latest?.mrr),
    paying_customers: latest?.payingCustomers ?? null,
    months_of_history: plan.measures.monthsOfHistory,
    numbers_used: {
      price_per_customer: levers.arpu ? { value: money(levers.arpu.value), source: levers.arpu.source } : null,
      churn_percent: { value: round(levers.churnRate.value * 100, 2), source: levers.churnRate.source },
      new_customers_per_month: {
        value: round(levers.newCustomersPerMonth.value),
        source: levers.newCustomersPerMonth.source,
      },
      monthly_costs: levers.monthlyCosts
        ? { value: money(levers.monthlyCosts.value), source: levers.monthlyCosts.source }
        : null,
    },
    goal: g && data.goal
      ? {
          target_monthly_revenue: money(data.goal.targetMrr),
          deadline: formatPeriod(data.goal.deadline),
          months_left: g.monthsLeft,
          reached: g.reached,
          deadline_passed: g.deadlinePassed,
          progress_percent: round(g.progress * 100, 0),
          paying_customers_needed: g.customersNeeded,
          new_customers_needed_per_month: round(g.requiredNewPerMonth),
          revenue_growth_needed_per_month_percent: round(
            g.requiredMonthlyGrowth === null ? null : g.requiredMonthlyGrowth * 100,
          ),
          at_this_pace: g.pace
            ? {
                reaches_goal_in: g.pace.reachedAt ? formatPeriod(g.pace.reachedAt) : null,
                months_late:
                  g.pace.reachedAt ? Math.max(0, monthsBetween(data.goal.deadline, g.pace.reachedAt)) : null,
                stalls_at_monthly_revenue: Number.isFinite(g.pace.ceilingMrr) ? money(g.pace.ceilingMrr) : null,
              }
            : null,
          vs_plan_line_this_month: g.vsPlan ? money(g.vsPlan.delta) : null,
          // The same comparison as "What moves it most" on the page.
          each_number_10_percent_better: impact
            ? {
                compared_by:
                  impact.measure === "months"
                    ? "months sooner the goal is reached"
                    : "extra monthly revenue at the deadline",
                most_effective_first: impact.impacts.map((i) => ({
                  number: {
                    price: "price_per_customer",
                    churn: "churn_percent",
                    newCustomers: "new_customers_per_month",
                  }[i.lever],
                  from: leverValue[i.lever](i.from),
                  to: leverValue[i.lever](i.to),
                  months_sooner: impact.measure === "months" ? i.monthsSooner : null,
                  extra_monthly_revenue_at_deadline: money(i.extraAtDeadline),
                })),
              }
            : null,
        }
      : null,
    cash_on_hand: money(data.project.cashBalance),
    profitable: plan.profitable,
    runway_months: round(plan.runwayMonths),
    break_even_month: plan.breakEvenAt ? formatPeriod(plan.breakEvenAt) : null,
  };
}

/** Runs the engine with the "what if" values, returning the summary. */
export function runPlan(data: ProjectSnapshot, input: RunPlanInput) {
  const latest = data.snapshots.at(-1);
  const now = new Date().toISOString();
  const assumptions: Assumptions = {
    projectId: data.project.id,
    arpu: null,
    monthlyChurnRate: null,
    newCustomersPerMonth: null,
    monthlyCosts: null,
    ...data.assumptions,
    updatedAt: data.assumptions?.updatedAt ?? now,
  };
  if (input.price_per_customer !== null) assumptions.arpu = Math.round(input.price_per_customer * 100);
  if (input.churn_percent !== null) assumptions.monthlyChurnRate = input.churn_percent / 100;
  if (input.new_customers_per_month !== null) assumptions.newCustomersPerMonth = input.new_customers_per_month;
  if (input.monthly_costs !== null) assumptions.monthlyCosts = Math.round(input.monthly_costs * 100);

  let goal = data.goal;
  if (latest && (input.target_monthly_revenue !== null || input.deadline !== null)) {
    const deadline =
      input.deadline ?? goal?.deadline ?? `${Number(latest.period.slice(0, 4)) + 1}${latest.period.slice(4)}`;
    goal = {
      id: goal?.id ?? data.project.id,
      projectId: data.project.id,
      label: "",
      targetMrr: input.target_monthly_revenue !== null ? Math.round(input.target_monthly_revenue * 100) : (goal?.targetMrr ?? latest.mrr * 2),
      deadline,
      // A new target is measured from the latest month, like the app does.
      baselinePeriod: latest.period,
      baselineMrr: latest.mrr,
      createdAt: now,
      updatedAt: now,
    };
  }

  const plan = buildPlan({
    history: data.snapshots,
    goal,
    assumptions,
    cashBalance: data.project.cashBalance,
  });
  return summarizePlan({ ...data, goal }, plan);
}
