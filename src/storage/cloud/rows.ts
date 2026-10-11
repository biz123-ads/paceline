import {
  assumptionsSchema,
  goalSchema,
  metricSnapshotSchema,
  projectSchema,
  type Assumptions,
  type Goal,
  type MetricSnapshot,
  type Project,
} from "@/domain";

/**
 * Domain objects (camelCase, undefined for "not set") <-> Postgres rows
 * (snake_case, null). user_id is never sent: the database fills it from the
 * session and Row Level Security checks it.
 */

type Row = Record<string, unknown>;

/** Postgres returns "2026-10-11T10:00:00+00:00"; the domain wants "…Z". */
function iso(value: unknown): string {
  return new Date(value as string).toISOString();
}

/** null -> undefined, for optional domain fields. */
function opt<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function projectToRow(p: Project): Row {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    kind: p.kind,
    stage: p.stage,
    website_url: p.websiteUrl ?? null,
    launch_date: p.launchDate ?? null,
    currency: p.currency,
    pricing_summary: p.pricingSummary,
    target_audience: p.targetAudience,
    tech_stack: p.techStack,
    cash_balance: p.cashBalance,
    notes: p.notes,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function projectFromRow(r: Row): Project {
  return projectSchema.parse({
    id: r.id,
    userId: r.user_id ?? null,
    name: r.name,
    description: r.description,
    kind: r.kind,
    stage: r.stage,
    websiteUrl: opt(r.website_url),
    launchDate: opt(r.launch_date),
    currency: r.currency,
    pricingSummary: r.pricing_summary,
    targetAudience: r.target_audience,
    techStack: r.tech_stack,
    cashBalance: Number(r.cash_balance),
    notes: r.notes,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });
}

const SNAPSHOT_NUMBERS = [
  ["mrr", "mrr"],
  ["payingCustomers", "paying_customers"],
  ["newMrr", "new_mrr"],
  ["expansionMrr", "expansion_mrr"],
  ["contractionMrr", "contraction_mrr"],
  ["churnedMrr", "churned_mrr"],
  ["newCustomers", "new_customers"],
  ["churnedCustomers", "churned_customers"],
  ["costs", "costs"],
] as const;

export function snapshotToRow(s: MetricSnapshot): Row {
  const row: Row = {
    id: s.id,
    project_id: s.projectId,
    period: s.period,
    source: s.source,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
  for (const [field, column] of SNAPSHOT_NUMBERS) row[column] = s[field] ?? null;
  return row;
}

export function snapshotFromRow(r: Row): MetricSnapshot {
  const numbers: Record<string, number | undefined> = {};
  for (const [field, column] of SNAPSHOT_NUMBERS) {
    numbers[field] = r[column] === null || r[column] === undefined ? undefined : Number(r[column]);
  }
  return metricSnapshotSchema.parse({
    id: r.id,
    projectId: r.project_id,
    period: r.period,
    ...numbers,
    source: r.source,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });
}

export function goalToRow(g: Goal): Row {
  return {
    id: g.id,
    project_id: g.projectId,
    label: g.label,
    target_mrr: g.targetMrr,
    deadline: g.deadline,
    baseline_period: g.baselinePeriod,
    baseline_mrr: g.baselineMrr,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
  };
}

export function goalFromRow(r: Row): Goal {
  return goalSchema.parse({
    id: r.id,
    projectId: r.project_id,
    label: r.label,
    targetMrr: Number(r.target_mrr),
    deadline: r.deadline,
    baselinePeriod: r.baseline_period,
    baselineMrr: Number(r.baseline_mrr),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function assumptionsToRow(a: Assumptions): Row {
  return {
    project_id: a.projectId,
    arpu: a.arpu,
    monthly_churn_rate: a.monthlyChurnRate,
    new_customers_per_month: a.newCustomersPerMonth,
    monthly_costs: a.monthlyCosts,
    updated_at: a.updatedAt,
  };
}

export function assumptionsFromRow(r: Row): Assumptions {
  return assumptionsSchema.parse({
    projectId: r.project_id,
    arpu: num(r.arpu),
    monthlyChurnRate: num(r.monthly_churn_rate),
    newCustomersPerMonth: num(r.new_customers_per_month),
    monthlyCosts: num(r.monthly_costs),
    updatedAt: iso(r.updated_at),
  });
}
