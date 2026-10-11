import { describe, expect, it } from "vitest";
import type { Assumptions, Goal, MetricSnapshot } from "@/domain";
import {
  buildPlan,
  customerCeiling,
  customersAfter,
  paceToTarget,
  planLine,
  requiredNewPerMonth,
} from "./engine";
import { customerFlow } from "./flow";
import { leverImpacts } from "./impact";
import { DEFAULT_CHURN_RATE, measureHistory } from "./measure";

const projectId = "6f1b7a52-3c0e-4a52-9c1f-0d6b1f1f2a10";
const now = "2026-10-11T10:00:00.000Z";
let seq = 0;

function snap(
  period: string,
  mrr: number,
  payingCustomers: number,
  extra: Partial<MetricSnapshot> = {},
): MetricSnapshot {
  seq++;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    projectId,
    period,
    mrr,
    payingCustomers,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "9d3e7b42-9f1c-4a2d-b2e3-4c5d6e7f8091",
    projectId,
    label: "",
    targetMrr: 1_000_000,
    deadline: "2028-03",
    baselinePeriod: "2026-09",
    baselineMrr: 120_000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function levers(overrides: Partial<Assumptions>): Assumptions {
  return {
    projectId,
    arpu: null,
    monthlyChurnRate: null,
    newCustomersPerMonth: null,
    monthlyCosts: null,
    updatedAt: now,
    ...overrides,
  };
}

describe("customer model", () => {
  it("matches a month-by-month simulation", () => {
    let c = 60;
    for (let t = 0; t < 18; t++) c = c * (1 - 0.05) + 40;
    expect(customersAfter(60, 0.05, 40, 18)).toBeCloseTo(c, 9);
  });

  it("grows linearly without churn", () => {
    expect(customersAfter(10, 0, 5, 4)).toBe(30);
  });

  it("finds the new customers per month that land exactly on the target", () => {
    const n = requiredNewPerMonth(60, 500, 0.05, 18);
    expect(n).toBeCloseTo(39.5, 1);
    expect(customersAfter(60, 0.05, n, 18)).toBeCloseTo(500, 9);
    expect(requiredNewPerMonth(10, 30, 0, 4)).toBe(5);
  });

  it("needs no new customers when churn alone still leaves enough", () => {
    expect(requiredNewPerMonth(1000, 500, 0.01, 12)).toBe(0);
  });

  it("levels off at new / churn customers", () => {
    expect(customerCeiling(60, 0.05, 8)).toBeCloseTo(160);
    expect(customerCeiling(60, 0, 8)).toBe(Infinity);
    expect(customerCeiling(60, 0, 0)).toBe(60);
  });
});

describe("pace to target", () => {
  it("reports the first month the target is reached", () => {
    const pace = paceToTarget("2026-09", 60, 2000, 0, 10, 200_000);
    expect(pace.monthsToTarget).toBe(4);
    expect(pace.reachedAt).toBe("2027-01");
  });

  it("says never when the ceiling is below the target", () => {
    // 8 new a month with 5% churn levels off at 160 customers = 3,200.00
    const pace = paceToTarget("2026-09", 60, 2000, 0.05, 8, 1_000_000);
    expect(pace.monthsToTarget).toBeNull();
    expect(pace.reachedAt).toBeNull();
    expect(pace.ceilingMrr).toBeCloseTo(320_000);
  });

  it("returns zero months when already there", () => {
    expect(paceToTarget("2026-09", 600, 2000, 0.05, 0, 1_000_000).monthsToTarget).toBe(0);
  });
});

describe("plan line", () => {
  it("compounds from the baseline to the target", () => {
    const line = planLine(goal({ baselineMrr: 100_000, targetMrr: 400_000, deadline: "2026-11" }));
    expect(line.map((p) => p.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(line.map((p) => p.mrr)).toEqual([100_000, 200_000, 400_000]);
  });

  it("goes straight from zero", () => {
    const line = planLine(goal({ baselineMrr: 0, targetMrr: 300_000, deadline: "2026-12" }));
    expect(line.map((p) => p.mrr)).toEqual([0, 100_000, 200_000, 300_000]);
  });
});

describe("measureHistory", () => {
  it("measures ARPU, churn and new customers from detailed months", () => {
    const m = measureHistory([
      snap("2026-07", 100_000, 50),
      snap("2026-08", 110_000, 55, { newCustomers: 10, churnedCustomers: 5 }),
      snap("2026-09", 120_000, 60, { newCustomers: 8, churnedCustomers: 3, costs: 50_000 }),
    ]);
    expect(m.arpu).toEqual({ value: 2000, source: "measured" });
    expect(m.churnRate.source).toBe("measured");
    expect(m.churnRate.value).toBeCloseTo((5 / 50 + 3 / 55) / 2);
    expect(m.newCustomersPerMonth).toEqual({ value: 9, source: "measured" });
    expect(m.monthlyCosts).toEqual({ value: 50_000, source: "measured" });
    expect(m.mrrChange).toBe(10_000);
    expect(m.lowConfidence).toBe(false);
    // 1,000 -> 1,200 over 2 months
    expect(m.recentMrrGrowth!.months).toBe(2);
    expect(m.recentMrrGrowth!.rate).toBeCloseTo(Math.sqrt(1.2) - 1);
  });

  it("falls back to a stated default churn and infers new customers from the net change", () => {
    const m = measureHistory([snap("2026-08", 100_000, 50), snap("2026-09", 120_000, 60)]);
    expect(m.churnRate).toEqual({ value: DEFAULT_CHURN_RATE, source: "default" });
    // +10 net, plus 5% of 50 lost to churn
    expect(m.newCustomersPerMonth.value).toBeCloseTo(12.5);
    expect(m.newCustomersPerMonth.source).toBe("estimated");
    expect(m.lowConfidence).toBe(true);
  });

  it("does not treat a gap as a month-over-month change", () => {
    const m = measureHistory([snap("2026-05", 100_000, 50), snap("2026-09", 120_000, 60)]);
    expect(m.previous).toBeNull();
    expect(m.mrrChange).toBeNull();
    expect(m.newCustomersPerMonth.source).toBe("default");
  });

  it("has no ARPU without customers", () => {
    const m = measureHistory([snap("2026-09", 0, 0)]);
    expect(m.arpu).toBeNull();
  });

  it("handles an empty history", () => {
    const m = measureHistory([]);
    expect(m.latest).toBeNull();
    expect(m.monthsOfHistory).toBe(0);
  });
});

describe("buildPlan", () => {
  // The worked example from the spec discussion: 1,200 € MRR, 60 customers at
  // 20 €, 5% churn, target 10,000 € in 18 months.
  const history = [
    snap("2026-08", 110_000, 55, { newCustomers: 8, churnedCustomers: 3 }),
    snap("2026-09", 120_000, 60, { newCustomers: 8, churnedCustomers: 3, costs: 150_000 }),
  ];

  it("answers what it takes to reach the goal", () => {
    const result = buildPlan({
      history,
      goal: goal(),
      assumptions: levers({ monthlyChurnRate: 0.05 }),
      cashBalance: 600_000,
    });
    const g = result.goal!;
    expect(g.monthsLeft).toBe(18);
    expect(g.customersNeeded).toBe(500);
    expect(g.requiredNewPerMonth).toBeCloseTo(39.5, 1);
    expect(g.progress).toBeCloseTo(0.12);
    expect(g.requiredMonthlyGrowth).toBeCloseTo((1_000_000 / 120_000) ** (1 / 18) - 1);
    // 8 new a month with 5% churn never gets there.
    expect(g.pace!.monthsToTarget).toBeNull();
    expect(g.vsPlan).toEqual({ planMrr: 120_000, delta: 0 });
  });

  it("lets the price lever change customers needed", () => {
    const result = buildPlan({
      history,
      goal: goal(),
      assumptions: levers({ arpu: 3000 }),
      cashBalance: 0,
    });
    expect(result.levers.arpu).toEqual({ value: 3000, source: "user" });
    expect(result.goal!.customersNeeded).toBe(334);
  });

  it("computes runway at the current burn and the break-even month", () => {
    const result = buildPlan({
      history,
      goal: undefined,
      assumptions: levers({ monthlyChurnRate: 0.01, newCustomersPerMonth: 10 }),
      cashBalance: 600_000,
    });
    // Burning 1,500 - 1,200 = 300 a month with 6,000 in cash.
    expect(result.runwayMonths).toBe(20);
    expect(result.profitable).toBe(false);
    // Needs 75 customers at 20 €; reached in month 2.
    expect(result.breakEvenAt).toBe("2026-11");
    expect(result.goal).toBeNull();
  });

  it("knows when the goal is already reached or the deadline has passed", () => {
    const reached = buildPlan({
      history,
      goal: goal({ targetMrr: 100_000 }),
      assumptions: undefined,
      cashBalance: 0,
    }).goal!;
    expect(reached.reached).toBe(true);
    expect(reached.requiredNewPerMonth).toBeNull();

    const late = buildPlan({
      history,
      goal: goal({ deadline: "2026-06" }),
      assumptions: undefined,
      cashBalance: 0,
    }).goal!;
    expect(late.deadlinePassed).toBe(true);
    expect(late.requiredNewPerMonth).toBeNull();
  });
});

describe("customer flow", () => {
  it("is null until a month has customers who joined or left", () => {
    expect(customerFlow([snap("2026-08", 100_000, 50), snap("2026-09", 110_000, 55)])).toBeNull();
  });

  it("totals the months that have either number, leaving the unknown one out", () => {
    const flow = customerFlow([
      snap("2026-06", 90_000, 45),
      snap("2026-07", 100_000, 50, { newCustomers: 7, churnedCustomers: 2 }),
      snap("2026-08", 104_000, 52, { newCustomers: 5 }),
      snap("2026-09", 110_000, 55, { newCustomers: 6, churnedCustomers: 3 }),
    ])!;
    expect(flow.months).toEqual([
      { period: "2026-07", joined: 7, left: 2 },
      { period: "2026-08", joined: 5, left: undefined },
      { period: "2026-09", joined: 6, left: 3 },
    ]);
    expect(flow).toMatchObject({ joined: 18, left: 5, joinedPerLeft: 3.6 });
  });

  it("has no ratio when nobody left", () => {
    const flow = customerFlow([snap("2026-09", 110_000, 55, { newCustomers: 4, churnedCustomers: 0 })])!;
    expect(flow.joinedPerLeft).toBeNull();
  });
});

describe("lever impact", () => {
  const base = {
    from: "2026-09",
    startCustomers: 100,
    arpu: 2000,
    churn: 0.02,
    newPerMonth: 20,
    targetMrr: 600_000,
    deadline: "2028-09",
  };

  it("ranks the levers by how much sooner each one reaches the goal", () => {
    // 300 customers needed: 13 months as it is.
    const result = leverImpacts(base)!;
    expect(result.measure).toBe("months");
    expect(result.impacts.map((i) => [i.lever, i.monthsSooner])).toEqual([
      ["price", 2],
      ["newCustomers", 1],
      ["churn", 0],
    ]);
    expect(result.impacts[0]).toMatchObject({ from: 2000, to: 2200 });
    expect(result.impacts[2].to).toBeCloseTo(0.018);
  });

  it("compares revenue at the deadline when the goal is out of reach", () => {
    // Levels off at 8 / 5% = 160 customers, far from the 500 needed.
    const result = leverImpacts({
      ...base,
      startCustomers: 60,
      churn: 0.05,
      newPerMonth: 8,
      targetMrr: 1_000_000,
      deadline: "2028-03",
    })!;
    expect(result.measure).toBe("revenue");
    expect(result.impacts.map((i) => i.lever)).toEqual(["price", "newCustomers", "churn"]);
    expect(result.impacts.every((i) => i.monthsSooner === 0)).toBe(true);
    expect(result.impacts[0].extraAtDeadline).toBeGreaterThan(result.impacts[1].extraAtDeadline);
    expect(result.impacts[1].extraAtDeadline).toBeGreaterThan(result.impacts[2].extraAtDeadline);
  });

  it("leaves out levers at zero and needs a deadline ahead", () => {
    const result = leverImpacts({ ...base, churn: 0, newPerMonth: 0 })!;
    expect(result.impacts.map((i) => i.lever)).toEqual(["price"]);
    expect(leverImpacts({ ...base, deadline: "2026-09" })).toBeNull();
  });
});
