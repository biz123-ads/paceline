"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { goalSchema, type Goal, type Project } from "@/domain";
import { Button, Field, Select, TextInput, cx } from "@/components/ui";
import { currencySymbol, formatMoney, formatMonths, formatPeriod, moneyInputValue, parseMoney } from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { addMonths, monthsBetween, type Period } from "@/lib/period";

/** How far ahead a deadline can be picked. */
const MAX_DEADLINE_MONTHS = 60;
const QUICK_DEADLINES = [6, 12, 24, 36];
const ROUND_TARGETS = [100_000, 300_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000];

/** A target picked in the form, before it is saved. */
export interface GoalDraft {
  targetMrr: number;
  deadline: Period;
}

/** Builds the goal; its plan line starts from the latest real month. */
export function goalFromDraft(
  draft: GoalDraft,
  projectId: string,
  latest: { period: Period; mrr: number },
  previous?: Goal,
): Goal {
  const now = nowIso();
  return goalSchema.parse({
    id: previous?.id ?? newId(),
    projectId,
    label: previous?.label ?? "",
    targetMrr: draft.targetMrr,
    deadline: draft.deadline,
    baselinePeriod: latest.period,
    baselineMrr: latest.mrr,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  });
}

/**
 * "€10,000 a month by Dec 2027": a target and a date, with round numbers and
 * common horizons one tap away. Used by the project page and the setup.
 */
export function GoalFields({
  currency,
  latest,
  initial,
  submitLabel,
  onSubmit,
  secondary,
}: {
  currency: string;
  latest: { period: Period; mrr: number };
  initial?: GoalDraft;
  submitLabel: string;
  onSubmit: (draft: GoalDraft) => Promise<void> | void;
  /** Extra buttons next to submit (Cancel, Skip). */
  secondary?: ReactNode;
}) {
  const [target, setTarget] = useState(initial ? moneyInputValue(initial.targetMrr) : "");
  const [deadline, setDeadline] = useState<Period>(
    initial && monthsBetween(latest.period, initial.deadline) > 0
      ? initial.deadline
      : addMonths(latest.period, 12),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const presets = ROUND_TARGETS.filter((v) => v > latest.mrr).slice(0, 4);
  const months = Array.from({ length: MAX_DEADLINE_MONTHS }, (_, i) =>
    addMonths(latest.period, i + 1),
  );
  const ahead = monthsBetween(latest.period, deadline);

  async function save(e: FormEvent) {
    e.preventDefault();
    const targetMrr = parseMoney(target);
    if (!targetMrr) {
      setError("Enter the monthly revenue you want to reach, like 10000.");
      return;
    }
    if (targetMrr <= latest.mrr) {
      setError(`Pick a target above what you make now (${formatMoney(latest.mrr, currency)}).`);
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ targetMrr, deadline });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Monthly revenue I want" error={error}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
              {currencySymbol(currency)}
            </span>
            <TextInput
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setError(null);
              }}
              inputMode="decimal"
              placeholder="10000"
              className="num pl-7"
              aria-invalid={!!error}
              autoFocus
            />
          </div>
        </Field>
        <Field label="By">
          <Select value={deadline} onChange={(e) => setDeadline(e.target.value)}>
            {months.map((p) => (
              <option key={p} value={p}>
                {formatPeriod(p)} · in {formatMonths(monthsBetween(latest.period, p))}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted">
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1">Try</span>
            {presets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setTarget(moneyInputValue(v));
                  setError(null);
                }}
                className={cx(
                  "num rounded-full border px-2.5 py-1 transition-colors hover:text-foreground",
                  parseMoney(target) === v ? "border-border-strong text-foreground" : "border-border",
                )}
              >
                {formatMoney(v, currency, { compact: true })}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1">in</span>
          {QUICK_DEADLINES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDeadline(addMonths(latest.period, m))}
              className={cx(
                "rounded-full border px-2.5 py-1 transition-colors hover:text-foreground",
                ahead === m ? "border-border-strong text-foreground" : "border-border",
              )}
            >
              {m < 12 ? `${m} months` : m === 12 ? "1 year" : `${m / 12} years`}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
        {secondary}
      </div>
    </form>
  );
}

export function GoalEditor({
  project,
  latest,
  goal,
  onSave,
  onCancel,
}: {
  project: Project;
  latest: { period: Period; mrr: number };
  goal?: Goal;
  onSave: (goal: Goal) => Promise<void>;
  onCancel?: () => void;
}) {
  return (
    <GoalFields
      currency={project.currency}
      latest={latest}
      initial={goal}
      submitLabel={goal ? "Save goal" : "Set goal"}
      onSubmit={(draft) => onSave(goalFromDraft(draft, project.id, latest, goal))}
      secondary={
        onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )
      }
    />
  );
}
