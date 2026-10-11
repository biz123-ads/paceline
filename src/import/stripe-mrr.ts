import { addMonths, periodRange, type Period } from "@/lib/period";

/**
 * Turns Stripe subscriptions into one row per month: revenue, paying
 * customers, and who joined or left. Pure, so it is tested without Stripe.
 *
 * A subscription counts in a month when it is paying at the month's end:
 * started, not ended, not in a free trial, and never stuck before its first
 * payment (incomplete). Amounts use each item's current price before
 * discounts, normalised to a month (yearly / 12, weekly × 52 / 12).
 */

/** The few fields we read; a Stripe.Subscription satisfies it. */
export interface StripeSubscriptionLite {
  id: string;
  customer: string | { id: string };
  status: string;
  /** Unix seconds. */
  start_date: number;
  ended_at: number | null;
  trial_end: number | null;
  items: {
    data: {
      quantity?: number;
      price: {
        currency: string;
        unit_amount: number | null;
        recurring: {
          interval: "day" | "week" | "month" | "year" | string;
          interval_count: number;
          usage_type?: string;
        } | null;
      };
    }[];
  };
}

export interface StripeMonth {
  period: Period;
  /** Cents, in the requested currency. */
  mrr: number;
  payingCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
}

export interface StripeImportResult {
  months: StripeMonth[];
  /** Subscriptions read in total. */
  read: number;
  /** Paid at some point, but in another currency: left out. */
  otherCurrency: number;
  /** Metered or tiered prices: no fixed monthly amount to count. */
  unsupportedPrices: number;
}

/** Statuses that never took a payment. */
const NEVER_PAID = new Set(["incomplete", "incomplete_expired"]);

const MONTHLY_FACTOR: Record<string, number> = {
  day: 365 / 12,
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
};

/** Last instant of a month, as unix seconds (UTC). */
export function endOfMonth(period: Period): number {
  const [year, month] = period.split("-").map(Number);
  return Date.UTC(year, month, 1) / 1000 - 1;
}

export function periodOfUnix(seconds: number): Period {
  const d = new Date(seconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A subscription's monthly amount in `currency`, in cents; null if it has none. */
export function monthlyAmount(
  sub: StripeSubscriptionLite,
  currency: string,
): { cents: number; unsupported: boolean } | null {
  let cents = 0;
  let matched = false;
  let unsupported = false;
  for (const item of sub.items.data) {
    const price = item.price;
    if (price.currency.toLowerCase() !== currency.toLowerCase()) continue;
    matched = true;
    const recurring = price.recurring;
    const factor = recurring ? MONTHLY_FACTOR[recurring.interval] : undefined;
    if (
      !recurring ||
      factor === undefined ||
      recurring.usage_type === "metered" ||
      price.unit_amount === null
    ) {
      unsupported = true;
      continue;
    }
    cents += (price.unit_amount * (item.quantity ?? 1) * factor) / Math.max(1, recurring.interval_count);
  }
  return matched ? { cents, unsupported } : null;
}

function customerId(sub: StripeSubscriptionLite): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

function payingAt(sub: StripeSubscriptionLite, at: number): boolean {
  if (NEVER_PAID.has(sub.status)) return false;
  if (sub.start_date > at) return false;
  if (sub.ended_at !== null && sub.ended_at <= at) return false;
  // Still in a free trial at that moment.
  if (sub.trial_end !== null && sub.trial_end > at) return false;
  return true;
}

/**
 * Months from the first paying subscription up to `to` (usually the last
 * finished month), at most `maxMonths` of them.
 */
export function stripeMonthlySnapshots(
  subscriptions: StripeSubscriptionLite[],
  currency: string,
  to: Period,
  maxMonths = 60,
): StripeImportResult {
  const counted: { sub: StripeSubscriptionLite; cents: number }[] = [];
  let otherCurrency = 0;
  let unsupportedPrices = 0;
  for (const sub of subscriptions) {
    if (NEVER_PAID.has(sub.status)) continue;
    const amount = monthlyAmount(sub, currency);
    if (!amount) {
      otherCurrency++;
      continue;
    }
    if (amount.unsupported) unsupportedPrices++;
    // A free plan is not a paying customer.
    else if (amount.cents === 0) continue;
    counted.push({ sub, cents: amount.cents });
  }

  const firstStart = Math.min(
    ...counted.map(({ sub }) => Math.max(sub.start_date, sub.trial_end ?? 0)),
  );
  if (!Number.isFinite(firstStart)) {
    return { months: [], read: subscriptions.length, otherCurrency, unsupportedPrices };
  }
  const earliest = addMonths(to, -(maxMonths - 1));
  const first = [periodOfUnix(firstStart), earliest].sort().at(-1)!;
  if (first > to) {
    return { months: [], read: subscriptions.length, otherCurrency, unsupportedPrices };
  }

  const activeAt = (at: number) => {
    const customers = new Set<string>();
    let cents = 0;
    for (const { sub, cents: amount } of counted) {
      if (!payingAt(sub, at)) continue;
      customers.add(customerId(sub));
      cents += amount;
    }
    return { customers, cents };
  };

  let before = activeAt(endOfMonth(addMonths(first, -1))).customers;
  const months: StripeMonth[] = [];
  for (const period of periodRange(first, to)) {
    const now = activeAt(endOfMonth(period));
    let joined = 0;
    let left = 0;
    for (const c of now.customers) if (!before.has(c)) joined++;
    for (const c of before) if (!now.customers.has(c)) left++;
    months.push({
      period,
      mrr: Math.round(now.cents),
      payingCustomers: now.customers.size,
      newCustomers: joined,
      churnedCustomers: left,
    });
    before = now.customers;
  }
  return { months, read: subscriptions.length, otherCurrency, unsupportedPrices };
}
