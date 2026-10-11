import type { Period } from "./period";

/**
 * Display helpers. The product language is English; the locale is fixed so
 * the same numbers render the same everywhere.
 */
const LOCALE = "en-US";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "2026-09" -> "Sep 2026" (or "Sep" with `short`). */
export function formatPeriod(period: Period, opts: { short?: boolean } = {}): string {
  const month = MONTHS[Number(period.slice(5, 7)) - 1];
  return opts.short ? month : `${month} ${period.slice(0, 4)}`;
}

/**
 * Money is stored in cents. Whole amounts drop the decimals; `whole` rounds
 * to whole units, for targets and estimates where cents are false precision.
 */
export function formatMoney(
  cents: number,
  currency: string,
  opts: { compact?: boolean; signed?: boolean; whole?: boolean } = {},
): string {
  const value = opts.whole ? Math.round(cents / 100) : cents / 100;
  const whole = Number.isInteger(value);
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: opts.compact && Math.abs(value) >= 10_000 ? "compact" : "standard",
    minimumFractionDigits: whole || opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : whole ? 0 : 2,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(value);
}

/** The currency's symbol on its own, e.g. "€". */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(LOCALE, { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

/** 0.0512 -> "5.1%". */
export function formatPercent(
  fraction: number,
  opts: { signed?: boolean; digits?: number } = {},
): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.digits ?? 1,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(fraction);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(value);
}

/** 7 -> "7 months", 1 -> "1 month", 30 -> "2 yrs 6 mo". */
export function formatMonths(months: number): string {
  const m = Math.round(months);
  if (m < 24) return `${m} ${m === 1 ? "month" : "months"}`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return rest ? `${years} yrs ${rest} mo` : `${years} years`;
}

/**
 * Parses an amount typed by a person into cents. Accepts "1200", "1,200.50",
 * "1.200,50", "1200,5", "€ 1 200". Returns null when it is not a valid,
 * non-negative amount.
 */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[\s '€$£¥]/g, "").replace(/[A-Za-z]/g, "");
  if (!s || s.startsWith("-")) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the last one is the decimal separator.
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // Only commas: decimal if a single one with 1-2 digits after it.
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length <= 2 ? parts.join(".") : parts.join("");
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    // "1.200.000" or "1.200" (3 digits after) reads as thousands.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = parts.join("");
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Cents -> the plain string shown inside an input: "1200" or "1200.50". */
export function moneyInputValue(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Parses a whole, non-negative count. */
export function parseCount(input: string): number | null {
  const s = input.replace(/[\s,.']/g, "");
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/** Parses "5", "5%", "4,5" as a percentage and returns the fraction. */
export function parsePercent(input: string): number | null {
  const s = input.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s) / 100;
  return value <= 1 ? value : null;
}
