import { describe, expect, it } from "vitest";
import { sampleProjectBundle } from "@/lib/sample-project";
import {
  assumptionsFromRow,
  assumptionsToRow,
  goalFromRow,
  goalToRow,
  projectFromRow,
  projectToRow,
  snapshotFromRow,
  snapshotToRow,
} from "./rows";

/** What PostgREST sends back: offsets instead of Z, int8 as numbers. */
function asReturned(row: Record<string, unknown>, userId = "u1") {
  const out: Record<string, unknown> = { ...row, user_id: userId };
  for (const key of ["created_at", "updated_at"]) {
    if (typeof out[key] === "string") out[key] = (out[key] as string).replace("Z", "+00:00");
  }
  return out;
}

describe("cloud rows", () => {
  const bundle = sampleProjectBundle(new Date("2026-10-11T10:00:00Z"));

  it("round-trips a project, keeping the owner", () => {
    const project = bundle.projects[0];
    const back = projectFromRow(asReturned(projectToRow(project)));
    expect(back).toEqual({ ...project, userId: "u1" });
  });

  it("never sends user_id, so the database sets it", () => {
    expect(projectToRow(bundle.projects[0])).not.toHaveProperty("user_id");
    expect(snapshotToRow(bundle.snapshots[0])).not.toHaveProperty("user_id");
  });

  it("round-trips snapshots, optional numbers as null and back", () => {
    const first = bundle.snapshots[0];
    expect(first.newCustomers).toBeUndefined();
    const row = snapshotToRow(first);
    expect(row.new_customers).toBeNull();
    expect(snapshotFromRow(asReturned(row))).toEqual(first);
    const later = bundle.snapshots[3];
    expect(snapshotFromRow(asReturned(snapshotToRow(later)))).toEqual(later);
  });

  it("round-trips goals and levers", () => {
    const goal = bundle.goals[0];
    expect(goalFromRow(asReturned(goalToRow(goal)))).toEqual(goal);
    const levers = {
      projectId: goal.projectId,
      arpu: 2500,
      monthlyChurnRate: 0.03,
      newCustomersPerMonth: null,
      monthlyCosts: null,
      updatedAt: "2026-10-11T10:00:00.000Z",
    };
    expect(assumptionsFromRow(asReturned(assumptionsToRow(levers)))).toEqual(levers);
  });
});
