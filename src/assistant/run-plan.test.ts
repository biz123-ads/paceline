import { describe, expect, it } from "vitest";
import type { ExportBundle } from "@/domain";
import { sampleProjectBundle } from "@/lib/sample-project";
import { projectContext } from "./context";
import { runPlan, runPlanInputSchema, type ProjectSnapshot } from "./run-plan";

const NO_CHANGES = {
  price_per_customer: null,
  churn_percent: null,
  new_customers_per_month: null,
  monthly_costs: null,
  target_monthly_revenue: null,
  deadline: null,
};

function sample(): ProjectSnapshot {
  const bundle: ExportBundle = sampleProjectBundle(new Date("2026-10-11T10:00:00Z"));
  return {
    project: bundle.projects[0],
    snapshots: bundle.snapshots,
    goal: bundle.goals[0],
    assumptions: undefined,
  };
}

describe("run_plan", () => {
  it("with no changes, reports what the app shows", () => {
    const result = runPlan(sample(), NO_CHANGES);
    expect(result.monthly_revenue).toBe("€1,200");
    expect(result.paying_customers).toBe(60);
    expect(result.goal?.target_monthly_revenue).toBe("€10,000");
    expect(result.goal?.paying_customers_needed).toBe(500);
    expect(result.numbers_used.price_per_customer?.source).toBe("measured");
  });

  it("a higher price needs fewer customers, and is marked as the user's", () => {
    const result = runPlan(sample(), { ...NO_CHANGES, price_per_customer: 25 });
    expect(result.goal?.paying_customers_needed).toBe(400);
    expect(result.numbers_used.price_per_customer).toEqual({ value: "€25", source: "user" });
  });

  it("lower churn raises where growth stalls", () => {
    const now = runPlan(sample(), NO_CHANGES).goal!.at_this_pace!;
    const better = runPlan(sample(), { ...NO_CHANGES, churn_percent: 2 }).goal!.at_this_pace!;
    const parse = (s: string | null) => Number((s ?? "0").replace(/[^\d]/g, ""));
    expect(parse(better.stalls_at_monthly_revenue)).toBeGreaterThan(parse(now.stalls_at_monthly_revenue));
  });

  it("can try another goal from the latest month", () => {
    const result = runPlan(sample(), { ...NO_CHANGES, target_monthly_revenue: 3000, deadline: "2027-09" });
    expect(result.goal).toMatchObject({ target_monthly_revenue: "€3,000", deadline: "Sep 2027", months_left: 12 });
  });

  it("rejects nonsense input", () => {
    expect(runPlanInputSchema.safeParse({ ...NO_CHANGES, churn_percent: 140 }).success).toBe(false);
    expect(runPlanInputSchema.safeParse({ ...NO_CHANGES, deadline: "next year" }).success).toBe(false);
    expect(runPlanInputSchema.safeParse({ churn_percent: 2 }).success).toBe(false);
  });
});

describe("project context", () => {
  it("lists every month and the plan, deterministically", () => {
    const data = sample();
    const text = projectContext(data);
    expect(text).toContain("Name: Invoicely (sample)");
    expect(text.match(/^2026-\d\d \|/gm)).toHaveLength(9);
    expect(text).toContain('"paying_customers_needed": 500');
    expect(projectContext(data)).toBe(text);
  });
});
