import { monthsBetween, type Period } from "@/lib/period";
import { customersAfter, paceToTarget } from "./engine";

/**
 * Which lever matters most for the goal: each one improved by the same
 * share, on its own, everything else as it is. Pure, like the engine.
 */

/** How much each lever improves in the comparison. */
export const LEVER_STEP = 0.1;

export type LeverName = "price" | "churn" | "newCustomers";

export interface LeverImpact {
  lever: LeverName;
  /** The lever now and improved: cents, a churn fraction, or customers a month. */
  from: number;
  to: number;
  /** How much sooner the goal is reached; 0 when the month does not change. */
  monthsSooner: number;
  /** Extra monthly revenue at the deadline. */
  extraAtDeadline: number;
}

export interface LeverImpacts {
  /**
   * "months" when the goal is reached at this pace and some lever brings the
   * date closer; otherwise "revenue", compared at the deadline.
   */
  measure: "months" | "revenue";
  /** Most effective first. */
  impacts: LeverImpact[];
}

export interface LeverImpactInput {
  /** The latest month, where the model starts. */
  from: Period;
  startCustomers: number;
  arpu: number;
  churn: number;
  newPerMonth: number;
  targetMrr: number;
  deadline: Period;
}

/** Null when the deadline is not ahead. */
export function leverImpacts(input: LeverImpactInput): LeverImpacts | null {
  const { from, startCustomers, targetMrr, deadline } = input;
  const monthsLeft = monthsBetween(from, deadline);
  if (monthsLeft <= 0) return null;

  type Levers = Pick<LeverImpactInput, "arpu" | "churn" | "newPerMonth">;
  const outcome = ({ arpu, churn, newPerMonth }: Levers) => ({
    months: paceToTarget(from, startCustomers, arpu, churn, newPerMonth, targetMrr).monthsToTarget,
    atDeadline: customersAfter(startCustomers, churn, newPerMonth, monthsLeft) * arpu,
  });
  const base = outcome(input);

  const variants: { lever: LeverName; from: number; to: number; levers: Levers }[] = [
    {
      lever: "price",
      from: input.arpu,
      to: Math.round(input.arpu * (1 + LEVER_STEP)),
      levers: { ...input, arpu: Math.round(input.arpu * (1 + LEVER_STEP)) },
    },
  ];
  // Nothing to cut, or nothing to grow: 10% of zero moves nothing.
  if (input.churn > 0) {
    const churn = input.churn * (1 - LEVER_STEP);
    variants.push({ lever: "churn", from: input.churn, to: churn, levers: { ...input, churn } });
  }
  if (input.newPerMonth > 0) {
    const newPerMonth = input.newPerMonth * (1 + LEVER_STEP);
    variants.push({
      lever: "newCustomers",
      from: input.newPerMonth,
      to: newPerMonth,
      levers: { ...input, newPerMonth },
    });
  }

  const impacts: LeverImpact[] = variants.map((v) => {
    const result = outcome(v.levers);
    return {
      lever: v.lever,
      from: v.from,
      to: v.to,
      monthsSooner:
        base.months !== null && result.months !== null ? base.months - result.months : 0,
      extraAtDeadline: Math.max(0, Math.round(result.atDeadline - base.atDeadline)),
    };
  });

  const measure = base.months !== null && impacts.some((i) => i.monthsSooner > 0) ? "months" : "revenue";
  impacts.sort((a, b) =>
    measure === "months"
      ? b.monthsSooner - a.monthsSooner || b.extraAtDeadline - a.extraAtDeadline
      : b.extraAtDeadline - a.extraAtDeadline,
  );
  return { measure, impacts };
}
