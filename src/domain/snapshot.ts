import { z } from "zod";
import { PERIOD_RE } from "@/lib/period";
import { moneySchema } from "./project";

export const periodSchema = z.string().regex(PERIOD_RE, "Expected YYYY-MM");

export const SNAPSHOT_SOURCES = [
  "manual",
  "csv",
  "stripe",
  "revenuecat",
] as const;

const count = z.number().int().nonnegative();

/**
 * One row per project and month. `mrr` and `payingCustomers` are the minimum
 * a user must enter; everything optional sharpens the forecast when present.
 * (projectId, period) is unique.
 */
export const metricSnapshotSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  period: periodSchema,
  mrr: moneySchema,
  payingCustomers: count,
  newMrr: moneySchema.optional(),
  expansionMrr: moneySchema.optional(),
  contractionMrr: moneySchema.optional(),
  churnedMrr: moneySchema.optional(),
  newCustomers: count.optional(),
  churnedCustomers: count.optional(),
  /** Total costs of the month, for runway and break-even. */
  costs: moneySchema.optional(),
  source: z.enum(SNAPSHOT_SOURCES).default("manual"),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type MetricSnapshot = z.infer<typeof metricSnapshotSchema>;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];
