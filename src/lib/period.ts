/**
 * A "period" is a calendar month written as "YYYY-MM". It sorts correctly as a
 * plain string and is the unique key of a metric snapshot within a project.
 */
export type Period = string;

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPeriod(value: string): value is Period {
  return PERIOD_RE.test(value);
}

function parse(period: Period): { year: number; month: number } {
  if (!isPeriod(period)) throw new Error(`Invalid period: "${period}"`);
  return { year: Number(period.slice(0, 4)), month: Number(period.slice(5, 7)) };
}

function format(year: number, month: number): Period {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Period of a date, in the local time zone. */
export function periodFromDate(date: Date): Period {
  return format(date.getFullYear(), date.getMonth() + 1);
}

export function currentPeriod(now: Date = new Date()): Period {
  return periodFromDate(now);
}

export function addMonths(period: Period, months: number): Period {
  const { year, month } = parse(period);
  const total = year * 12 + (month - 1) + months;
  return format(Math.floor(total / 12), (total % 12) + 1);
}

/** Whole months from `from` to `to` (negative if `to` is earlier). */
export function monthsBetween(from: Period, to: Period): number {
  const a = parse(from);
  const b = parse(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function comparePeriods(a: Period, b: Period): number {
  return monthsBetween(b, a);
}

/** Every period from `from` to `to`, both included. Empty if `to` < `from`. */
export function periodRange(from: Period, to: Period): Period[] {
  const count = monthsBetween(from, to);
  return count < 0
    ? []
    : Array.from({ length: count + 1 }, (_, i) => addMonths(from, i));
}
