"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { metricSnapshotSchema, type MetricSnapshot, type Project } from "@/domain";
import type { ProjectData } from "@/components/data/hooks";
import { ProjectGate } from "@/components/project/ProjectGate";
import { SourceIcon } from "@/components/project/SourceIcon";
import { CsvImport } from "@/components/project/CsvImport";
import { Button, Card, Select, cx } from "@/components/ui";
import { KeyboardIcon, PlugIcon, PlusIcon, TrashIcon, UploadIcon } from "@/components/icons";
import {
  currencySymbol,
  formatPeriod,
  moneyInputValue,
  parseCount,
  parseMoney,
} from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { addMonths, currentPeriod, type Period } from "@/lib/period";
import { getStorage } from "@/storage";

/** Months offered when adding one: this month and the five years before. */
const SELECTABLE_MONTHS = 60;

/**
 * The add row's inputs point at this form through the `form` attribute,
 * because a <form> cannot wrap a table row. Enter in any of them submits.
 */
const ADD_FORM_ID = "add-month";

type Column = "mrr" | "payingCustomers" | "newCustomers" | "churnedCustomers" | "costs";

const COLUMNS: { key: Column; label: string; money: boolean; required: boolean }[] = [
  { key: "mrr", label: "MRR", money: true, required: true },
  { key: "payingCustomers", label: "Paying customers", money: false, required: true },
  { key: "newCustomers", label: "New customers", money: false, required: false },
  { key: "churnedCustomers", label: "Churned customers", money: false, required: false },
  { key: "costs", label: "Costs", money: true, required: false },
];

type Values = Record<Column, string>;

function toValues(s?: MetricSnapshot): Values {
  return {
    mrr: moneyInputValue(s?.mrr),
    payingCustomers: s ? String(s.payingCustomers) : "",
    newCustomers: s?.newCustomers !== undefined ? String(s.newCustomers) : "",
    churnedCustomers: s?.churnedCustomers !== undefined ? String(s.churnedCustomers) : "",
    costs: moneyInputValue(s?.costs),
  };
}

/** Parses one cell: undefined when empty, null when invalid. */
function parseCell(column: (typeof COLUMNS)[number], raw: string): number | undefined | null {
  if (!raw.trim()) return column.required ? null : undefined;
  return column.money ? parseMoney(raw) : parseCount(raw);
}

/** Validates a row; returns the numbers or the columns that are wrong. */
function parseRow(values: Values):
  | { ok: true; numbers: Partial<Record<Column, number>> }
  | { ok: false; invalid: Column[] } {
  const numbers: Partial<Record<Column, number>> = {};
  const invalid: Column[] = [];
  for (const column of COLUMNS) {
    const parsed = parseCell(column, values[column.key]);
    if (parsed === null) invalid.push(column.key);
    else if (parsed !== undefined) numbers[column.key] = parsed;
  }
  return invalid.length ? { ok: false, invalid } : { ok: true, numbers };
}

function buildSnapshot(
  projectId: string,
  period: Period,
  numbers: Partial<Record<Column, number>>,
  existing?: MetricSnapshot,
): MetricSnapshot {
  const now = nowIso();
  return metricSnapshotSchema.parse({
    id: existing?.id ?? newId(),
    projectId,
    period,
    ...numbers,
    // Editing a synced month by hand makes it a manual one.
    source: "manual",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/** Month to suggest when adding: fill forward if behind, otherwise backfill. */
function suggestPeriod(periods: Period[]): Period {
  const lastFinished = addMonths(currentPeriod(), -1);
  const taken = new Set(periods);
  const latest = [...periods].sort().at(-1);
  if (latest && latest < lastFinished) return addMonths(latest, 1);
  for (let i = 0; i < SELECTABLE_MONTHS; i++) {
    const p = addMonths(lastFinished, -i);
    if (!taken.has(p)) return p;
  }
  return currentPeriod();
}

function nextSuggestion(snapshots: MetricSnapshot[], justAdded: Period): Period {
  return suggestPeriod([...snapshots.map((s) => s.period), justAdded]);
}

const cellInput =
  "num h-9 w-full min-w-24 rounded-md border border-transparent bg-transparent px-2 text-right text-sm outline-none transition-colors placeholder:text-faint hover:border-border-strong focus:border-foreground/40 focus:bg-surface-2 aria-invalid:border-danger/70";

function CellInput({
  column,
  value,
  onChange,
  onBlur,
  invalid,
  currency,
  inputRef,
  period,
  form,
}: {
  column: (typeof COLUMNS)[number];
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid: boolean;
  currency: string;
  inputRef?: Ref<HTMLInputElement>;
  period: Period | null;
  form?: string;
}) {
  return (
    <input
      ref={inputRef}
      form={form}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      inputMode={column.money ? "decimal" : "numeric"}
      placeholder={column.required ? (column.money ? currencySymbol(currency) : "0") : "—"}
      aria-label={`${column.label}${period ? `, ${formatPeriod(period)}` : ""}`}
      aria-invalid={invalid}
      className={cellInput}
    />
  );
}

function SavedRow({ snapshot, project }: { snapshot: MetricSnapshot; project: Project }) {
  const [values, setValues] = useState<Values>(() => toValues(snapshot));
  const [invalid, setInvalid] = useState<Column[]>([]);
  // Saves in flight (one per cell left) and whether the last one just landed.
  const [pending, setPending] = useState(0);
  const [saved, setSaved] = useState(false);

  // Storage changed underneath (an import, another screen): show the new
  // numbers, unless the change is this row's own save, so cells the user is
  // still typing in are kept.
  const [seen, setSeen] = useState(snapshot.updatedAt);
  const [ownWrite, setOwnWrite] = useState<string | null>(null);
  if (seen !== snapshot.updatedAt) {
    setSeen(snapshot.updatedAt);
    if (snapshot.updatedAt !== ownWrite) {
      setValues(toValues(snapshot));
      setInvalid([]);
    }
  }

  async function save() {
    const parsed = parseRow(values);
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      return;
    }
    setInvalid([]);
    const unchanged = COLUMNS.every(
      (c) => parsed.numbers[c.key] === (snapshot[c.key] ?? undefined),
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
      <td className="py-1.5 pr-3 whitespace-nowrap">
        <span className="text-sm">{formatPeriod(snapshot.period)}</span>
        <span role="status" className="ml-2 text-[11px] text-muted">
          {pending > 0 ? "Saving…" : saved ? "Saved" : ""}
        </span>
      </td>
      {COLUMNS.map((column) => (
        <td key={column.key} className="px-1 py-1.5">
          <CellInput
            column={column}
            value={values[column.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [column.key]: v }))}
            onBlur={save}
            invalid={invalid.includes(column.key)}
            currency={project.currency}
            period={snapshot.period}
          />
        </td>
      ))}
      <td className="px-2 py-1.5 text-center text-faint">
        <SourceIcon source={snapshot.source} />
      </td>
      <td className="py-1.5 pl-1">
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

function AddRow({ project, snapshots }: { project: Project; snapshots: MetricSnapshot[] }) {
  const taken = new Set(snapshots.map((s) => s.period));
  const [period, setPeriod] = useState<Period>(() =>
    suggestPeriod(snapshots.map((s) => s.period)),
  );
  const [values, setValues] = useState<Values>(() => toValues());
  const [invalid, setInvalid] = useState<Column[]>([]);
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);

  // The month got filled in some other way (an import, another tab): move on.
  if (taken.has(period)) {
    setPeriod(suggestPeriod(snapshots.map((s) => s.period)));
  }

  useEffect(() => {
    if (window.location.hash === "#add") firstInput.current?.focus();
  }, []);

  const months = Array.from({ length: SELECTABLE_MONTHS + 1 }, (_, i) =>
    addMonths(currentPeriod(), -i),
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    if (taken.has(period)) {
      setError(`${formatPeriod(period)} is already in the table. Edit it there.`);
      return;
    }
    const parsed = parseRow(values);
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      setError(
        parsed.invalid.some((c) => c === "mrr" || c === "payingCustomers")
          ? "MRR and paying customers are needed for every month."
          : "Some numbers could not be read. Use digits, like 1200 or 1,200.50.",
      );
      return;
    }
    await getStorage().snapshots.upsert(buildSnapshot(project.id, period, parsed.numbers));
    setPeriod(nextSuggestion(snapshots, period));
    setValues(toValues());
    setInvalid([]);
    setError(null);
    firstInput.current?.focus();
  }

  return (
    <>
      <tr className="bg-surface-2/60">
        <td className="py-2 pr-3 pl-2">
          <Select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setError(null);
            }}
            aria-label="Month to add"
            className="h-9 w-[8.5rem] min-w-[8.5rem]"
            form={ADD_FORM_ID}
          >
            {months.map((p) => (
              <option key={p} value={p} disabled={taken.has(p)}>
                {formatPeriod(p)}
                {taken.has(p) ? " ✓" : ""}
              </option>
            ))}
          </Select>
        </td>
        {COLUMNS.map((column, i) => (
          <td key={column.key} className="px-1 py-2">
            <CellInput
              column={column}
              value={values[column.key]}
              onChange={(v) => setValues((prev) => ({ ...prev, [column.key]: v }))}
              invalid={invalid.includes(column.key)}
              currency={project.currency}
              inputRef={i === 0 ? firstInput : undefined}
              period={period}
              form={ADD_FORM_ID}
            />
          </td>
        ))}
        <td colSpan={2} className="py-2 pr-2 pl-1">
          <form id={ADD_FORM_ID} onSubmit={add} noValidate>
            <Button type="submit" variant="primary" size="sm" className="w-full">
              <PlusIcon /> Add
            </Button>
          </form>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={COLUMNS.length + 3} className="px-2 pt-1 pb-3 text-xs text-danger">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

function DataTable({ data }: { data: ProjectData }) {
  const { project, snapshots } = data;
  const rows = [...snapshots].reverse();

  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="px-4 pt-4 pb-3 font-normal">Month</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 pt-4 pb-3 text-right font-normal">
                  {c.label}
                  {c.required && <span className="text-muted"> *</span>}
                </th>
              ))}
              <th className="px-2 pt-4 pb-3 text-center font-normal">Source</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="[&>tr>td:first-child]:pl-4">
            <AddRow project={project} snapshots={snapshots} />
            {rows.map((s) => (
              <SavedRow key={s.id} snapshot={s} project={project} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted">
          Start with last month, then work backwards. Three months is enough to
          start planning.
        </p>
      )}
    </Card>
  );
}

function SourceTile({
  icon,
  title,
  text,
  onClick,
  active,
  href,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick?: () => void;
  active?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <span className="mt-0.5 text-muted">{icon}</span>
      <span>
        <span className="block text-sm text-foreground">{title}</span>
        <span className="block text-xs text-faint">{text}</span>
      </span>
    </>
  );
  const base = "flex items-start gap-3 rounded-xl border px-4 py-3 text-left";
  const interactive = "transition-colors hover:border-border-strong hover:bg-surface-2";
  if (href) {
    return (
      <Link href={href} className={cx(base, interactive, "border-border bg-surface")}>
        {body}
      </Link>
    );
  }
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        base,
        interactive,
        active ? "border-border-strong bg-surface-2" : "border-border bg-surface",
      )}
    >
      {body}
    </button>
  ) : (
    <div className={cx(base, "border-dashed border-border-strong")}>{body}</div>
  );
}

function Data({ data }: { data: ProjectData }) {
  // The Import section links here with #import to open the importer.
  // Data renders only in the browser, once the project has loaded.
  const [importing, setImporting] = useState(() => window.location.hash === "#import");
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        One row per month. Only <span className="text-foreground">MRR</span> and{" "}
        <span className="text-foreground">paying customers</span> are required. New and
        churned customers turn churn from an assumption into a measured value; costs
        unlock runway and break-even. Changes save when you leave a cell.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SourceTile icon={<KeyboardIcon />} title="Type it in" text="Straight into the table below." />
        <SourceTile
          icon={<UploadIcon />}
          title="Import a CSV"
          text="From a spreadsheet or an export."
          onClick={() => setImporting((v) => !v)}
          active={importing}
        />
        <SourceTile
          icon={<PlugIcon />}
          title="More sources"
          text="Excel, Google Sheets, Stripe and others."
          href="/import"
        />
      </div>
      {importing && (
        <CsvImport
          project={data.project}
          snapshots={data.snapshots}
          onClose={() => setImporting(false)}
        />
      )}
      <DataTable data={data} />
    </div>
  );
}

export function DataScreen() {
  return <ProjectGate>{(data) => <Data data={data} />}</ProjectGate>;
}

