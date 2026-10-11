import type { ReactNode } from "react";
import { cx } from "@/components/ui";

/**
 * A still of the project page for the landing, drawn with plain HTML and
 * SVG (no chart library, no data loading). Numbers match the sample project.
 */

const MONTHS = [442, 541, 621, 762, 819, 941, 1040, 1120, 1200];
/** Plan line from the goal's baseline (Jun) towards €10k, compounded. */
const PLAN = [941, 1053, 1179, 1319, 1476, 1652, 1849];
const MAX = 2000;

function Chart() {
  const w = 320;
  const h = 110;
  const pad = 4;
  const slots = MONTHS.length + 2;
  const y = (v: number) => pad + (h - 2 * pad) * (1 - v / MAX);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (slots - 1);
  const points = (values: number[], offset = 0) =>
    values.map((v, i) => `${x(i + offset).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = MONTHS.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" aria-hidden>
      <polyline
        points={points(PLAN, 5)}
        fill="none"
        stroke="var(--chart-plan)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <polyline points={points(MONTHS)} fill="none" stroke="var(--chart-actual)" strokeWidth={2} />
      <circle cx={x(last)} cy={y(MONTHS[last])} r={3.5} fill="var(--chart-actual)" />
    </svg>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <p className="text-xs text-muted">{title}</p>
      {children}
    </div>
  );
}

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "space-y-3 rounded-2xl border border-border-strong bg-surface p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-medium">Invoicely</p>
        <span className="rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">+ Add month</span>
      </div>

      <Block title="Where you are">
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl tracking-tight">€1,200</span>
          <span className="num text-xs">↑ 7.1%</span>
        </div>
        <Chart />
      </Block>

      <Block title="Where you want to go">
        <p className="text-lg tracking-tight">
          <span className="num">€10,000</span> <span className="text-muted">a month by</span> Mar 2028
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full w-[12%] rounded-full bg-accent" />
        </div>
      </Block>

      <Block title="What it takes">
        <p className="text-lg tracking-tight">
          Win about <span className="num">41</span> new customers a month
        </p>
        <p className="text-xs text-muted">At your current pace you stall around €2,741 a month.</p>
      </Block>
    </div>
  );
}
