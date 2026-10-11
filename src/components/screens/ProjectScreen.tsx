"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { Assumptions, Goal } from "@/domain";
import type { ProjectData } from "@/components/data/hooks";
import { MrrChart } from "@/components/charts/MrrChart";
import { mrrSeries } from "@/components/charts/series";
import { useAddMonth } from "@/components/project/AddMonth";
import { GoalEditor } from "@/components/project/GoalEditor";
import { GLOSSARY } from "@/components/project/glossary";
import { ProjectGate } from "@/components/project/ProjectGate";
import { Hint } from "@/components/overlay";
import {
  Button,
  ButtonLink,
  Card,
  DeltaBadge,
  Notice,
  ScrollX,
  SegmentBar,
  TextInput,
  cx,
} from "@/components/ui";
import { ChevronDownIcon, PlusIcon } from "@/components/icons";
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
import { nowIso } from "@/lib/id";
import { addMonths, currentPeriod, monthsBetween } from "@/lib/period";
import {
  buildPlan,
  MAX_PROJECTION_MONTHS,
  project as projectPath,
  type PlanResult,
} from "@/plan/engine";
import type { Sourced, ValueSource } from "@/plan/measure";
import { getStorage } from "@/storage";

/** Real months shown in the chart. */
const CHART_HISTORY = 12;
/** Without a goal, the chart looks this far past the latest month. */
const CHART_AHEAD = 12;
/** The chart never looks further ahead than this. */
const CHART_MAX_AHEAD = 36;
/** Runway bar is full at this many months. */
const RUNWAY_FULL = 24;

/* -------------------------------------------------------------- building */

/** A numbered step of the page: 1 where you are, 2 goal, 3 what it takes. */
function Section({
  step,
  title,
  action,
  children,
  className,
}: {
  step?: number;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[15px] font-medium">
          {step !== undefined && (
            <span
              aria-hidden
              className="num flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[11px] text-muted"
            >
              {step}
            </span>
          )}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Label({ children, hint, term }: { children: ReactNode; hint?: string; term?: string }) {
  return (
    <span className="text-xs text-muted">
      {children}
      {hint && <Hint term={term ?? String(children).toLowerCase()}>{hint}</Hint>}
    </span>
  );
}

/* ----------------------------------------------------- 1. where you are */

function WhereYouAre({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, snapshots, goal } = data;
  const addMonth = useAddMonth();
  const { latest, previous, mrrChange, lowConfidence, monthsOfHistory } = plan.measures;
  const currency = project.currency;

  if (!latest) {
    return (
      <Section step={1} title="Where you are">
        <div className="flex flex-col items-center py-10 text-center">
          <p className="font-medium">Start with last month&apos;s numbers</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            How much came in, and how many customers paid. Add a few months back if you
            have them: three are enough to see a trend.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => addMonth()}>
              <PlusIcon /> Add a month
            </Button>
            <ButtonLink href={`/projects/${project.id}/data`}>Import a spreadsheet or Stripe</ButtonLink>
          </div>
        </div>
      </Section>
    );
  }

  const { levers } = plan;
  const first = snapshots[0].period;
  let from = [first, addMonths(latest.period, -(CHART_HISTORY - 1))].sort().at(-1)!;
  if (goal && goal.baselinePeriod < from && goal.baselinePeriod >= first) from = goal.baselinePeriod;
  const ahead =
    goal && monthsBetween(latest.period, goal.deadline) > 0
      ? Math.min(monthsBetween(latest.period, goal.deadline), CHART_MAX_AHEAD)
      : CHART_AHEAD;
  const to = addMonths(latest.period, ahead);
  const projection = levers.arpu
    ? projectPath(
        latest.period,
        latest.payingCustomers,
        levers.arpu.value,
        levers.churnRate.value,
        levers.newCustomersPerMonth.value,
        ahead,
      )
    : [];

  return (
    <Section step={1} title="Where you are">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Label hint={GLOSSARY.revenue} term="monthly revenue">
            Monthly revenue · {formatPeriod(latest.period)}
          </Label>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="num text-4xl tracking-tight sm:text-[44px]">
              {formatMoney(latest.mrr, currency)}
            </span>
            {mrrChange !== null && previous && (
              <DeltaBadge
                value={mrrChange}
                label={`${formatMoney(mrrChange, currency, { signed: true })}${
                  previous.mrr > 0
                    ? ` (${formatPercent(mrrChange / previous.mrr, { signed: true })})`
                    : ""
                } vs ${formatPeriod(previous.period, { short: true })}`}
              />
            )}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt>
              <Label hint={GLOSSARY.customers} term="a paying customer">
                Paying customers
              </Label>
            </dt>
            <dd className="num mt-0.5 text-lg">{formatNumber(latest.payingCustomers)}</dd>
          </div>
          <div>
            <dt>
              <Label hint={GLOSSARY.price} term="price per customer">
                Each pays
              </Label>
            </dt>
            <dd className="num mt-0.5 text-lg">
              {plan.measures.arpu ? formatMoney(plan.measures.arpu.value, currency) : "—"}
            </dd>
          </div>
          <div>
            <dt>
              <Label hint={GLOSSARY.churn} term="churn">
                Leave each month
              </Label>
            </dt>
            <dd className="num mt-0.5 text-lg">
              {formatPercent(plan.measures.churnRate.value)}
              {plan.measures.churnRate.source === "default" && (
                <span className="ml-1.5 text-xs text-faint">a guess</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-6">
        <MrrChart
          data={mrrSeries({ from, to, snapshots, plan: plan.planLine, projection })}
          currency={currency}
        />
      </div>
      {lowConfidence && (
        <p className="mt-4 text-xs text-muted">
          Only {monthsOfHistory} {monthsOfHistory === 1 ? "month" : "months"} so far: trends are
          rough until you have three.{" "}
          <button type="button" onClick={() => addMonth()} className="text-foreground underline">
            Add an earlier month
          </button>
        </p>
      )}
    </Section>
  );
}

/* ---------------------------------------------- 2. where you want to go */

function WhereYouWantToGo({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, goal } = data;
  const latest = plan.measures.latest;
  const g = plan.goal;
  const [editing, setEditing] = useState(false);
  const currency = project.currency;

  if (!latest) {
    return (
      <Section step={2} title="Where you want to go">
        <p className="text-sm text-muted">
          Once you have a month of numbers, pick a target, like{" "}
          {formatMoney(1_000_000, currency)} a month by next year.
        </p>
      </Section>
    );
  }

  const save = async (next: Goal) => {
    await getStorage().goals.save(next);
    setEditing(false);
  };

  if (!goal || !g || editing) {
    return (
      <Section step={2} title="Where you want to go">
        {!goal && (
          <p className="-mt-1 mb-5 text-sm text-muted">
            Pick a monthly revenue and a date. The page works out what it takes.
          </p>
        )}
        <GoalEditor
          project={project}
          latest={latest}
          goal={goal}
          onSave={save}
          onCancel={goal ? () => setEditing(false) : undefined}
        />
        {goal && (
          <p className="mt-4 text-xs text-faint">
            The plan line will start again from {formatPeriod(latest.period)} (
            {formatMoney(latest.mrr, currency)}).
          </p>
        )}
      </Section>
    );
  }

  async function remove() {
    if (!window.confirm("Remove this goal? Your monthly numbers stay.")) return;
    await getStorage().goals.removeByProject(project.id);
  }

  let status: ReactNode;
  if (g.reached) {
    status = <span className="text-accent">Goal reached. Time for a bigger one.</span>;
  } else if (g.deadlinePassed) {
    status = "The date has passed. Change the goal to set a new one.";
  } else if (g.vsPlan && Math.abs(g.vsPlan.delta) < 100) {
    status = (
      <>
        <span className="text-foreground">Right on the plan</span> in {formatPeriod(latest.period)}
        <Hint term="the plan line">{GLOSSARY.planLine}</Hint>
      </>
    );
  } else if (g.vsPlan) {
    const ahead = g.vsPlan.delta >= 0;
    status = (
      <>
        <span className="text-foreground">
          {ahead ? "↑" : "↓"} {formatMoney(Math.abs(g.vsPlan.delta), currency, { whole: true })}{" "}
          {ahead ? "ahead of" : "behind"} the plan
        </span>{" "}
        in {formatPeriod(latest.period)}
        <Hint term="the plan line">{GLOSSARY.planLine}</Hint>
      </>
    );
  } else {
    status = `${formatMonths(g.monthsLeft)} to go.`;
  }

  return (
    <Section
      step={2}
      title="Where you want to go"
      action={
        <div className="flex gap-1">
          <Button size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
          <Button size="sm" variant="ghost" onClick={remove}>
            Remove
          </Button>
        </div>
      }
    >
      <p className="text-2xl tracking-tight sm:text-3xl">
        <span className="num">{formatMoney(goal.targetMrr, currency)}</span>{" "}
        <span className="text-muted">a month by</span> {formatPeriod(goal.deadline)}
      </p>
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted">
            {formatMoney(latest.mrr, currency)} of {formatMoney(goal.targetMrr, currency)}
          </span>
          <span className="num text-accent">{formatPercent(Math.min(g.progress, 1), { digits: 0 })}</span>
        </div>
        <SegmentBar
          tone="accent"
          fraction={g.progress}
          segments={30}
          label={`Progress towards ${formatMoney(goal.targetMrr, currency)} a month`}
        />
      </div>
      <p className="mt-3 text-sm text-muted">{status}</p>
    </Section>
  );
}

/* ---------------------------------------------------- 3. what it takes */

function PaceSentence({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const goal = data.goal!;
  const pace = plan.goal?.pace;
  const currency = data.project.currency;
  const { levers } = plan;
  if (!pace) return null;

  const changed = Object.values(levers).some((l: Sourced<number> | null) => l?.source === "user");
  const subject = changed ? "With your numbers" : "At your current pace";
  let body: ReactNode;

  if (pace.reachedAt && pace.monthsToTarget !== null) {
    const late = monthsBetween(goal.deadline, pace.reachedAt);
    body = (
      <>
        you get to {formatMoney(goal.targetMrr, currency)} in{" "}
        <strong className="font-medium">{formatPeriod(pace.reachedAt)}</strong>,{" "}
        {late > 0
          ? `${formatMonths(late)} late.`
          : late < 0
            ? `${formatMonths(-late)} early.`
            : "right on time."}
      </>
    );
  } else if (Number.isFinite(pace.ceilingMrr)) {
    body = (
      <>
        you stall around{" "}
        <strong className="num font-medium">
          {formatMoney(pace.ceilingMrr, currency, { whole: true })}
        </strong>{" "}
        a month: {formatNumber(levers.newCustomersPerMonth.value, 1)} new customers only replace
        the {formatPercent(levers.churnRate.value)} who leave. Keep more customers or win more
        to get past it.
      </>
    );
  } else {
    body = <>you do not get there within {formatMonths(MAX_PROJECTION_MONTHS)}.</>;
  }

  return (
    <p className="rounded-r-xl border-l-2 border-accent bg-surface-2 px-4 py-3 text-sm">
      <span className="text-muted">{subject}, </span>
      {body}
      <Hint term="pace" align="right">
        {GLOSSARY.pace}
      </Hint>
    </p>
  );
}

const SOURCE_NOTES: Record<ValueSource, string> = {
  measured: "from your numbers",
  estimated: "estimated from your numbers",
  default: "a guess: add customers who left to measure it",
  user: "your value",
};

/** One "what if" number: starts from the data, the user can override it. */
function LeverInput({
  label,
  hint,
  value,
  prefix,
  suffix,
  source,
  parse,
  onSave,
  onReset,
  original,
}: {
  label: string;
  hint: string;
  /** Current value, as shown in the input. */
  value: string;
  prefix?: string;
  suffix?: string;
  source: ValueSource | null;
  parse: (raw: string) => number | null;
  onSave: (value: number) => Promise<void>;
  onReset?: () => Promise<void>;
  /** The value from the data, offered when the user changed it. */
  original?: string;
}) {
  const id = useId();
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

  return (
    <div>
      <div className="flex items-center text-xs text-muted">
        <label htmlFor={id}>{label}</label>
        <Hint term={label.toLowerCase()}>{hint}</Hint>
      </div>
      <div className="relative mt-1.5">
        {prefix && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
            {prefix}
          </span>
        )}
        <TextInput
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          inputMode="decimal"
          aria-invalid={invalid}
          className={cx(
            "num",
            prefix && "pl-7",
            suffix && "pr-7",
            source === "user" && "border-accent/60 text-accent",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-faint">
            {suffix}
          </span>
        )}
      </div>
      <p className="mt-1.5 min-h-4 text-[11px] text-faint">
        {invalid ? (
          <span className="text-danger">Enter a number.</span>
        ) : source === "user" && onReset ? (
          <>
            <span className="text-accent">your value</span> ·{" "}
            <button type="button" onClick={onReset} className="text-muted underline hover:text-foreground">
              back to {original ?? "my numbers"}
            </button>
          </>
        ) : source ? (
          SOURCE_NOTES[source]
        ) : null}
      </p>
    </div>
  );
}

async function saveLevers(data: ProjectData, patch: Partial<Assumptions>) {
  await getStorage().assumptions.save({
    projectId: data.project.id,
    arpu: null,
    monthlyChurnRate: null,
    newCustomersPerMonth: null,
    monthlyCosts: null,
    ...data.assumptions,
    ...patch,
    updatedAt: nowIso(),
  });
}

function WhatIf({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { levers, measures } = plan;
  const currency = data.project.currency;
  const set = (patch: Partial<Assumptions>) => saveLevers(data, patch);
  const anyChanged =
    levers.arpu?.source === "user" ||
    levers.churnRate.source === "user" ||
    levers.newCustomersPerMonth.source === "user";

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          What if…{" "}
          <span className="font-normal text-muted">change a number and see what moves.</span>
        </p>
        {anyChanged && (
          <button
            type="button"
            onClick={() => set({ arpu: null, monthlyChurnRate: null, newCustomersPerMonth: null })}
            className="text-xs text-muted underline hover:text-foreground"
          >
            Back to my numbers
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <LeverInput
          label="Price per customer"
          hint={`${GLOSSARY.price} Changing it applies to every customer.`}
          prefix={currencySymbol(currency)}
          suffix="/mo"
          value={moneyInputValue(levers.arpu?.value)}
          source={levers.arpu?.source ?? null}
          parse={(raw) => {
            const v = parseMoney(raw);
            return v && v > 0 ? v : null;
          }}
          onSave={(v) => set({ arpu: v })}
          onReset={() => set({ arpu: null })}
          original={measures.arpu ? formatMoney(measures.arpu.value, currency) : undefined}
        />
        <LeverInput
          label="Customers who leave each month"
          hint={GLOSSARY.churn}
          suffix="%"
          value={formatNumber(levers.churnRate.value * 100, 2)}
          source={levers.churnRate.source}
          parse={parsePercent}
          onSave={(v) => set({ monthlyChurnRate: v })}
          onReset={() => set({ monthlyChurnRate: null })}
          original={formatPercent(measures.churnRate.value)}
        />
        <LeverInput
          label="New customers each month"
          hint={GLOSSARY.newCustomers}
          value={formatNumber(levers.newCustomersPerMonth.value, 1)}
          source={levers.newCustomersPerMonth.source}
          parse={(raw) => {
            const v = Number(raw.replace(",", ".").trim());
            return raw.trim() && Number.isFinite(v) && v >= 0 ? v : null;
          }}
          onSave={(v) => set({ newCustomersPerMonth: v })}
          onReset={() => set({ newCustomersPerMonth: null })}
          original={formatNumber(measures.newCustomersPerMonth.value, 1)}
        />
      </div>
    </div>
  );
}

function MonthByMonth({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, snapshots } = data;
  const currency = project.currency;
  const arpu = plan.levers.arpu?.value ?? null;
  const actual = new Map(snapshots.map((s) => [s.period, s]));
  const latest = plan.measures.latest!;
  const rows = plan.planLine.filter((p) => p.period > plan.planLine[0].period);
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ChevronDownIcon className={cx("transition-transform", !open && "-rotate-90")} />
        Month-by-month targets
      </button>
      {open && (
        <ScrollX label="Month-by-month targets" className="mt-3">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="pb-2 font-normal">Month</th>
                <th className="pb-2 text-right font-normal">Revenue to hit</th>
                <th className="pb-2 text-right font-normal">Customers</th>
                <th className="pb-2 text-right font-normal">Actual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const real = actual.get(p.period);
                const isNext = p.period === addMonths(latest.period, 1);
                return (
                  <tr key={p.period} className={cx("border-t border-border", isNext && "bg-surface-2")}>
                    <td className="py-2">
                      {formatPeriod(p.period)}
                      {isNext && <span className="ml-2 text-[11px] text-accent">next</span>}
                    </td>
                    <td className="num py-2 text-right">{formatMoney(p.mrr, currency, { whole: true })}</td>
                    <td className="num py-2 text-right text-muted">
                      {arpu ? formatNumber(Math.ceil(p.mrr / arpu)) : "—"}
                    </td>
                    <td className="num py-2 text-right">
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
        </ScrollX>
      )}
    </div>
  );
}

function WhatItTakes({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const goal = data.goal;
  const g = plan.goal;
  const latest = plan.measures.latest;
  const currency = data.project.currency;
  if (!goal || !g || !latest || g.reached) return null;

  if (g.deadlinePassed) {
    return (
      <Section step={3} title="What it takes">
        <p className="text-sm text-muted">
          {formatPeriod(goal.deadline)} has passed. Change the goal above to set a new date;
          your numbers stay.
        </p>
      </Section>
    );
  }

  const { levers } = plan;
  const pace = levers.newCustomersPerMonth.value;
  const growth = plan.measures.recentMrrGrowth;
  const onTrack = g.requiredNewPerMonth !== null && pace >= g.requiredNewPerMonth;

  return (
    <Section step={3} title={`What it takes · ${formatMonths(g.monthsLeft)} left`}>
      {g.requiredNewPerMonth !== null && g.customersNeeded !== null ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-2xl tracking-tight sm:text-3xl">
              Win about{" "}
              <span className="num text-foreground">{formatNumber(Math.ceil(g.requiredNewPerMonth))}</span>{" "}
              new customers a month
            </p>
            <p className="mt-2 text-sm text-muted">
              {onTrack ? "✓ " : ""}You win about{" "}
              <span className="num text-foreground">{formatNumber(pace, 1)}</span> today
              {levers.newCustomersPerMonth.source === "user" ? " (your value)" : ""}.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <span className="num text-foreground">{formatNumber(g.customersNeeded)}</span> paying
              customers in total at {formatMoney(levers.arpu!.value, currency)} each (you have{" "}
              <span className="num">{formatNumber(latest.payingCustomers)}</span>).
            </li>
            {g.requiredMonthlyGrowth !== null && (
              <li>
                Revenue growing{" "}
                <span className="num text-foreground">{formatPercent(g.requiredMonthlyGrowth)}</span> a
                month
                {growth
                  ? `, against ${formatPercent(growth.rate, { signed: true })} lately`
                  : ""}
                .
              </li>
            )}
            <li>
              While {formatPercent(levers.churnRate.value)} of customers leave every month.
            </li>
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">
          No paying customers yet, so the plan needs your price: set it below.
        </p>
      )}
      <div className="mt-5">
        <PaceSentence data={data} plan={plan} />
      </div>
      <WhatIf data={data} plan={plan} />
      <MonthByMonth data={data} plan={plan} />
    </Section>
  );
}

/* ------------------------------------------------------- costs and cash */

function CostsAndCash({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project } = data;
  const currency = project.currency;
  const latest = plan.measures.latest;
  const costs = plan.levers.monthlyCosts;
  if (!latest) return null;

  let headline: ReactNode;
  let note: ReactNode = null;
  let fraction = 0;
  if (!costs) {
    headline = <span className="text-faint">—</span>;
    note = "Add what the project costs a month to see how long your cash lasts.";
  } else if (plan.profitable) {
    headline = "Profitable";
    fraction = 1;
    note = `${formatMoney(latest.mrr - costs.value, currency)} a month above costs.`;
  } else if (plan.runwayMonths !== null && project.cashBalance > 0) {
    headline = `${formatMonths(plan.runwayMonths)} of cash left`;
    fraction = plan.runwayMonths / RUNWAY_FULL;
    note = plan.breakEvenAt
      ? `At this pace revenue covers costs from ${formatPeriod(plan.breakEvenAt)}.`
      : "At this pace revenue does not cover costs within 10 years.";
  } else {
    headline = `Spending ${formatMoney(costs.value - latest.mrr, currency)} more than you make`;
    note = "Add your cash on hand to see how long it lasts.";
  }

  return (
    <Section title="Costs and cash">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xl tracking-tight">
            {headline}
            {plan.runwayMonths !== null && project.cashBalance > 0 && (
              <Hint term="runway">{GLOSSARY.runway}</Hint>
            )}
          </p>
          <div className="mt-3">
            <SegmentBar fraction={fraction} label="Months of cash left" />
          </div>
          {note && <p className="mt-3 text-xs text-muted">{note}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <LeverInput
            label="Costs a month"
            hint={GLOSSARY.costs}
            prefix={currencySymbol(currency)}
            value={moneyInputValue(costs?.value)}
            source={costs?.source ?? null}
            parse={parseMoney}
            onSave={(v) => saveLevers(data, { monthlyCosts: v })}
            onReset={() => saveLevers(data, { monthlyCosts: null })}
            original={plan.measures.monthlyCosts ? formatMoney(plan.measures.monthlyCosts.value, currency) : undefined}
          />
          <LeverInput
            label="Cash on hand"
            hint={GLOSSARY.cash}
            prefix={currencySymbol(currency)}
            value={moneyInputValue(project.cashBalance)}
            source={null}
            parse={parseMoney}
            onSave={(v) =>
              getStorage().projects.save({ ...project, cashBalance: v, updatedAt: nowIso() })
            }
          />
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ page */

function Project({ data }: { data: ProjectData }) {
  const addMonth = useAddMonth();
  const plan = buildPlan({
    history: data.snapshots,
    goal: data.goal,
    assumptions: data.assumptions,
    cashBalance: data.project.cashBalance,
  });
  const latest = plan.measures.latest;
  // At least one finished month is missing since the last one entered.
  const behind = latest && monthsBetween(latest.period, currentPeriod()) >= 2;

  return (
    <div className="space-y-4">
      {behind && (
        <Notice>
          Your latest numbers are from {formatPeriod(latest.period)}.{" "}
          <button
            type="button"
            onClick={() => addMonth(addMonths(latest.period, 1))}
            className="text-foreground underline"
          >
            Add {formatPeriod(addMonths(latest.period, 1))}
          </button>{" "}
          to keep the plan honest.
        </Notice>
      )}
      <WhereYouAre data={data} plan={plan} />
      <WhereYouWantToGo data={data} plan={plan} />
      <WhatItTakes data={data} plan={plan} />
      <CostsAndCash data={data} plan={plan} />
      {latest && data.snapshots.length > 0 && (
        <p className="pt-2 text-center text-xs text-faint">
          Every number here is arithmetic on the months you entered.{" "}
          <Link href={`/projects/${data.project.id}/data`} className="underline hover:text-muted">
            See or edit them
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export function ProjectScreen() {
  return <ProjectGate>{(data) => <Project data={data} />}</ProjectGate>;
}
