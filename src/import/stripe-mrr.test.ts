import { describe, expect, it } from "vitest";
import {
  endOfMonth,
  monthlyAmount,
  periodOfUnix,
  stripeMonthlySnapshots,
  type StripeSubscriptionLite,
} from "./stripe-mrr";

/** Unix seconds for a UTC date. */
const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 1000;

let n = 0;
function sub(
  overrides: Partial<StripeSubscriptionLite> & {
    amount?: number;
    interval?: string;
    currency?: string;
    quantity?: number;
  } = {},
): StripeSubscriptionLite {
  const { amount = 1900, interval = "month", currency = "eur", quantity, ...rest } = overrides;
  n++;
  return {
    id: `sub_${n}`,
    customer: `cus_${n}`,
    status: "active",
    start_date: at("2026-01-10"),
    ended_at: null,
    trial_end: null,
    items: {
      data: [
        {
          quantity,
          price: { currency, unit_amount: amount, recurring: { interval, interval_count: 1 } },
        },
      ],
    },
    ...rest,
  };
}

describe("month boundaries", () => {
  it("ends a month one second before the next starts (UTC)", () => {
    expect(endOfMonth("2026-02")).toBe(Date.UTC(2026, 2, 1) / 1000 - 1);
    expect(periodOfUnix(endOfMonth("2026-12"))).toBe("2026-12");
    expect(periodOfUnix(endOfMonth("2026-12") + 1)).toBe("2027-01");
  });
});

describe("monthlyAmount", () => {
  it("normalises yearly and weekly prices to a month, times quantity", () => {
    expect(monthlyAmount(sub({ amount: 12000, interval: "year" }), "eur")?.cents).toBe(1000);
    expect(monthlyAmount(sub({ amount: 1200, interval: "week" }), "eur")?.cents).toBe(5200);
    expect(monthlyAmount(sub({ amount: 1000, quantity: 3 }), "eur")?.cents).toBe(3000);
  });

  it("ignores items in another currency and flags metered prices", () => {
    expect(monthlyAmount(sub({ currency: "usd" }), "EUR")).toBeNull();
    const metered = sub();
    metered.items.data[0].price.recurring!.usage_type = "metered";
    expect(monthlyAmount(metered, "eur")).toEqual({ cents: 0, unsupported: true });
  });
});

describe("stripeMonthlySnapshots", () => {
  it("counts revenue, customers, joins and departures month by month", () => {
    const subs = [
      sub({ start_date: at("2026-01-05") }),
      sub({ start_date: at("2026-02-20"), amount: 4900 }),
      // Cancelled during March: counted in Feb, gone at the end of March.
      sub({ start_date: at("2026-01-15"), ended_at: at("2026-03-10"), status: "canceled" }),
    ];
    const result = stripeMonthlySnapshots(subs, "EUR", "2026-04");
    expect(result.months).toEqual([
      { period: "2026-01", mrr: 3800, payingCustomers: 2, newCustomers: 2, churnedCustomers: 0 },
      { period: "2026-02", mrr: 8700, payingCustomers: 3, newCustomers: 1, churnedCustomers: 0 },
      { period: "2026-03", mrr: 6800, payingCustomers: 2, newCustomers: 0, churnedCustomers: 1 },
      { period: "2026-04", mrr: 6800, payingCustomers: 2, newCustomers: 0, churnedCustomers: 0 },
    ]);
  });

  it("counts one customer once, however many subscriptions they have", () => {
    const a = sub({ start_date: at("2026-03-01") });
    const b = sub({ start_date: at("2026-03-02"), customer: { id: a.customer as string } });
    const [march] = stripeMonthlySnapshots([a, b], "eur", "2026-03").months;
    expect(march).toMatchObject({ mrr: 3800, payingCustomers: 1, newCustomers: 1 });
  });

  it("leaves out trials, unpaid starts, free plans and other currencies", () => {
    const subs = [
      sub({ start_date: at("2026-03-01"), trial_end: at("2026-04-15"), status: "active" }),
      sub({ start_date: at("2026-03-01"), status: "incomplete_expired" }),
      sub({ start_date: at("2026-03-01"), amount: 0 }),
      sub({ start_date: at("2026-03-01"), currency: "usd" }),
    ];
    const result = stripeMonthlySnapshots(subs, "eur", "2026-04");
    expect(result.otherCurrency).toBe(1);
    // The trial converts in April, so the history starts there.
    expect(result.months).toEqual([
      { period: "2026-04", mrr: 1900, payingCustomers: 1, newCustomers: 1, churnedCustomers: 0 },
    ]);
  });

  it("returns nothing when no subscription ever paid in the currency", () => {
    const result = stripeMonthlySnapshots([sub({ currency: "usd" })], "eur", "2026-04");
    expect(result).toMatchObject({ months: [], read: 1, otherCurrency: 1 });
  });

  it("keeps only the most recent months", () => {
    const result = stripeMonthlySnapshots([sub({ start_date: at("2020-01-01") })], "eur", "2026-04", 12);
    expect(result.months).toHaveLength(12);
    expect(result.months[0].period).toBe("2025-05");
    // Already a customer before the window: not counted as new.
    expect(result.months[0].newCustomers).toBe(0);
  });
});
