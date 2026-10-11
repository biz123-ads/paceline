import { z } from "zod";

/** Money is always an integer number of minor units (cents), never a float. */
export const moneySchema = z.number().int().nonnegative();

export const PROJECT_KINDS = ["saas", "app", "other"] as const;
export const PROJECT_STAGES = [
  "idea",
  "building",
  "launched",
  "growing",
] as const;

export const projectSchema = z.object({
  id: z.uuid(),
  /** Unused in v1 (no accounts). Kept so local data can be claimed later. */
  userId: z.string().nullable().default(null),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).default(""),
  kind: z.enum(PROJECT_KINDS),
  stage: z.enum(PROJECT_STAGES),
  websiteUrl: z.url().optional(),
  /** ISO date, YYYY-MM-DD. */
  launchDate: z.iso.date().optional(),
  /** ISO 4217 code, e.g. "EUR". All of the project's money uses it. */
  currency: z.string().regex(/^[A-Z]{3}$/),
  pricingSummary: z.string().max(500).default(""),
  targetAudience: z.string().max(500).default(""),
  techStack: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  /** Cash on hand, used for runway. */
  cashBalance: moneySchema.default(0),
  notes: z.string().max(5000).default(""),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type ProjectStage = (typeof PROJECT_STAGES)[number];
