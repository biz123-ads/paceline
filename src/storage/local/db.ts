import Dexie, { type EntityTable } from "dexie";
import { LOCAL_DB_NAME } from "@/config/app";
import type { Assumptions, Goal, MetricSnapshot, Project } from "@/domain";

export class LocalDb extends Dexie {
  projects!: EntityTable<Project, "id">;
  snapshots!: EntityTable<MetricSnapshot, "id">;
  goals!: EntityTable<Goal, "id">;
  assumptions!: EntityTable<Assumptions, "projectId">;

  constructor() {
    super(LOCAL_DB_NAME);
    this.version(1).stores({
      projects: "id",
      // &[projectId+period] enforces one snapshot per project and month.
      snapshots: "id, projectId, &[projectId+period]",
      scenarios: "id, projectId",
      milestones: "id, projectId",
    });
    // v2: forecast scenarios and milestones replaced by a goal and its levers.
    this.version(2).stores({
      scenarios: null,
      milestones: null,
      // &projectId: one goal per project.
      goals: "id, &projectId",
      assumptions: "projectId",
    });
  }
}
