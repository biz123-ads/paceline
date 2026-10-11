import { describe, expect, it } from "vitest";
import {
  formatMoney,
  moneyInputValue,
  formatMonths,
  formatPercent,
  formatPeriod,
  parseCount,
  parseMoney,
  parsePercent,
} from "./format";

describe("parseMoney", () => {
  it.each([
    ["1200", 120000],
    ["1200.5", 120050],
    ["1,200.50", 120050],
    ["1.200,50", 120050],
    ["1200,5", 120050],
    ["1,200", 120000],
    ["1.200", 120000],
    ["1.200.000", 120000000],
    ["€ 1 200", 120000],
    ["0", 0],
  ])("reads %s as %i cents", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.2.3,4,5", "1.5.5,123"])("rejects %s", (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it("reads a dot with three decimals as a thousands separator", () => {
    expect(parseMoney("12.345")).toBe(1234500);
  });
});

describe("other parsers", () => {
  it("writes cents back into inputs", () => {
    expect(moneyInputValue(125050)).toBe("1250.50");
    expect(moneyInputValue(120000)).toBe("1200");
    expect(moneyInputValue(undefined)).toBe("");
  });

  it("parses counts and percentages", () => {
    expect(parseCount("1,234")).toBe(1234);
    expect(parseCount("x")).toBeNull();
    expect(parsePercent("5")).toBeCloseTo(0.05);
    expect(parsePercent("4,5%")).toBeCloseTo(0.045);
    expect(parsePercent("150")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats money from cents", () => {
    expect(formatMoney(120000, "EUR")).toBe("€1,200");
    expect(formatMoney(120050, "EUR")).toBe("€1,200.50");
    expect(formatMoney(1500000, "USD", { compact: true })).toBe("$15K");
    expect(formatMoney(10000, "EUR", { signed: true })).toBe("+€100");
    expect(formatMoney(105309, "EUR", { whole: true })).toBe("€1,053");
  });

  it("formats periods, percentages and durations", () => {
    expect(formatPeriod("2026-09")).toBe("Sep 2026");
    expect(formatPeriod("2026-09", { short: true })).toBe("Sep");
    expect(formatPercent(0.0512)).toBe("5.1%");
    expect(formatPercent(0.05, { signed: true })).toBe("+5%");
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(30)).toBe("2 yrs 6 mo");
    expect(formatMonths(36)).toBe("3 years");
  });
});
