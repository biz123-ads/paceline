"use client";

import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { MetricSnapshot, Project } from "@/domain";
import { useProjectData } from "@/components/data/hooks";
import { Dialog, Hint } from "@/components/overlay";
import { Button, Field, Select, TextInput, cx } from "@/components/ui";
import { ChevronDownIcon } from "@/components/icons";
import { currencySymbol, formatPeriod } from "@/lib/format";
import type { Period } from "@/lib/period";
import { getStorage } from "@/storage";
import { GLOSSARY } from "./glossary";
import {
  OPTIONAL_MONTH_FIELDS,
  REQUIRED_MONTH_FIELDS,
  buildSnapshot,
  monthError,
  parseMonthValues,
  selectableMonths,
  suggestPeriod,
  toMonthValues,
  type MonthField,
  type MonthValues,
} from "./month-values";

const HINTS: Record<MonthField, string> = {
  mrr: GLOSSARY.revenue,
  payingCustomers: GLOSSARY.customers,
  newCustomers: GLOSSARY.newCustomers,
  churnedCustomers: "Paying customers who cancelled during the month. Turns churn from a guess into a measured value.",
  costs: GLOSSARY.costs,
};

function MonthInput({
  field,
  value,
  onChange,
  invalid,
  currency,
  autoFocus,
}: {
  field: (typeof REQUIRED_MONTH_FIELDS)[number];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  currency: string;
  autoFocus?: boolean;
}) {
  return (
    <Field
      label={field.label}
      tip={<Hint term={field.label.toLowerCase()}>{HINTS[field.key]}</Hint>}
    >
      <div className="relative">
        {field.money && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
            {currencySymbol(currency)}
          </span>
        )}
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={field.money ? "decimal" : "numeric"}
          placeholder={field.required ? "0" : "Optional"}
          aria-invalid={invalid}
          autoFocus={autoFocus}
          className={cx("num", field.money && "pl-7")}
        />
      </div>
    </Field>
  );
}

function MonthForm({
  project,
  snapshots,
  initialPeriod,
  onClose,
}: {
  project: Project;
  snapshots: MetricSnapshot[];
  initialPeriod?: Period;
  onClose: () => void;
}) {
  const byPeriod = new Map(snapshots.map((s) => [s.period, s]));
  const [period, setPeriod] = useState<Period>(
    () => initialPeriod ?? suggestPeriod(snapshots.map((s) => s.period)),
  );
  const [values, setValues] = useState<MonthValues>(() => toMonthValues(byPeriod.get(period)));
  const [more, setMore] = useState(() =>
    OPTIONAL_MONTH_FIELDS.some((f) => values[f.key] !== ""),
  );
  const [invalid, setInvalid] = useState<MonthField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Period | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = byPeriod.get(period);

  function pickPeriod(next: Period) {
    setPeriod(next);
    const current = byPeriod.get(next);
    const nextValues = toMonthValues(current);
    setValues(nextValues);
    if (OPTIONAL_MONTH_FIELDS.some((f) => nextValues[f.key] !== "")) setMore(true);
    setInvalid([]);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>, another: boolean) {
    e.preventDefault();
    const parsed = parseMonthValues(values);
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      setError(monthError(parsed.invalid));
      return;
    }
    setBusy(true);
    try {
      // Fields the form does not show are kept from the stored month.
      const snapshot = buildSnapshot(project.id, period, parsed.numbers, existing);
      await getStorage().snapshots.upsert(snapshot);
    } finally {
      setBusy(false);
    }
    if (!another) {
      onClose();
      return;
    }
    setSaved(period);
    const next = suggestPeriod([...snapshots.map((s) => s.period), period]);
    setPeriod(next);
    setValues(toMonthValues(byPeriod.get(next)));
    setInvalid([]);
    setError(null);
  }

  const months = selectableMonths();
  const set = (key: MonthField) => (v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setInvalid((prev) => prev.filter((k) => k !== key));
    setError(null);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        void save(e, submitter?.value === "another");
      }}
      className="space-y-4"
    >
      <Field label="Month">
        <Select value={period} onChange={(e) => pickPeriod(e.target.value)}>
          {months.map((p) => (
            <option key={p} value={p}>
              {formatPeriod(p)}
              {byPeriod.has(p) ? " · has numbers" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {existing && (
        <p className="-mt-2 text-xs text-muted">
          {formatPeriod(period)} already has numbers: saving updates them.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REQUIRED_MONTH_FIELDS.map((field, i) => (
          <MonthInput
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={set(field.key)}
            invalid={invalid.includes(field.key)}
            currency={project.currency}
            autoFocus={i === 0}
          />
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ChevronDownIcon className={cx("transition-transform", !more && "-rotate-90")} />
          More details <span className="text-faint">· optional, sharpens the plan</span>
        </button>
        {more && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {OPTIONAL_MONTH_FIELDS.map((field) => (
              <MonthInput
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={set(field.key)}
                invalid={invalid.includes(field.key)}
                currency={project.currency}
              />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && (
        <p role="status" className="text-sm text-muted">
          Saved {formatPeriod(saved)}. Next: {formatPeriod(period)}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" variant="primary" value="close" disabled={busy}>
          Save
        </Button>
        <Button type="submit" value="another" disabled={busy}>
          Save and add another
        </Button>
        <Button variant="ghost" onClick={onClose} className="ml-auto">
          {saved ? "Done" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}

const AddMonthContext = createContext<(period?: Period) => void>(() => {});

/** Opens the "Add month" dialog from anywhere inside a project. */
export function useAddMonth() {
  return useContext(AddMonthContext);
}

/** Holds the dialog for the project in the URL; wraps the project layout. */
export function AddMonthProvider({ children }: { children: ReactNode }) {
  const state = useProjectData();
  const [open, setOpen] = useState<{ period?: Period } | null>(null);
  const data = state.status === "ready" ? state.data : null;

  return (
    <AddMonthContext.Provider value={(period) => setOpen({ period })}>
      {children}
      {data && (
        <Dialog
          open={open !== null}
          onClose={() => setOpen(null)}
          title="Add a month"
          description="Two numbers are enough: what came in and how many paid."
        >
          <MonthForm
            project={data.project}
            snapshots={data.snapshots}
            initialPeriod={open?.period}
            onClose={() => setOpen(null)}
          />
        </Dialog>
      )}
    </AddMonthContext.Provider>
  );
}
