"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { Assumptions, Goal } from "@/domain";
import type { ProjectData } from "@/components/data/hooks";
import { CostsChart } from "@/components/charts/CostsChart";
import { FlowChart } from "@/components/charts/FlowChart";
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
  ProgressBar,
  Segmented,
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
import { addMonths, currentPeriod, monthsBetween, periodRange } from "@/lib/period";
import {
  buildPlan,
  MAX_PROJECTION_MONTHS,
  project as projectPath,
  type PlanResult,
} from "@/plan/engine";
import { customerFlow } from "@/plan/flow";
import { LEVER_STEP, leverImpacts, type LeverImpact, type LeverName } from "@/plan/impact";
import type { Sourced, ValueSource } from "@/plan/measure";
import { getStorage } from "@/storage";

/** Real months shown in the chart. */
const CHART_HISTORY = 12;
/** The chart never looks further ahead than this. */
const CHART_MAX_AHEAD = 36;
/** Runway bar is full at this many months. */
const RUNWAY_FULL = 24;
/** The costs chart looks at most this far ahead for break-even. */
const COSTS_MAX_AHEAD = 36;

/* -------------------------------------------------------------- building */

/** One part of the page: where you are, the goal, what it takes, cash. */
function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-[15px] font-medium">{title}</h2>
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

const CHART_VIEWS = [
  { value: "revenue", label: "Revenue" },
  { value: "flow", label: "Won and lost" },
] as const;

type ChartView = (typeof CHART_VIEWS)[number]["value"];

/** Customers who joined against those who left, in a sentence. */
function flowSummary(flow: NonNullable<ReturnType<typeof customerFlow>>): string {
  const n = flow.months.length;
  const head = `${formatNumber(flow.joined)} ${flow.joined === 1 ? "customer" : "customers"} joined and ${formatNumber(flow.left)} left over ${n} ${n === 1 ? "month" : "months"}`;
  if (flow.joinedPerLeft === null) return `${head}.`;
  if (flow.left > flow.joined) return `${head}: more left than joined, so keeping customers matters most right now.`;
  return `${head}: about ${formatNumber(flow.joinedPerLeft, 1)} joined for every one who left.`;
}

function WhereYouAre({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, snapshots, goal } = data;
  const addMonth = useAddMonth();
  const [view, setView] = useState<ChartView>("revenue");
  const { latest, previous, mrrChange, lowConfidence, monthsOfHistory } = plan.measures;
  const currency = project.currency;

  if (!latest) {
    return (
      <Section title="Where you are">
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

  const first = snapshots[0].period;
  let from = [first, addMonths(latest.period, -(CHART_HISTORY - 1))].sort().at(-1)!;
  if (goal && goal.baselinePeriod < from && goal.baselinePeriod >= first) from = goal.baselinePeriod;
  // With a goal the chart runs to its date, so the plan line shows the way.
  const ahead =
    goal && monthsBetween(latest.period, goal.deadline) > 0
      ? Math.min(monthsBetween(latest.period, goal.deadline), CHART_MAX_AHEAD)
      : 0;
  const to = addMonths(latest.period, ahead);
  const flow = view === "flow" ? customerFlow(snapshots.filter((s) => s.period >= from)) : null;

  return (
    <Section
      title="Where you are"
      action={<Segmented label="Chart" options={CHART_VIEWS} value={view} onChange={setView} />}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Label>Monthly revenue · {formatPeriod(latest.period)}</Label>
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
              <Label>
                Paying customers
              </Label>
            </dt>
            <dd className="num mt-0.5 text-lg">{formatNumber(latest.payingCustomers)}</dd>
          </div>
          <div>
            <dt>
              <Label>
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
        {view === "revenue" ? (
          <MrrChart
            data={mrrSeries({ from, to, snapshots, plan: plan.planLine })}
            currency={currency}
          />
        ) : flow ? (
          <>
            <FlowChart months={flow.months} from={from} to={latest.period} />
            <p className="mt-4 text-sm text-muted">
              {flowSummary(flow)}
              <Hint term="won and lost">{GLOSSARY.flow}</Hint>
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center rounded-lg bg-surface-2 px-4 py-10 text-center">
            <p className="text-sm font-medium">Where do your customers come and go?</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Add how many customers joined and how many left each month. On the Data tab,
              open &ldquo;More columns&rdquo;; a Stripe import fills them in for you.
            </p>
            <ButtonLink href={`/projects/${project.id}/data`} className="mt-5">
              Fill them in
            </ButtonLink>
          </div>
        )}
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
      <Section title="Where you want to go">
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
      <Section title="Where you want to go">
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
        <ProgressBar
          tone="accent"
          fraction={g.progress}
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
    <p className="text-sm">
      <span className="text-muted">{subject}, </span>
      {body}
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
  /** Explains the label behind a "?"; plain labels go without. */
  hint?: string;
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
        {hint && <Hint term={label.toLowerCase()}>{hint}</Hint>}
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

const LEVER_TEXT: Record<LeverName, { title: string; detail: (i: LeverImpact, currency: string) => string }> = {
  price: {
    title: "Charge a little more",
    detail: (i, currency) => `${formatMoney(i.from, currency)} → ${formatMoney(i.to, currency)} a month`,
  },
  churn: {
    title: "Keep more customers",
    detail: (i) => `${formatPercent(i.from)} → ${formatPercent(i.to)} leave each month`,
  },
  newCustomers: {
    title: "Win more customers",
    detail: (i) => `${formatNumber(i.from, 1)} → ${formatNumber(i.to, 1)} new each month`,
  },
};

const LEVER_PATCH: Record<LeverName, (value: number) => Partial<Assumptions>> = {
  price: (v) => ({ arpu: v }),
  churn: (v) => ({ monthlyChurnRate: v }),
  newCustomers: (v) => ({ newCustomersPerMonth: v }),
};

/** Which lever brings the goal closest, each improved by the same share. */
function WhatMovesIt({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const goal = data.goal!;
  const latest = plan.measures.latest!;
  const { levers } = plan;
  const currency = data.project.currency;
  if (!levers.arpu) return null;

  const result = leverImpacts({
    from: latest.period,
    startCustomers: latest.payingCustomers,
    arpu: levers.arpu.value,
    churn: levers.churnRate.value,
    newPerMonth: levers.newCustomersPerMonth.value,
    targetMrr: goal.targetMrr,
    deadline: goal.deadline,
  });
  if (!result) return null;
  const inMonths = result.measure === "months";
  const score = (i: LeverImpact) => (inMonths ? i.monthsSooner : i.extraAtDeadline);
  const top = Math.max(0, ...result.impacts.map(score));
  if (top === 0) return null;

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-sm font-medium">
        What moves it most{" "}
        <span className="font-normal text-muted">
          each number {formatPercent(LEVER_STEP)} better, one at a time.
        </span>
        <Hint term="what moves it most">{GLOSSARY.leverImpact}</Hint>
      </p>
      <ul className="mt-4 space-y-4">
        {result.impacts.map((i, k) => {
          const { title, detail } = LEVER_TEXT[i.lever];
          const effect = inMonths
            ? i.monthsSooner > 0
              ? `${formatMonths(i.monthsSooner)} sooner`
              : "same month"
            : `+${formatMoney(i.extraAtDeadline, currency, { whole: true })} a month by ${formatPeriod(goal.deadline)}`;
          return (
            <li key={i.lever}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
                <span>
                  {title} <span className="num text-muted">· {detail(i, currency)}</span>
                </span>
                <span className={cx("num", k === 0 ? "font-medium" : "text-muted")}>{effect}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cx("h-full rounded-full", k === 0 ? "bg-accent" : "bg-foreground/45")}
                    style={{ width: `${(score(i) / top) * 100}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => saveLevers(data, LEVER_PATCH[i.lever](i.to))}
                  aria-label={`Try it: ${title.toLowerCase()}`}
                  className="text-xs text-muted underline hover:text-foreground"
                >
                  Try it
                </button>
              </div>
            </li>
          );
        })}
      </ul>
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
      <Section title="What it takes">
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
    <Section title={`What it takes · ${formatMonths(g.monthsLeft)} left`}>
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
      <WhatMovesIt data={data} plan={plan} />
      <WhatIf data={data} plan={plan} />
      <MonthByMonth data={data} plan={plan} />
    </Section>
  );
}

/* ------------------------------------------------------- costs and cash */

/** Revenue and costs month by month, then at this pace until break-even. */
function RevenueAgainstCosts({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { snapshots, project } = data;
  const { levers } = plan;
  const latest = plan.measures.latest!;
  const costs = levers.monthlyCosts!.value;
  const from = [snapshots[0].period, addMonths(latest.period, -(CHART_HISTORY - 1))].sort().at(-1)!;
  const ahead = plan.breakEvenAt
    ? Math.min(Math.max(monthsBetween(latest.period, plan.breakEvenAt) + 3, 6), COSTS_MAX_AHEAD)
    : plan.profitable
      ? 6
      : 12;
  const projected = new Map(
    levers.arpu
      ? projectPath(
          latest.period,
          latest.payingCustomers,
          levers.arpu.value,
          levers.churnRate.value,
          levers.newCustomersPerMonth.value,
          ahead,
        ).map((p) => [p.period, p.mrr])
      : [],
  );
  const actual = new Map(snapshots.map((s) => [s.period, s]));
  const points = periodRange(from, addMonths(latest.period, ahead)).map((period) => ({
    period,
    revenue: actual.get(period)?.mrr,
    costs: actual.get(period)?.costs,
    projection: projected.get(period),
    costsAhead: period >= latest.period ? costs : undefined,
  }));

  return <CostsChart data={points} currency={project.currency} breakEvenAt={plan.breakEvenAt} />;
}

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
            <ProgressBar fraction={fraction} label="Months of cash left" />
          </div>
          {note && <p className="mt-3 text-xs text-muted">{note}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <LeverInput
            label="Costs a month"
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
      {costs && (
        <div className="mt-6">
          <RevenueAgainstCosts data={data} plan={plan} />
        </div>
      )}
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
