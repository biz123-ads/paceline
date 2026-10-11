"use client";

import { useRef, useState } from "react";
import { metricSnapshotSchema, type MetricSnapshot, type Project } from "@/domain";
import {
  CSV_TEMPLATE,
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  REQUIRED_FIELDS,
  previewCsv,
  type ColumnMapping,
  type ImportField,
  type ImportPreview,
} from "@/import/csv-import";
import { Button, Card, CardHeader, ScrollX, Select, cx } from "@/components/ui";
import { BrandMark, type ConnectorId } from "@/components/import/ConnectorLogo";
import { DownloadIcon, UploadIcon } from "@/components/icons";
import { formatMoney, formatNumber, formatPeriod } from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { getStorage } from "@/storage";

const PREVIEW_ROWS = 12;

/** Where each spreadsheet app hides its CSV export. */
const SPREADSHEET_EXPORTS: { id: ConnectorId; app: string; path: string }[] = [
  { id: "excel", app: "Excel", path: "File → Save As → CSV UTF-8" },
  { id: "google-sheets", app: "Google Sheets", path: "File → Download → Comma-separated values" },
  { id: "numbers", app: "Numbers", path: "File → Export To → CSV" },
];

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "monthly-numbers-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function MappingSelects({
  preview,
  onChange,
}: {
  preview: ImportPreview;
  onChange: (mapping: ColumnMapping) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {IMPORT_FIELDS.map((field) => (
        <label key={field} className="block">
          <span className="mb-1 block text-xs text-muted">
            {IMPORT_FIELD_LABELS[field]}
            {REQUIRED_FIELDS.includes(field) && <span className="text-faint"> · required</span>}
          </span>
          <Select
            value={preview.mapping[field] ?? ""}
            onChange={(e) =>
              onChange({
                ...preview.mapping,
                [field]: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            aria-invalid={REQUIRED_FIELDS.includes(field) && preview.mapping[field] === null}
          >
            <option value="">Not in file</option>
            {preview.headers.map((h, i) => (
              <option key={i} value={i}>
                {h || `Column ${i + 1}`}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );
}

export function CsvImport({
  project,
  snapshots,
  onClose,
}: {
  project: Project;
  snapshots: MetricSnapshot[];
  onClose: () => void;
}) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function pick(f: File) {
    const text = await f.text();
    setFile({ name: f.name, text });
    setPreview(previewCsv(text));
    setResult(null);
  }

  const existing = new Map(snapshots.map((s) => [s.period, s]));
  const valid = preview?.rows.filter((r) => r.errors.length === 0 && r.period) ?? [];
  const invalid = (preview?.rows.length ?? 0) - valid.length;
  const replacing = valid.filter((r) => existing.has(r.period!)).length;
  const canImport = preview && preview.missingRequired.length === 0 && valid.length > 0;

  async function runImport() {
    if (!canImport) return;
    setBusy(true);
    const storage = getStorage();
    const now = nowIso();
    for (const row of valid) {
      const before = existing.get(row.period!);
      // Columns in the file win; values the file does not have are kept.
      await storage.snapshots.upsert(
        metricSnapshotSchema.parse({
          ...before,
          ...row.values,
          id: before?.id ?? newId(),
          projectId: project.id,
          period: row.period,
          source: "csv",
          createdAt: before?.createdAt ?? now,
          updatedAt: now,
        }),
      );
    }
    setBusy(false);
    setResult(
      `Imported ${valid.length} ${valid.length === 1 ? "month" : "months"}${invalid ? `; skipped ${invalid} with errors` : ""}.`,
    );
    setFile(null);
    setPreview(null);
  }

  const money = (v: number | undefined) =>
    v === undefined ? "—" : formatMoney(v, project.currency);
  const count = (v: number | undefined) => (v === undefined ? "—" : formatNumber(v));

  return (
    <Card>
      <CardHeader
        title="Import from a spreadsheet"
        hint="A CSV file with one row per month. We match the columns and show you a preview before anything is saved."
        action={
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />

      {!preview && (
        <ul className="mb-5 grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-3">
          {SPREADSHEET_EXPORTS.map((s) => (
            <li key={s.id} className="rounded-lg border border-border px-3 py-2">
              <span className="mb-1 flex items-center gap-2 text-foreground">
                <BrandMark id={s.id} size={16} />
                {s.app}
              </span>
              {s.path}
            </li>
          ))}
        </ul>
      )}
      {!preview && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => input.current?.click()}>
            <UploadIcon /> Choose a CSV file
          </Button>
          <Button variant="ghost" onClick={downloadTemplate}>
            <DownloadIcon /> Template
          </Button>
          {result && <p className="text-sm text-foreground">{result}</p>}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        aria-label="CSV file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />

      {preview && file && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            <span className="text-foreground">{file.name}</span> · {preview.rows.length} rows.
            Check the columns we matched:
          </p>
          <MappingSelects
            preview={preview}
            onChange={(mapping: ColumnMapping) => setPreview(previewCsv(file.text, mapping))}
          />

          {preview.missingRequired.length > 0 ? (
            <p className="text-sm text-danger">
              Pick a column for{" "}
              {preview.missingRequired.map((f: ImportField) => IMPORT_FIELD_LABELS[f]).join(", ")}.
            </p>
          ) : (
            <ScrollX label="Import preview">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="pb-2 font-normal">Line</th>
                    <th className="pb-2 font-normal">Month</th>
                    <th className="pb-2 text-right font-normal">Revenue</th>
                    <th className="pb-2 text-right font-normal">Customers</th>
                    <th className="pb-2 text-right font-normal">New</th>
                    <th className="pb-2 text-right font-normal">Left</th>
                    <th className="pb-2 text-right font-normal">Costs</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, PREVIEW_ROWS).map((r) => (
                    <tr key={r.line} className={cx("border-t border-border", r.errors.length > 0 && "text-muted")}>
                      <td className="num py-2 text-faint">{r.line}</td>
                      <td className="py-2">
                        {r.period ? formatPeriod(r.period) : "—"}
                        {r.period && existing.has(r.period) && !r.errors.length && (
                          <span className="ml-2 text-[11px] text-faint">replaces</span>
                        )}
                        {r.errors.length > 0 && (
                          <span className="mt-0.5 block text-xs text-danger">{r.errors.join(" ")}</span>
                        )}
                      </td>
                      <td className="num py-2 text-right">{money(r.values.mrr)}</td>
                      <td className="num py-2 text-right">{count(r.values.payingCustomers)}</td>
                      <td className="num py-2 text-right">{count(r.values.newCustomers)}</td>
                      <td className="num py-2 text-right">{count(r.values.churnedCustomers)}</td>
                      <td className="num py-2 text-right">{money(r.values.costs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > PREVIEW_ROWS && (
                <p className="mt-2 text-xs text-faint">
                  …and {preview.rows.length - PREVIEW_ROWS} more rows.
                </p>
              )}
            </ScrollX>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={runImport} disabled={!canImport || busy}>
              {busy ? "Importing…" : `Import ${valid.length} ${valid.length === 1 ? "month" : "months"}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
            >
              Choose another file
            </Button>
            <span className="text-xs text-muted">
              {replacing > 0 && `${replacing} will replace months you already have. `}
              {invalid > 0 && `${invalid} with errors will be skipped.`}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
