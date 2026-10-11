import { describe, expect, it } from "vitest";
import { exportBundleSchema } from "@/domain";
import { buildPlan } from "@/plan/engine";
import { sampleProjectBundle } from "./sample-project";

describe("sample project", () => {
  const bundle = sampleProjectBundle(new Date(2026, 9, 11));

  it("is a valid backup bundle ending last month", () => {
    expect(exportBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.snapshots.at(-1)!.period).toBe("2026-09");
  });

  it("produces a plan with measured levers and a goal not yet reached", () => {
    const plan = buildPlan({
      history: bundle.snapshots,
      goal: bundle.goals[0],
      assumptions: undefined,
      cashBalance: bundle.projects[0].cashBalance,
    });
    expect(plan.levers.churnRate.source).toBe("measured");
    expect(plan.goal!.reached).toBe(false);
    expect(plan.goal!.monthsLeft).toBe(18);
    expect(plan.runwayMonths).not.toBeNull();
  });
});
