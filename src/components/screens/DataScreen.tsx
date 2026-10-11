"use client";

import { useState, type ReactNode } from "react";
import type { MetricSnapshot, Project } from "@/domain";
import type { ProjectData } from "@/components/data/hooks";
import { useAddMonth } from "@/components/project/AddMonth";
import { CsvImport } from "@/components/project/CsvImport";
import { StripeImport } from "@/components/project/StripeImport";
import { ProjectGate } from "@/components/project/ProjectGate";
import { SourceIcon } from "@/components/project/SourceIcon";
import { ConnectorLogo } from "@/components/import/ConnectorLogo";
import { Hint } from "@/components/overlay";
import { GLOSSARY } from "@/components/project/glossary";
import {
  MONTH_FIELDS,
  buildSnapshot,
  parseMonthValues,
  toMonthValues,
  type MonthField,
  type MonthValues,
} from "@/components/project/month-values";
import { Button, Card, cx } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { currencySymbol, formatPeriod } from "@/lib/format";
import { getStorage } from "@/storage";

const HEADER_HINTS: Partial<Record<MonthField, string>> = {
  mrr: GLOSSARY.revenue,
  payingCustomers: GLOSSARY.customers,
  newCustomers: GLOSSARY.newCustomers,
  churnedCustomers: GLOSSARY.churn,
  costs: GLOSSARY.costs,
};

const cellInput =
  "num h-9 w-full min-w-20 rounded-md border border-transparent bg-transparent px-2 text-right text-sm outline-none transition-colors placeholder:text-faint hover:border-border-strong focus:border-foreground/40 focus:bg-surface-2 aria-invalid:border-danger/70";

function MonthRow({
  snapshot,
  project,
  fields,
}: {
  snapshot: MetricSnapshot;
  project: Project;
  fields: typeof MONTH_FIELDS;
}) {
  const [values, setValues] = useState<MonthValues>(() => toMonthValues(snapshot));
  const [invalid, setInvalid] = useState<MonthField[]>([]);
  // Saves in flight (one per cell left) and whether the last one just landed.
  const [pending, setPending] = useState(0);
  const [saved, setSaved] = useState(false);

  // Storage changed underneath (an import, the dialog): show the new numbers,
  // unless the change is this row's own save, so cells being typed in are kept.
  const [seen, setSeen] = useState(snapshot.updatedAt);
  const [ownWrite, setOwnWrite] = useState<string | null>(null);
  if (seen !== snapshot.updatedAt) {
    setSeen(snapshot.updatedAt);
    if (snapshot.updatedAt !== ownWrite) {
      setValues(toMonthValues(snapshot));
      setInvalid([]);
    }
  }

  async function save() {
    const parsed = parseMonthValues(values);
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      return;
    }
    setInvalid([]);
    const unchanged = MONTH_FIELDS.every(
      (f) => parsed.numbers[f.key] === (snapshot[f.key] ?? undefined),
    );
    if (unchanged) return;
    const next = buildSnapshot(project.id, snapshot.period, parsed.numbers, snapshot);
    setOwnWrite(next.updatedAt);
    setPending((n) => n + 1);
    setSaved(false);
    try {
      await getStorage().snapshots.upsert(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setPending((n) => n - 1);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${formatPeriod(snapshot.period)}? This cannot be undone.`)) return;
    await getStorage().snapshots.remove(snapshot.id);
  }

  return (
    <tr className="group border-t border-border">
      <td className="py-1.5 pr-3 pl-4 whitespace-nowrap">
        <span className="text-sm">{formatPeriod(snapshot.period)}</span>
        <span role="status" className="ml-2 text-[11px] text-muted">
          {pending > 0 ? "Saving…" : saved ? "Saved" : ""}
        </span>
      </td>
      {fields.map((field) => (
        <td key={field.key} className="px-1 py-1.5">
          <input
            value={values[field.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            onBlur={save}
            inputMode={field.money ? "decimal" : "numeric"}
            placeholder={field.required ? (field.money ? currencySymbol(project.currency) : "0") : "—"}
            aria-label={`${field.label}, ${formatPeriod(snapshot.period)}`}
            aria-invalid={invalid.includes(field.key)}
            className={cellInput}
          />
        </td>
      ))}
      <td className="px-2 py-1.5 text-center text-faint">
        <SourceIcon source={snapshot.source} />
      </td>
      <td className="py-1.5 pr-2 pl-1">
        <button
          type="button"
          onClick={remove}
          aria-label={`Delete ${formatPeriod(snapshot.period)}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint opacity-60 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}

function MonthsTable({ data }: { data: ProjectData }) {
  const { project, snapshots } = data;
  const addMonth = useAddMonth();
  const rows = [...snapshots].reverse();
  // Extra columns start open when the data already uses them.
  const [showAll, setShowAll] = useState(() =>
    snapshots.some(
      (s) => s.newCustomers !== undefined || s.churnedCustomers !== undefined || s.costs !== undefined,
    ),
  );
  const fields = showAll ? MONTH_FIELDS : MONTH_FIELDS.filter((f) => f.required);

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center py-12 text-center">
        <p className="font-medium">No months yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Add last month&apos;s revenue and paying customers, or import them from a
          spreadsheet or Stripe above.
        </p>
        <Button variant="primary" className="mt-5" onClick={() => addMonth()}>
          <PlusIcon /> Add a month
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <p className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "month" : "months"} · click a number to change it
        </p>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-pressed={showAll}
          className="text-xs text-muted underline hover:text-foreground"
        >
          {showAll ? "Fewer columns" : "More columns: new, left, costs"}
        </button>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className={cx("w-full text-sm", showAll ? "min-w-[760px]" : "min-w-[440px]")}>
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="px-4 pt-2 pb-3 font-normal">Month</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 pt-2 pb-3 text-right font-normal">
                  {f.short}
                  {HEADER_HINTS[f.key] && (
                    <Hint term={f.label.toLowerCase()} align="right">
                      {HEADER_HINTS[f.key]}
                    </Hint>
                  )}
                </th>
              ))}
              <th className="px-2 pt-2 pb-3 text-center font-normal">Source</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <MonthRow key={s.id} snapshot={s} project={project} fields={fields} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SourceTile({
  logo,
  title,
  text,
  onClick,
  active,
}: {
  logo: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2",
        active ? "border-border-strong bg-surface-2" : "border-border bg-surface",
      )}
    >
      {logo}
      <span>
        <span className="block text-sm text-foreground">{title}</span>
        <span className="block text-xs text-faint">{text}</span>
      </span>
    </button>
  );
}

type Importer = "csv" | "stripe" | null;

function Data({ data }: { data: ProjectData }) {
  const addMonth = useAddMonth();
  // The setup links here with #import or #stripe to open an importer.
  // Data renders only in the browser, once the project has loaded.
  const [importer, setImporter] = useState<Importer>(() =>
    window.location.hash === "#import" ? "csv" : window.location.hash === "#stripe" ? "stripe" : null,
  );
  const toggle = (which: Exclude<Importer, null>) =>
    setImporter((current) => (current === which ? null : which));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => addMonth()}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted">
            <PlusIcon />
          </span>
          <span>
            <span className="block text-sm text-foreground">Type it in</span>
            <span className="block text-xs text-faint">One month at a time.</span>
          </span>
        </button>
        <SourceTile
          logo={<ConnectorLogo id="csv" />}
          title="Import a spreadsheet"
          text="Excel, Google Sheets, Numbers (CSV)."
          onClick={() => toggle("csv")}
          active={importer === "csv"}
        />
        <SourceTile
          logo={<ConnectorLogo id="stripe" />}
          title="Import from Stripe"
          text="Revenue and customers, month by month."
          onClick={() => toggle("stripe")}
          active={importer === "stripe"}
        />
      </div>
      {importer === "csv" && (
        <CsvImport project={data.project} snapshots={data.snapshots} onClose={() => setImporter(null)} />
      )}
      {importer === "stripe" && (
        <StripeImport project={data.project} snapshots={data.snapshots} onClose={() => setImporter(null)} />
      )}
      <MonthsTable data={data} />
    </div>
  );
}

export function DataScreen() {
  return <ProjectGate>{(data) => <Data data={data} />}</ProjectGate>;
}
