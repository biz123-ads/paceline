import { describe, expect, it } from "vitest";
import {
  assumptionsSchema,
  exportBundleSchema,
  goalSchema,
  metricSnapshotSchema,
  projectSchema,
} from "@/domain";

const projectId = "6f1b7a52-3c0e-4a52-9c1f-0d6b1f1f2a10";
const now = "2026-10-11T10:00:00.000Z";

const project = {
  id: projectId,
  name: "My SaaS",
  kind: "saas",
  stage: "launched",
  currency: "EUR",
  createdAt: now,
  updatedAt: now,
};

describe("domain schemas", () => {
  it("fills defaults on a minimal project", () => {
    const parsed = projectSchema.parse(project);
    expect(parsed.userId).toBeNull();
    expect(parsed.techStack).toEqual([]);
    expect(parsed.cashBalance).toBe(0);
  });

  it("rejects a project without a name or with a bad currency", () => {
    expect(projectSchema.safeParse({ ...project, name: "  " }).success).toBe(false);
    expect(projectSchema.safeParse({ ...project, currency: "eur" }).success).toBe(false);
  });

  it("accepts a minimal snapshot and defaults the source to manual", () => {
    const parsed = metricSnapshotSchema.parse({
      id: "0b8c3e0e-1f64-4b8e-8f6a-5d1f0e6a9b11",
      projectId,
      period: "2026-09",
      mrr: 120000,
      payingCustomers: 14,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.source).toBe("manual");
  });

  it("rejects money that is not an integer number of cents", () => {
    const base = {
      id: "0b8c3e0e-1f64-4b8e-8f6a-5d1f0e6a9b11",
      projectId,
      period: "2026-09",
      payingCustomers: 14,
      createdAt: now,
      updatedAt: now,
    };
    expect(metricSnapshotSchema.safeParse({ ...base, mrr: 12.5 }).success).toBe(false);
    expect(metricSnapshotSchema.safeParse({ ...base, mrr: -1 }).success).toBe(false);
    expect(metricSnapshotSchema.safeParse({ ...base, mrr: 100, period: "2026-9" }).success).toBe(false);
  });

  it("requires a positive goal with valid months", () => {
    const base = {
      id: "9d3e7b42-9f1c-4a2d-b2e3-4c5d6e7f8091",
      projectId,
      targetMrr: 1_000_000,
      deadline: "2027-12",
      baselinePeriod: "2026-09",
      baselineMrr: 120_000,
      createdAt: now,
      updatedAt: now,
    };
    expect(goalSchema.parse(base).label).toBe("");
    expect(goalSchema.safeParse({ ...base, targetMrr: 0 }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, deadline: "2027-13" }).success).toBe(false);
  });

  it("defaults every lever to the measured value and keeps rates in range", () => {
    const parsed = assumptionsSchema.parse({ projectId, updatedAt: now });
    expect(parsed).toMatchObject({
      arpu: null,
      monthlyChurnRate: null,
      newCustomersPerMonth: null,
      monthlyCosts: null,
    });
    const bad = { projectId, updatedAt: now, monthlyChurnRate: 1.5 };
    expect(assumptionsSchema.safeParse(bad).success).toBe(false);
  });

  it("validates an export bundle", () => {
    const bundle = {
      version: 1,
      exportedAt: now,
      projects: [project],
      snapshots: [],
      goals: [],
      assumptions: [],
    };
    expect(exportBundleSchema.safeParse(bundle).success).toBe(true);
    expect(exportBundleSchema.safeParse({ ...bundle, version: 2 }).success).toBe(false);
  });
});
