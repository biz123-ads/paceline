import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv } from "@/lib/csv";
import { detectMapping, parseMonth, previewCsv } from "./csv-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const text = '﻿month,note\r\n2026-09,"a, ""quoted"" note"\r\n\r\n2026-10,plain\n';
    expect(parseCsv(text)).toEqual([
      ["month", "note"],
      ["2026-09", 'a, "quoted" note'],
      ["2026-10", "plain"],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(detectDelimiter("mese;mrr;clienti\n2026-09;1.200,50;60")).toBe(";");
    expect(detectDelimiter("month\tmrr")).toBe("\t");
    expect(detectDelimiter("month")).toBe(",");
  });
});

describe("parseMonth", () => {
  it.each([
    ["2026-09", "2026-09"],
    ["2026-9", "2026-09"],
    ["2026-09-30", "2026-09"],
    ["2026/09", "2026-09"],
    ["09/2026", "2026-09"],
    ["30/09/2026", "2026-09"],
    ["01/09/2026", "2026-09"],
    ["9/30/2026", "2026-09"],
    ["Sep 2026", "2026-09"],
    ["September 2026", "2026-09"],
    ["sep-26", "2026-09"],
    ["settembre 2026", "2026-09"],
    ["Set. 2026", "2026-09"],
    ["2026-09-01T00:00:00Z", "2026-09"],
  ])("reads %s", (input, expected) => {
    expect(parseMonth(input)).toBe(expected);
  });

  it.each(["", "2026-13", "13/13/2026", "Foo 2026", "yesterday"])("rejects %s", (input) => {
    expect(parseMonth(input)).toBeNull();
  });
});

describe("detectMapping", () => {
  it("maps English headers and ignores MRR movements", () => {
    const m = detectMapping(["Month", "New MRR", "MRR", "Customers", "New customers", "Churned", "Costs (€)"]);
    expect(m).toEqual({
      period: 0,
      mrr: 2,
      payingCustomers: 3,
      newCustomers: 4,
      churnedCustomers: 5,
      costs: 6,
    });
  });

  it("maps Italian headers", () => {
    const m = detectMapping(["mese", "mrr", "clienti paganti", "nuovi clienti", "clienti persi", "spese"]);
    expect(m).toEqual({
      period: 0,
      mrr: 1,
      payingCustomers: 2,
      newCustomers: 3,
      churnedCustomers: 4,
      costs: 5,
    });
  });

  it("maps loose headers and leaves unknown fields empty", () => {
    const m = detectMapping(["Date", "Monthly recurring revenue", "Total paying customers"]);
    expect(m).toMatchObject({ period: 0, mrr: 1, payingCustomers: 2, newCustomers: null, costs: null });
  });
});

describe("previewCsv", () => {
  it("reads a European export with semicolons and decimal commas", () => {
    const p = previewCsv("mese;mrr;clienti;spese\n2026-08;1.120,00;56;1.450\n2026-09;1.200,50;60;\n");
    expect(p.missingRequired).toEqual([]);
    expect(p.rows).toEqual([
      { line: 2, period: "2026-08", values: { mrr: 112000, payingCustomers: 56, costs: 145000 }, errors: [] },
      { line: 3, period: "2026-09", values: { mrr: 120050, payingCustomers: 60 }, errors: [] },
    ]);
  });

  it("reports row errors and missing required columns", () => {
    const p = previewCsv("month,mrr\n2026-09,abc\nlater,100\n2026-09,100\n");
    expect(p.missingRequired).toEqual(["payingCustomers"]);
    expect(p.rows[0].errors).toEqual(["Monthly revenue: “abc” is not a number."]);
    expect(p.rows[1].errors[0]).toMatch(/not a month/);
    expect(p.rows[2].errors).toEqual(["Same month as line 2."]);
  });

  it("returns nothing for an empty file", () => {
    expect(previewCsv("").rows).toEqual([]);
  });
});
