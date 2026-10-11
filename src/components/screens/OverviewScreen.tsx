"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ProjectData } from "@/components/data/hooks";
import { MrrChart } from "@/components/charts/MrrChart";
import { mrrSeries } from "@/components/charts/series";
import { GoalProgress } from "@/components/project/GoalProgress";
import { ProjectGate } from "@/components/project/ProjectGate";
import { SourceIcon } from "@/components/project/SourceIcon";
import { LeverValue } from "@/components/project/LeverValue";
import {
  ButtonLink,
  Card,
  CardHeader,
  DeltaBadge,
  Notice,
  Segmented,
  ScrollX,
  SegmentBar,
} from "@/components/ui";
import { ArrowRightIcon, PlusIcon } from "@/components/icons";
import {
  formatMoney,
  formatMonths,
  formatNumber,
  formatPercent,
  formatPeriod,
} from "@/lib/format";
import { addMonths, currentPeriod, monthsBetween } from "@/lib/period";
import { buildPlan, type PlanResult } from "@/plan/engine";

const RANGES = [
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "all", label: "All" },
] as const;
type Range = (typeof RANGES)[number]["value"];

/** Months of plan shown after the last real month. */
const PLAN_LOOKAHEAD = 6;
/** Runway bar is full at this many months. */
const RUNWAY_FULL = 24;

function MrrCard({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const [range, setRange] = useState<Range>("12");
  const { project, snapshots } = data;
  const { latest, previous, mrrChange, lowConfidence } = plan.measures;
  const currency = project.currency;

  if (!latest) {
    return (
      <Card className="flex min-h-80 flex-col items-center justify-center text-center lg:col-span-2">
        <p className="font-medium">No months yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Enter MRR and paying customers for the last few months. Three months is
          enough to start planning.
        </p>
        <ButtonLink href={`/projects/${project.id}/data#add`} variant="primary" className="mt-5">
          <PlusIcon /> Add your first month
        </ButtonLink>
      </Card>
    );
  }

  const first = snapshots[0].period;
  const from =
    range === "all"
      ? first
      : [first, addMonths(latest.period, -(Number(range) - 1))].sort().at(-1)!;
  const planEnd = plan.planLine.at(-1)?.period;
  const to =
    planEnd && monthsBetween(latest.period, planEnd) > 0
      ? [planEnd, addMonths(latest.period, PLAN_LOOKAHEAD)].sort()[0]
      : latest.period;
  const series = mrrSeries({ from, to, snapshots, plan: plan.planLine });

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">MRR · {formatPeriod(latest.period)}</p>
          <p className="num mt-1 text-4xl tracking-tight sm:text-[44px]">
            {formatMoney(latest.mrr, currency)}
          </p>
        </div>
        {mrrChange !== null && previous && (
          <DeltaBadge
            value={mrrChange}
            label={`${formatMoney(mrrChange, currency, { signed: true })}${
              previous.mrr > 0 ? ` (${formatPercent(mrrChange / previous.mrr, { signed: true })})` : ""
            }`}
          />
        )}
      </div>
      <div className="mt-4 mb-5">
        <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />
      </div>
      <MrrChart data={series} currency={currency} />
      {lowConfidence && (
        <p className="mt-4 text-xs text-muted">
          Only {plan.measures.monthsOfHistory} {plan.measures.monthsOfHistory === 1 ? "month" : "months"} of
          data: trends and measured values are indicative until you have at least 3.
        </p>
      )}
    </Card>
  );
}

function GoalSection({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project, goal } = data;
  const latest = plan.measures.latest;
  const g = plan.goal;
  const planHref = `/projects/${project.id}/plan`;

  if (!goal || !latest || !g) {
    return (
      <div>
        <h2 className="text-[15px] font-medium">Goal</h2>
        <p className="mt-2 text-sm text-muted">
          {latest
            ? "Set a target, like €10k MRR by next year, and see what it takes."
            : "Once you have numbers, set a target and see what it takes."}
        </p>
        <ButtonLink href={planHref} size="sm" className="mt-3">
          Set a goal <ArrowRightIcon />
        </ButtonLink>
      </div>
    );
  }

  const currency = project.currency;
  let status: { text: string; tone: string };
  if (g.reached) status = { text: "Goal reached", tone: "text-accent" };
  else if (g.deadlinePassed) status = { text: "Deadline passed", tone: "text-foreground" };
  else if (g.vsPlan && g.vsPlan.delta >= 0)
    status = {
      text: `↑ ${formatMoney(g.vsPlan.delta, currency, { whole: true })} ahead of plan`,
      tone: "text-foreground",
    };
  else if (g.vsPlan)
    status = {
      text: `↓ ${formatMoney(-g.vsPlan.delta, currency, { whole: true })} behind plan`,
      tone: "text-foreground",
    };
  else status = { text: "Plan starts later", tone: "text-muted" };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Goal{goal.label ? ` · ${goal.label}` : ""}</h2>
        <Link href={planHref} className="text-xs text-muted hover:text-foreground">
          Open plan →
        </Link>
      </div>
      <GoalProgress goal={goal} currentMrr={latest.mrr} currency={currency} />
      <p className={`mt-3 text-sm ${status.tone}`}>{status.text}</p>
      {g.requiredNewPerMonth !== null && (
        <p className="mt-1 text-xs text-muted">
          Needs <span className="num text-foreground">{formatNumber(g.requiredNewPerMonth, 1)}</span>{" "}
          new customers a month · you get{" "}
          <span className="num text-foreground">
            {formatNumber(plan.levers.newCustomersPerMonth.value, 1)}
          </span>
        </p>
      )}
    </div>
  );
}

function RunwaySection({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const { project } = data;
  const detailsHref = `/projects/${project.id}/details`;

  let value: string;
  let fraction = 0;
  let note: ReactNode = null;
  if (!plan.measures.latest) {
    value = "—";
  } else if (plan.profitable === null) {
    value = "—";
    note = (
      <>
        Add monthly costs in{" "}
        <Link href={`/projects/${project.id}/data`} className="underline">
          Data
        </Link>{" "}
        to see runway and break-even.
      </>
    );
  } else if (plan.profitable) {
    value = "Profitable";
    fraction = 1;
    note = "MRR covers this month's costs.";
  } else if (plan.runwayMonths !== null && project.cashBalance > 0) {
    value = formatMonths(plan.runwayMonths);
    fraction = plan.runwayMonths / RUNWAY_FULL;
    note = plan.breakEvenAt
      ? `At this pace you break even in ${formatPeriod(plan.breakEvenAt)}.`
      : "At this pace you do not break even within 10 years.";
  } else {
    value = "Burning cash";
    note = (
      <>
        Add your cash on hand in{" "}
        <Link href={detailsHref} className="underline">
          Details
        </Link>{" "}
        to see how long it lasts.
      </>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-medium">Runway</h2>
        <span className="num text-sm text-foreground">
          {value}
        </span>
      </div>
      <SegmentBar fraction={fraction} label="Runway" />
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </div>
  );
}

function KeyNumbers({ data, plan }: { data: ProjectData; plan: PlanResult }) {
  const latest = plan.measures.latest;
  const { levers } = plan;
  const currency = data.project.currency;
  if (!latest) return null;
  return (
    <div>
      <h2 className="mb-3 text-[15px] font-medium">Key numbers</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Paying customers</dt>
          <dd className="num mt-0.5">{formatNumber(latest.payingCustomers)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Revenue / customer</dt>
          <dd className="mt-0.5">
            {levers.arpu ? (
              <LeverValue source={levers.arpu.source}>
                {formatMoney(levers.arpu.value, currency)}
              </LeverValue>
            ) : (
              <span className="text-faint">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Churn / month</dt>
          <dd className="mt-0.5">
            <LeverValue source={levers.churnRate.source}>
              {formatPercent(levers.churnRate.value)}
            </LeverValue>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">New customers / month</dt>
          <dd className="mt-0.5">
            <LeverValue source={levers.newCustomersPerMonth.source}>
              {formatNumber(levers.newCustomersPerMonth.value, 1)}
            </LeverValue>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function RecentMonths({ data }: { data: ProjectData }) {
  const { project, snapshots } = data;
  const rows = snapshots.slice(-6).reverse();
  const byPeriod = new Map(snapshots.map((s) => [s.period, s]));
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Recent months"
        action={
          <ButtonLink href={`/projects/${project.id}/data`} size="sm">
            View all <ArrowRightIcon />
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing entered yet.</p>
      ) : (
        <ScrollX label="Recent months table">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="pb-2 font-normal">Month</th>
                <th className="pb-2 text-right font-normal">Change</th>
                <th className="pb-2 text-right font-normal">Customers</th>
                <th className="pb-2 text-right font-normal">Costs</th>
                <th className="pb-2 text-right font-normal">MRR</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const prev = byPeriod.get(addMonths(s.period, -1));
                const change = prev ? s.mrr - prev.mrr : null;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-3">{formatPeriod(s.period)}</td>
                    <td className="py-3 text-right">
                      {change === null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <DeltaBadge
                          value={change}
                          label={
                            prev && prev.mrr > 0
                              ? formatPercent(change / prev.mrr)
                              : formatMoney(change, project.currency)
                          }
                        />
                      )}
                    </td>
                    <td className="num py-3 text-right">{formatNumber(s.payingCustomers)}</td>
                    <td className="num py-3 text-right text-muted">
                      {s.costs !== undefined ? formatMoney(s.costs, project.currency) : "—"}
                    </td>
                    <td className="num py-3 text-right">{formatMoney(s.mrr, project.currency)}</td>
                    <td className="py-3 pl-3 text-right text-faint">
                      <SourceIcon source={s.source} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollX>
      )}
    </Card>
  );
}

function About({ data }: { data: ProjectData }) {
  const { project } = data;
  const items = [
    { label: "Pricing", value: project.pricingSummary },
    { label: "For", value: project.targetAudience },
    { label: "Launched", value: project.launchDate },
  ].filter((i) => i.value);
  return (
    <Card>
      <CardHeader
        title="About"
        action={
          <ButtonLink href={`/projects/${project.id}/details`} size="sm">
            Edit
          </ButtonLink>
        }
      />
      {project.description ? (
        <p className="text-sm leading-relaxed text-muted">{project.description}</p>
      ) : (
        <p className="text-sm text-faint">No description yet.</p>
      )}
      {items.length > 0 && (
        <dl className="mt-4 space-y-2 text-sm">
          {items.map((i) => (
            <div key={i.label} className="flex gap-3">
              <dt className="w-20 shrink-0 text-muted">{i.label}</dt>
              <dd className="min-w-0">{i.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {project.techStack.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {project.techStack.map((t) => (
            <li key={t} className="rounded-md bg-surface-3 px-2 py-0.5 text-xs text-muted">
              {t}
            </li>
          ))}
        </ul>
      )}
      {project.websiteUrl && (
        <a
          href={project.websiteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
        >
          {project.websiteUrl.replace(/^https?:\/\//, "")} ↗
        </a>
      )}
    </Card>
  );
}

function Overview({ data }: { data: ProjectData }) {
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
            Your last month is {formatPeriod(latest.period)}.{" "}
            <Link href={`/projects/${data.project.id}/data#add`} className="text-foreground underline">
              Add the months since
            </Link>{" "}
            to keep the plan honest.
          </Notice>
        )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MrrCard data={data} plan={plan} />
        <Card className="flex flex-col gap-6">
          <GoalSection data={data} plan={plan} />
          <hr className="border-border" />
          <RunwaySection data={data} plan={plan} />
          {latest && <hr className="border-border" />}
          <KeyNumbers data={data} plan={plan} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentMonths data={data} />
        <About data={data} />
      </div>
    </div>
  );
}

export function OverviewScreen() {
  return <ProjectGate>{(data) => <Overview data={data} />}</ProjectGate>;
}
