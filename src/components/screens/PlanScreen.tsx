"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { goalSchema, type Assumptions, type Goal, type Project } from "@/domain";
import type { ProjectData } from "@/components/data/hooks";
import { MrrChart } from "@/components/charts/MrrChart";
import { mrrSeries } from "@/components/charts/series";
import { GoalProgress } from "@/components/project/GoalProgress";
import { SOURCE_TAGS } from "@/components/project/LeverValue";
import { ProjectGate } from "@/components/project/ProjectGate";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  Notice,
  Select,
  TextInput,
  cx,
} from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import {
  currencySymbol,
  formatMoney,
  formatMonths,
  formatNumber,
  formatPercent,
  formatPeriod,
  moneyInputValue,
  parseMoney,
  parsePercent,
} from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { addMonths, monthsBetween, type Period } from "@/lib/period";
import {
  buildPlan,
  MAX_PROJECTION_MONTHS,
  project as projectPath,
  type PlanResult,
} from "@/plan/engine";
import type { Sourced } from "@/plan/measure";
import { getStorage } from "@/storage";

/** How far ahead a deadline can be picked. */
const MAX_DEADLINE_MONTHS = 60;
/** The chart stops this long after the latest month when there is no deadline. */
const DEFAULT_CHART_AHEAD = 18;

/* ------------------------------------------------------------------ goal */

function GoalForm({
  project,
  latest,
  goal,
  onDone,
}: {
  project: Project;
  latest: { period: Period; mrr: number };
  goal?: Goal;
  onDone: () => void;
}) {
  const currency = project.currency;
  const [target, setTarget] = useState(goal ? moneyInputValue(goal.targetMrr) : "");
  const [deadline, setDeadline] = useState<Period>(
    goal && monthsBetween(latest.period, goal.deadline) > 0
      ? goal.deadline
      : addMonths(latest.period, 12),
  );
  const [label, setLabel] = useState(goal?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  // Round presets above the current MRR, in the project's currency.
  const presets = [100_000, 300_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000]
    .filter((v) => v > latest.mrr)
    .slice(0, 4);
  const months = Array.from({ length: MAX_DEADLINE_MONTHS }, (_, i) =>
    addMonths(latest.period, i + 1),
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    const targetMrr = parseMoney(target);
    if (!targetMrr) {
      setError("Enter the MRR you want to reach, like 10000.");
      return;
    }
    if (targetMrr <= latest.mrr) {
      setError(`Pick a target above your current MRR (${formatMoney(latest.mrr, currency)}).`);
      return;
    }
    const now = nowIso();
    // The plan line always starts from the latest real month.
    await getStorage().goals.save(
      goalSchema.parse({
        id: goal?.id ?? newId(),
        projectId: project.id,
        label: label.trim(),
        targetMrr,
        deadline,
        baselinePeriod: latest.period,
        baselineMrr: latest.mrr,
        createdAt: goal?.createdAt ?? now,
        updatedAt: now,
      }),
    );
    onDone();
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Target MRR" error={error}>
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
                {formatPeriod(p)} · {formatMonths(monthsBetween(latest.period, p))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" hint="Optional">
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Quit my job"
          />
        </Field>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Try</span>
          {presets.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setTarget(moneyInputValue(v));
                setError(null);
              }}
              className="num rounded-full border border-border px-2.5 py-1 hover:border-border-strong hover:text-foreground"
            >
              {formatMoney(v, currency, { compact: true })}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary">
          {goal ? "Save goal" : "Set goal"}
        </Button>
        {goal && (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <span className="text-xs text-faint">
          The plan line starts from {formatPeriod(latest.period)} (
          {formatMoney(latest.mrr, currency)}).
        </span>
      </div>
    </form>
  );
}

function GoalCard({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, goal } = data;
  const latest = plan.measures.latest!;
  const [editing, setEditing] = useState(false);

  if (!goal || editing) {
    return (
      <Card>
        <CardHeader
          title={goal ? "Change goal" : "Where do you want to get?"}
          hint={
            goal
              ? undefined
              : "Pick a monthly revenue target and a date. The plan works out what it takes."
          }
        />
        <GoalForm
          project={project}
          latest={latest}
          goal={goal}
          onDone={() => setEditing(false)}
        />
      </Card>
    );
  }

  async function remove() {
    if (!window.confirm("Remove this goal? Your monthly data stays.")) return;
    await getStorage().goals.removeByProject(project.id);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{goal.label || "Goal"}</p>
          <p className="mt-1 text-2xl tracking-tight sm:text-3xl">
            <span className="num">{formatMoney(goal.targetMrr, project.currency)}</span>{" "}
            <span className="text-muted">MRR by</span> {formatPeriod(goal.deadline)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
          <Button size="sm" variant="ghost" onClick={remove}>
            Remove
          </Button>
        </div>
      </div>
      <div className="mt-5">
        <GoalProgress goal={goal} currentMrr={latest.mrr} currency={project.currency} segments={30} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------- what it takes */

function Stat({
  label,
  need,
  have,
  good,
  foot,
}: {
  label: string;
  need: ReactNode;
  have?: ReactNode;
  /** Whether "have" already covers "need"; colours the comparison. */
  good?: boolean;
  foot?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-2 text-2xl tracking-tight">{need}</p>
      {have !== undefined && (
        <p className={cx("mt-1 text-xs", good ? "text-foreground" : "text-muted")}>
          {good ? "✓ " : ""}
          {have}
        </p>
      )}
      {foot && <p className="mt-2 text-xs text-faint">{foot}</p>}
    </div>
  );
}

function WhatItTakes({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const goal = data.goal!;
  const g = plan.goal!;
  const currency = data.project.currency;
  const latest = plan.measures.latest!;
  const { levers } = plan;

  if (g.reached) {
    return (
      <Card>
        <p className="text-lg font-medium text-accent">Goal reached 🎉</p>
        <p className="mt-1 text-sm text-muted">
          {formatMoney(latest.mrr, currency)} MRR in {formatPeriod(latest.period)}. Time
          for a bigger one: change the goal above.
        </p>
      </Card>
    );
  }
  if (g.deadlinePassed) {
    return (
      <Notice tone="strong">
        The deadline ({formatPeriod(goal.deadline)}) has passed without reaching the
        target. Change the goal to set a new date; your data stays.
      </Notice>
    );
  }

  const growth = plan.measures.recentMrrGrowth;
  const pace = levers.newCustomersPerMonth.value;

  return (
    <Card>
      <CardHeader
        title={`What it takes · ${formatMonths(g.monthsLeft)} left`}
        hint={`From ${formatMoney(latest.mrr, currency)} in ${formatPeriod(latest.period)} to ${formatMoney(goal.targetMrr, currency)} by ${formatPeriod(goal.deadline)}.`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Paying customers needed"
          need={g.customersNeeded !== null ? formatNumber(g.customersNeeded) : "—"}
          have={`You have ${formatNumber(latest.payingCustomers)}`}
          good={g.customersNeeded !== null && latest.payingCustomers >= g.customersNeeded}
          foot={
            levers.arpu
              ? `At ${formatMoney(levers.arpu.value, currency)} per customer a month.`
              : "Set a price below to work this out."
          }
        />
        <Stat
          label="New customers needed / month"
          need={g.requiredNewPerMonth !== null ? formatNumber(g.requiredNewPerMonth, 1) : "—"}
          have={`You get ${formatNumber(pace, 1)}${levers.newCustomersPerMonth.source === "user" ? " (your value)" : ""}`}
          good={g.requiredNewPerMonth !== null && pace >= g.requiredNewPerMonth}
          foot={`Every month, while ${formatPercent(levers.churnRate.value)} of customers leave.`}
        />
        <Stat
          label="MRR growth needed / month"
          need={
            g.requiredMonthlyGrowth !== null ? formatPercent(g.requiredMonthlyGrowth) : "—"
          }
          have={
            growth
              ? `Last ${growth.months === 1 ? "month" : `${growth.months} months`}: ${formatPercent(growth.rate, { signed: true })}`
              : undefined
          }
          good={
            growth !== null &&
            g.requiredMonthlyGrowth !== null &&
            growth.rate >= g.requiredMonthlyGrowth
          }
          foot="Net of churn, compounded."
        />
      </div>
      <PaceSentence data={data} plan={plan} />
    </Card>
  );
}

function PaceSentence({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const goal = data.goal!;
  const pace = plan.goal!.pace;
  const currency = data.project.currency;
  const { levers } = plan;
  if (!pace) return null;

  const userChanged = Object.values(levers).some(
    (l: Sourced<number> | null) => l?.source === "user",
  );
  const subject = userChanged ? "With your levers" : "At your current pace";
  let body: ReactNode;
  let tone = "text-foreground";

  if (pace.reachedAt && pace.monthsToTarget !== null) {
    const late = monthsBetween(goal.deadline, pace.reachedAt);
    body = (
      <>
        you reach {formatMoney(goal.targetMrr, currency)} in{" "}
        <strong className="font-medium">{formatPeriod(pace.reachedAt)}</strong> (
        {formatMonths(pace.monthsToTarget)}),{" "}
        {late > 0
          ? `${formatMonths(late)} after your deadline.`
          : late < 0
            ? `${formatMonths(-late)} before your deadline.`
            : "right on your deadline."}
      </>
    );
    tone = "text-foreground";
  } else if (Number.isFinite(pace.ceilingMrr)) {
    body = (
      <>
        you level off around{" "}
        <strong className="font-medium num">{formatMoney(pace.ceilingMrr, currency, { whole: true })}</strong>{" "}
        MRR: {formatNumber(levers.newCustomersPerMonth.value, 1)} new customers a month
        only replace the {formatPercent(levers.churnRate.value)} who leave. Lower churn
        or win more customers to get past it.
      </>
    );
    tone = "text-foreground";
  } else {
    body = <>you do not reach the target within {formatMonths(MAX_PROJECTION_MONTHS)}.</>;
    tone = "text-foreground";
  }

  return (
    <p
      className={cx(
        "mt-5 rounded-r-xl border-l-2 border-accent bg-surface-2 px-4 py-3 text-sm",
        tone,
      )}
    >
      <span className="text-muted">{subject}, </span>
      {body}
    </p>
  );
}

/* ---------------------------------------------------------------- levers */

function LeverRow({
  label,
  help,
  value,
  suffix,
  prefix,
  source,
  parse,
  onSave,
  onReset,
  display,
}: {
  label: string;
  help: string;
  /** Current value, as shown in the input. */
  value: string;
  prefix?: string;
  suffix?: string;
  source: Sourced<number>["source"] | null;
  parse: (raw: string) => number | null;
  onSave: (value: number) => Promise<void>;
  onReset?: () => Promise<void>;
  /** The value as it comes from the data, shown when the user changed it. */
  display?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
    setInvalid(false);
  }

  async function commit() {
    if (draft.trim() === value.trim()) return;
    const parsed = parse(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await onSave(parsed);
  }

  const tag = source ? SOURCE_TAGS[source] : null;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0 first:pt-0">
      <p className="min-w-0 text-sm">{label}</p>
      <div className="flex items-center gap-2">
        <div className="relative w-28">
          {prefix && (
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
              {prefix}
            </span>
          )}
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            inputMode="decimal"
            aria-label={label}
            aria-invalid={invalid}
            className={cx("num text-right", prefix && "pl-7", suffix && "pr-7")}
          />
          {suffix && (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-faint">
              {suffix}
            </span>
          )}
        </div>
      </div>
      <p className="col-span-2 text-xs text-faint">{help}</p>
      <div className="col-span-2 flex flex-wrap items-center gap-x-2 text-[11px] empty:hidden">
        {tag && (
          <span title={tag.title} className={tag.className}>
            {tag.label}
          </span>
        )}
        {source === "user" && onReset && (
          <button type="button" onClick={onReset} className="text-muted underline hover:text-foreground">
            back to {display ?? "data"}
          </button>
        )}
        {invalid && <span className="text-danger">Enter a number.</span>}
      </div>
    </div>
  );
}

function Levers({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, assumptions } = data;
  const { levers, measures } = plan;
  const currency = project.currency;

  async function setLever(patch: Partial<Assumptions>) {
    await getStorage().assumptions.save({
      projectId: project.id,
      arpu: null,
      monthlyChurnRate: null,
      newCustomersPerMonth: null,
      monthlyCosts: null,
      ...assumptions,
      ...patch,
      updatedAt: nowIso(),
    });
  }

  const dataLabel = (s: Sourced<number> | null, fmt: (v: number) => string) =>
    s ? fmt(s.value) : "data";

  return (
    <Card>
      <CardHeader
        title="Levers"
        hint="Start from your data. Change one to see what moves the date."
      />
      <div>
        <LeverRow
          label="Price per customer / month"
          help="Average revenue per paying customer. Applies to all customers."
          prefix={currencySymbol(currency)}
          value={moneyInputValue(levers.arpu?.value)}
          source={levers.arpu?.source ?? null}
          parse={(raw) => {
            const v = parseMoney(raw);
            return v && v > 0 ? v : null;
          }}
          onSave={(v) => setLever({ arpu: v })}
          onReset={() => setLever({ arpu: null })}
          display={dataLabel(measures.arpu, (v) => formatMoney(v, currency))}
        />
        <LeverRow
          label="Churn / month"
          help="Share of paying customers who leave each month."
          suffix="%"
          value={formatNumber(levers.churnRate.value * 100, 2)}
          source={levers.churnRate.source}
          parse={parsePercent}
          onSave={(v) => setLever({ monthlyChurnRate: v })}
          onReset={() => setLever({ monthlyChurnRate: null })}
          display={formatPercent(measures.churnRate.value)}
        />
        <LeverRow
          label="New customers / month"
          help="Customers you win each month."
          value={formatNumber(levers.newCustomersPerMonth.value, 1)}
          source={levers.newCustomersPerMonth.source}
          parse={(raw) => {
            const v = Number(raw.replace(",", ".").trim());
            return raw.trim() && Number.isFinite(v) && v >= 0 ? v : null;
          }}
          onSave={(v) => setLever({ newCustomersPerMonth: v })}
          onReset={() => setLever({ newCustomersPerMonth: null })}
          display={formatNumber(measures.newCustomersPerMonth.value, 1)}
        />
        <LeverRow
          label="Costs / month"
          help="Everything you spend: tools, hosting, ads, salaries."
          prefix={currencySymbol(currency)}
          value={moneyInputValue(levers.monthlyCosts?.value)}
          source={levers.monthlyCosts?.source ?? null}
          parse={parseMoney}
          onSave={(v) => setLever({ monthlyCosts: v })}
          onReset={() => setLever({ monthlyCosts: null })}
          display={dataLabel(measures.monthlyCosts, (v) => formatMoney(v, currency))}
        />
        <LeverRow
          label="Cash on hand"
          help="Money in the bank for this project, for runway."
          prefix={currencySymbol(currency)}
          value={moneyInputValue(project.cashBalance)}
          source={null}
          parse={parseMoney}
          onSave={(v) =>
            getStorage().projects.save({ ...project, cashBalance: v, updatedAt: nowIso() })
          }
        />
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- runway card */

function Runway({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const currency = data.project.currency;
  const costs = plan.levers.monthlyCosts?.value ?? null;
  const latest = plan.measures.latest!;

  let main: ReactNode;
  let sub: ReactNode;
  if (costs === null) {
    main = <span className="text-faint">—</span>;
    sub = "Set your monthly costs to see runway and break-even.";
  } else if (plan.profitable) {
    main = <span>Profitable</span>;
    sub = `${formatMoney(latest.mrr - costs, currency)} a month above costs.`;
  } else {
    main =
      data.project.cashBalance > 0 && plan.runwayMonths !== null ? (
        <span>{formatMonths(plan.runwayMonths)}</span>
      ) : (
        <span>Burning {formatMoney(costs - latest.mrr, currency)}/mo</span>
      );
    sub = plan.breakEvenAt
      ? `Break-even at this pace: ${formatPeriod(plan.breakEvenAt)}.`
      : "No break-even at this pace within 10 years.";
  }

  return (
    <Card>
      <p className="text-sm text-muted">Runway</p>
      <p className="num mt-1 text-2xl tracking-tight">{main}</p>
      <p className="mt-2 text-xs text-muted">{sub}</p>
      {costs !== null && !plan.profitable && (
        <p className="mt-2 text-[11px] text-faint">
          Runway assumes this month&apos;s burn stays the same.
        </p>
      )}
    </Card>
  );
}

/* ----------------------------------------------------- chart and table */

function PlanChart({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { snapshots, project, goal } = data;
  const latest = plan.measures.latest!;
  const { levers } = plan;
  const end = goal && monthsBetween(latest.period, goal.deadline) > 0
    ? goal.deadline
    : addMonths(latest.period, DEFAULT_CHART_AHEAD);
  const start = [snapshots[0].period, addMonths(latest.period, -12)].sort().at(-1)!;
  const from = goal && goal.baselinePeriod < start ? goal.baselinePeriod : start;
  const projection = levers.arpu
    ? projectPath(
        latest.period,
        latest.payingCustomers,
        levers.arpu.value,
        levers.churnRate.value,
        levers.newCustomersPerMonth.value,
        monthsBetween(latest.period, end),
      )
    : [];

  return (
    <Card>
      <CardHeader
        title="Plan vs. pace"
        hint="Bars are real months. Lines are arithmetic on your goal and levers, not a prediction."
      />
      <MrrChart
        data={mrrSeries({ from, to: end, snapshots, plan: plan.planLine, projection })}
        currency={project.currency}
        height={280}
      />
    </Card>
  );
}

function MonthlyPlan({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, snapshots } = data;
  const currency = project.currency;
  const arpu = plan.levers.arpu?.value ?? null;
  const actual = new Map(snapshots.map((s) => [s.period, s]));
  const latest = plan.measures.latest!;
  const rows = plan.planLine.filter((p) => p.period > plan.planLine[0].period);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 12);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Month by month"
        hint="Targets to hit each month to stay on the plan line."
      />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="pb-2 font-normal">Month</th>
              <th className="pb-2 text-right font-normal">Target MRR</th>
              <th className="pb-2 text-right font-normal">Customers</th>
              <th className="pb-2 text-right font-normal">Actual</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const real = actual.get(p.period);
              const isNext = p.period === addMonths(latest.period, 1);
              return (
                <tr
                  key={p.period}
                  className={cx("border-t border-border", isNext && "bg-surface-2")}
                >
                  <td className="py-2.5">
                    {formatPeriod(p.period)}
                    {isNext && <span className="ml-2 text-[11px] text-accent">next</span>}
                  </td>
                  <td className="num py-2.5 text-right">
                    {formatMoney(p.mrr, currency, { whole: true })}
                  </td>
                  <td className="num py-2.5 text-right text-muted">
                    {arpu ? formatNumber(Math.ceil(p.mrr / arpu)) : "—"}
                  </td>
                  <td className="num py-2.5 text-right">
                    {real ? (
                      <span className={real.mrr >= p.mrr ? "text-foreground" : "text-muted"}>
                        {formatMoney(real.mrr, currency)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 12 && (
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${rows.length} months`}
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

function Plan({ data }: { data: ProjectData }) {
  const plan = buildPlan({
    history: data.snapshots,
    goal: data.goal,
    assumptions: data.assumptions,
    cashBalance: data.project.cashBalance,
  });
  const latest = plan.measures.latest;

  if (!latest) {
    return (
      <Card className="flex flex-col items-center py-14 text-center">
        <p className="font-medium">Add a month first</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          The plan starts from your latest real numbers: MRR and paying customers.
        </p>
        <ButtonLink href={`/projects/${data.project.id}/data#add`} variant="primary" className="mt-5">
          <PlusIcon /> Add a month
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {plan.measures.lowConfidence && (
        <Notice tone="strong">
          Only {plan.measures.monthsOfHistory}{" "}
          {plan.measures.monthsOfHistory === 1 ? "month" : "months"} of data. Values marked
          “estimated” or “assumed” are rough until you have at least 3;{" "}
          <Link href={`/projects/${data.project.id}/data#add`} className="underline">
            add more months
          </Link>{" "}
          or set the levers yourself.
        </Notice>
      )}
      <GoalCard data={data} plan={plan} />
      {data.goal && plan.goal && <WhatItTakes data={data} plan={plan} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PlanChart data={data} plan={plan} />
          {data.goal && <MonthlyPlan data={data} plan={plan} />}
        </div>
        <div className="space-y-4">
          <Levers data={data} plan={plan} />
          <Runway data={data} plan={plan} />
        </div>
      </div>
    </div>
  );
}

export function PlanScreen() {
  return <ProjectGate>{(data) => <Plan data={data} />}</ProjectGate>;
}
