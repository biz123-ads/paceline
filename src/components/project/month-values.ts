import { metricSnapshotSchema, type MetricSnapshot } from "@/domain";
import { parseCount, parseMoney, moneyInputValue } from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { addMonths, currentPeriod, type Period } from "@/lib/period";

/**
 * The numbers of one month as typed: shared by the "Add month" dialog, the
 * table on the Data tab and the guided setup.
 */

/** Months offered when adding one: this month and the five years before. */
export const SELECTABLE_MONTHS = 60;

export type MonthField =
  | "mrr"
  | "payingCustomers"
  | "newCustomers"
  | "churnedCustomers"
  | "costs";

export const MONTH_FIELDS: {
  key: MonthField;
  label: string;
  /** Short header for the table. */
  short: string;
  money: boolean;
  required: boolean;
}[] = [
  { key: "mrr", label: "Monthly revenue", short: "Revenue", money: true, required: true },
  { key: "payingCustomers", label: "Paying customers", short: "Customers", money: false, required: true },
  { key: "newCustomers", label: "New customers", short: "New", money: false, required: false },
  { key: "churnedCustomers", label: "Customers who left", short: "Left", money: false, required: false },
  { key: "costs", label: "Costs", short: "Costs", money: true, required: false },
];

export const REQUIRED_MONTH_FIELDS = MONTH_FIELDS.filter((f) => f.required);
export const OPTIONAL_MONTH_FIELDS = MONTH_FIELDS.filter((f) => !f.required);

export type MonthValues = Record<MonthField, string>;

export function toMonthValues(s?: MetricSnapshot): MonthValues {
  return {
    mrr: moneyInputValue(s?.mrr),
    payingCustomers: s ? String(s.payingCustomers) : "",
    newCustomers: s?.newCustomers !== undefined ? String(s.newCustomers) : "",
    churnedCustomers: s?.churnedCustomers !== undefined ? String(s.churnedCustomers) : "",
    costs: moneyInputValue(s?.costs),
  };
}

/** One value: undefined when empty, null when invalid. */
function parseValue(field: (typeof MONTH_FIELDS)[number], raw: string): number | undefined | null {
  if (!raw.trim()) return field.required ? null : undefined;
  return field.money ? parseMoney(raw) : parseCount(raw);
}

export type ParsedMonth =
  | { ok: true; numbers: Partial<Record<MonthField, number>> }
  | { ok: false; invalid: MonthField[] };

export function parseMonthValues(values: MonthValues): ParsedMonth {
  const numbers: Partial<Record<MonthField, number>> = {};
  const invalid: MonthField[] = [];
  for (const field of MONTH_FIELDS) {
    const parsed = parseValue(field, values[field.key]);
    if (parsed === null) invalid.push(field.key);
    else if (parsed !== undefined) numbers[field.key] = parsed;
  }
  return invalid.length ? { ok: false, invalid } : { ok: true, numbers };
}

/** The message for a month that did not parse. */
export function monthError(invalid: MonthField[]): string {
  return invalid.some((f) => f === "mrr" || f === "payingCustomers")
    ? "Monthly revenue and paying customers are needed for every month."
    : "Some numbers could not be read. Use digits, like 1200 or 1,200.50.";
}

export function buildSnapshot(
  projectId: string,
  period: Period,
  numbers: Partial<Record<MonthField, number>>,
  existing?: MetricSnapshot,
): MetricSnapshot {
  const now = nowIso();
  return metricSnapshotSchema.parse({
    id: existing?.id ?? newId(),
    projectId,
    period,
    ...numbers,
    // Editing a synced month by hand makes it a manual one.
    source: "manual",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/** Month to suggest when adding: fill forward if behind, otherwise backfill. */
export function suggestPeriod(periods: Period[], now?: Date): Period {
  const lastFinished = addMonths(currentPeriod(now), -1);
  const taken = new Set(periods);
  const latest = [...periods].sort().at(-1);
  if (latest && latest < lastFinished) return addMonths(latest, 1);
  for (let i = 0; i < SELECTABLE_MONTHS; i++) {
    const p = addMonths(lastFinished, -i);
    if (!taken.has(p)) return p;
  }
  return currentPeriod(now);
}

/** This month and the SELECTABLE_MONTHS before it, newest first. */
export function selectableMonths(now?: Date): Period[] {
  return Array.from({ length: SELECTABLE_MONTHS + 1 }, (_, i) =>
    addMonths(currentPeriod(now), -i),
  );
}
