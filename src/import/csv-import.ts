import { parseCount, parseMoney } from "@/lib/format";
import { parseCsv } from "@/lib/csv";
import { isPeriod, type Period } from "@/lib/period";

/**
 * Turns a spreadsheet export into monthly snapshot values. Pure: the screen
 * shows the preview and decides what to save.
 */

export const IMPORT_FIELDS = [
  "period",
  "mrr",
  "payingCustomers",
  "newCustomers",
  "churnedCustomers",
  "costs",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  period: "Month",
  mrr: "MRR",
  payingCustomers: "Paying customers",
  newCustomers: "New customers",
  churnedCustomers: "Churned customers",
  costs: "Costs",
};

export const REQUIRED_FIELDS: ImportField[] = ["period", "mrr", "payingCustomers"];

/** Column index for each field, or null when the file does not have it. */
export type ColumnMapping = Record<ImportField, number | null>;

// Exact header names (English and Italian), tried before the looser hints.
const HEADER_EXACT: Record<ImportField, string[]> = {
  period: ["month", "period", "date", "mese", "periodo", "data"],
  mrr: ["mrr", "monthly recurring revenue", "ricavi ricorrenti mensili"],
  payingCustomers: ["paying customers", "customers", "active customers", "clienti", "clienti paganti", "subscribers", "abbonati"],
  newCustomers: ["new customers", "new", "nuovi clienti", "nuovi"],
  churnedCustomers: ["churned customers", "churned", "lost customers", "clienti persi", "persi"],
  costs: ["costs", "cost", "expenses", "costi", "spese"],
};

// Looser hints for headers like "Total paying customers" or "Monthly costs (€)".
const HEADER_HINTS: Record<ImportField, RegExp> = {
  period: /\b(month|period|date|mese|periodo)\b/,
  mrr: /\bmrr\b|recurring revenue/,
  payingCustomers: /customer|client|subscriber|abbonat/,
  newCustomers: /\b(new|nuovi)\b/,
  churnedCustomers: /churn|lost|cancel|persi|disdett/,
  costs: /cost|expense|spend|spes/,
};

// MRR movements ("new MRR", "churned MRR") are not plain MRR.
const MRR_MOVEMENT = /new|expansion|contraction|churn|lost/;

function normalise(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Guesses which column holds which field from the header row. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null])) as ColumnMapping;
  const names = headers.map(normalise);
  const taken = new Set<number>();
  const claim = (field: ImportField, index: number) => {
    mapping[field] = index;
    taken.add(index);
  };

  for (const field of IMPORT_FIELDS) {
    const index = names.findIndex((h, i) => !taken.has(i) && HEADER_EXACT[field].includes(h));
    if (index >= 0) claim(field, index);
  }
  // New and churned before the generic "customers" hint, which matches them too.
  const order: ImportField[] = ["period", "mrr", "newCustomers", "churnedCustomers", "payingCustomers", "costs"];
  for (const field of order) {
    if (mapping[field] !== null) continue;
    const index = names.findIndex(
      (h, i) =>
        !taken.has(i) &&
        HEADER_HINTS[field].test(h) &&
        !(field === "mrr" && MRR_MOVEMENT.test(h)) &&
        // A "new customers" column is not the paying-customers total…
        !(field === "payingCustomers" && /new|nuovi|churn|lost|persi/.test(h)) &&
        // …and "new MRR" is not a count of customers.
        !((field === "newCustomers" || field === "churnedCustomers") && /mrr|revenue|ricav/.test(h)),
    );
    if (index >= 0) claim(field, index);
  }
  return mapping;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, gen: 1, gennaio: 1,
  feb: 2, february: 2, febbraio: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, aprile: 4,
  may: 5, mag: 5, maggio: 5,
  jun: 6, june: 6, giu: 6, giugno: 6,
  jul: 7, july: 7, lug: 7, luglio: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, set: 9, settembre: 9,
  oct: 10, october: 10, ott: 10, ottobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, dic: 12, dicembre: 12,
};

function toPeriod(year: number, month: number): Period | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || year < 1990 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Reads a month in the common spreadsheet shapes: 2026-09, 2026-09-30,
 * 2026/09, 09/2026, 30/09/2026 (day first), Sep 2026, settembre 2026, Sep-26.
 */
export function parseMonth(input: string): Period | null {
  const s = input.trim().toLowerCase();
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?(?:[t ].*)?$/))) {
    return toPeriod(Number(m[1]), Number(m[2]));
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{4})$/))) {
    return toPeriod(Number(m[2]), Number(m[1]));
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    const [a, b, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    // Day first (European) unless that cannot be a month and the other can.
    const month = b <= 12 ? b : a <= 12 ? a : 0;
    return toPeriod(year, month);
  }
  if ((m = s.match(/^([a-zà-ù]+)\.?[\s\-/']*(\d{2}|\d{4})$/))) {
    const month = MONTH_NAMES[m[1]];
    return month ? toPeriod(Number(m[2]), month) : null;
  }
  return isPeriod(s) ? s : null;
}

export interface ImportedRow {
  /** 1-based line in the file, header included, for error messages. */
  line: number;
  period: Period | null;
  values: Partial<Record<Exclude<ImportField, "period">, number>>;
  errors: string[];
}

export interface ImportPreview {
  headers: string[];
  mapping: ColumnMapping;
  rows: ImportedRow[];
  /** Fields the file is missing that are required. */
  missingRequired: ImportField[];
}

export function readRows(cells: string[][], mapping: ColumnMapping): ImportedRow[] {
  const seen = new Map<Period, number>();
  return cells.slice(1).map((row, i) => {
    const line = i + 2;
    const errors: string[] = [];
    const cell = (field: ImportField) => {
      const index = mapping[field];
      return index === null ? "" : (row[index] ?? "");
    };

    const rawPeriod = cell("period");
    const period = rawPeriod ? parseMonth(rawPeriod) : null;
    if (!rawPeriod) errors.push("Month is empty.");
    else if (!period) errors.push(`“${rawPeriod}” is not a month we can read.`);
    else if (seen.has(period)) errors.push(`Same month as line ${seen.get(period)}.`);
    if (period && !seen.has(period)) seen.set(period, line);

    const values: ImportedRow["values"] = {};
    for (const field of IMPORT_FIELDS) {
      if (field === "period" || mapping[field] === null) continue;
      const raw = cell(field);
      if (!raw) {
        if (REQUIRED_FIELDS.includes(field)) {
          errors.push(`${IMPORT_FIELD_LABELS[field]} is empty.`);
        }
        continue;
      }
      const money = field === "mrr" || field === "costs";
      const parsed = money ? parseMoney(raw) : parseCount(raw);
      if (parsed === null) errors.push(`${IMPORT_FIELD_LABELS[field]}: “${raw}” is not a number.`);
      else values[field] = parsed;
    }
    return { line, period, values, errors };
  });
}

export function previewCsv(text: string, mapping?: ColumnMapping): ImportPreview {
  const cells = parseCsv(text);
  const headers = cells[0] ?? [];
  const resolved = mapping ?? detectMapping(headers);
  return {
    headers,
    mapping: resolved,
    rows: headers.length ? readRows(cells, resolved) : [],
    missingRequired: REQUIRED_FIELDS.filter((f) => resolved[f] === null),
  };
}

/** A template users can download and fill in. */
export const CSV_TEMPLATE =
  "month,mrr,paying_customers,new_customers,churned_customers,costs\n" +
  "2026-07,1040,52,7,2,1400\n" +
  "2026-08,1120,56,7,3,1450\n" +
  "2026-09,1200,60,7,3,1500\n";
