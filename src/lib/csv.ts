/**
 * Minimal CSV reader: quoted fields, escaped quotes (""), CRLF, and the
 * delimiter guessed from the header line (",", ";" or tab). Enough for
 * spreadsheet exports; no dependency.
 */

export type Delimiter = "," | ";" | "\t";

export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = ([",", ";", "\t"] as const).map((d) => ({
    d,
    n: countOutsideQuotes(firstLine, d),
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

function countOutsideQuotes(line: string, char: string): number {
  let inQuotes = false;
  let n = 0;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === char && !inQuotes) n++;
  }
  return n;
}

/** Rows of trimmed cells. Blank lines are dropped. */
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Strip a UTF-8 byte order mark, common in Excel exports.
  const s = text.replace(/^﻿/, "");

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      endCell();
    } else if (c === "\n") {
      endRow();
    } else if (c !== "\r") {
      cell += c;
    }
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}
