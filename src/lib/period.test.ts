import { describe, expect, it } from "vitest";
import {
  addMonths,
  comparePeriods,
  isPeriod,
  monthsBetween,
  periodFromDate,
  periodRange,
} from "./period";

describe("period", () => {
  it("validates the YYYY-MM format", () => {
    expect(isPeriod("2026-10")).toBe(true);
    expect(isPeriod("2026-1")).toBe(false);
    expect(isPeriod("2026-13")).toBe(false);
    expect(isPeriod("2026-10-01")).toBe(false);
  });

  it("builds a period from a date", () => {
    expect(periodFromDate(new Date(2026, 9, 11))).toBe("2026-10");
  });

  it("adds months across year boundaries, forwards and backwards", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-05", 25)).toBe("2028-06");
    expect(addMonths("2026-05", 0)).toBe("2026-05");
  });

  it("counts and compares months", () => {
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
    expect(monthsBetween("2026-02", "2025-11")).toBe(-3);
    expect(comparePeriods("2026-02", "2025-11")).toBeGreaterThan(0);
    expect(comparePeriods("2025-11", "2026-02")).toBeLessThan(0);
    expect(comparePeriods("2026-02", "2026-02")).toBe(0);
  });

  it("lists a range inclusively", () => {
    expect(periodRange("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(periodRange("2026-03", "2026-03")).toEqual(["2026-03"]);
    expect(periodRange("2026-03", "2026-01")).toEqual([]);
  });

  it("rejects invalid periods", () => {
    expect(() => addMonths("nope", 1)).toThrow(/Invalid period/);
  });
});
