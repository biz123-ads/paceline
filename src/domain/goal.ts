import { z } from "zod";
import { moneySchema } from "./project";
import { periodSchema } from "./snapshot";

const positiveMoney = moneySchema.refine((v) => v > 0, "Must be greater than zero");

/**
 * Where the user wants the project to be: a target MRR by a deadline month.
 * One per project in the MVP. The baseline is frozen when the goal is set, so
 * the plan line stays put and later months can be compared against it.
 */
export const goalSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  label: z.string().trim().max(100).default(""),
  targetMrr: positiveMoney,
  deadline: periodSchema,
  baselinePeriod: periodSchema,
  baselineMrr: moneySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Goal = z.infer<typeof goalSchema>;

/**
 * The plan's levers, one row per project. `null` means "use what the data
 * says"; a number means the user moved the lever. Rates are fractions.
 */
export const assumptionsSchema = z.object({
  projectId: z.uuid(),
  /** Average revenue per paying customer per month. */
  arpu: positiveMoney.nullable().default(null),
  /** Share of paying customers lost each month. */
  monthlyChurnRate: z.number().min(0).max(1).nullable().default(null),
  newCustomersPerMonth: z.number().min(0).max(1_000_000).nullable().default(null),
  monthlyCosts: moneySchema.nullable().default(null),
  updatedAt: z.iso.datetime(),
});

export type Assumptions = z.infer<typeof assumptionsSchema>;
