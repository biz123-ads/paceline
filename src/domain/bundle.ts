import { z } from "zod";
import { projectSchema } from "./project";
import { metricSnapshotSchema } from "./snapshot";
import { assumptionsSchema, goalSchema } from "./goal";

/**
 * Everything a user owns, as one JSON file. Used for backup/restore in v1
 * (data lives in the browser) and later to claim local data into an account.
 */
export const exportBundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  projects: z.array(projectSchema),
  snapshots: z.array(metricSnapshotSchema),
  goals: z.array(goalSchema),
  assumptions: z.array(assumptionsSchema),
});

export type ExportBundle = z.infer<typeof exportBundleSchema>;
