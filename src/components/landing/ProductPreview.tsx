import { cx } from "@/components/ui";

/**
 * A still of the project page for the landing, drawn with plain HTML and
 * SVG (no chart library, no data loading). Numbers match the sample project.
 */

const MONTHS = [442, 541, 621, 762, 819, 941, 1040, 1120, 1200];
/** Plan line from the goal's baseline (Jun) towards €10k, compounded. */
const PLAN = [941, 1053, 1179, 1319, 1476, 1652, 1849];
const MAX = 2000;

function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      <span className="num flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-[10px]">{n}</span>
      {title}
    </p>
  );
}

function Chart() {
  const w = 320;
  const h = 120;
  const slots = MONTHS.length + 3;
  const slot = w / slots;
  const bar = slot * 0.5;
  const y = (v: number) => h - (v / MAX) * h;
  const x = (i: number) => i * slot + slot / 2;
  const plan = PLAN.map((v, i) => `${x(i + 5).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" aria-hidden>
      {MONTHS.map((v, i) => (
        <g key={i}>
          <rect x={x(i) - bar / 2} y={0} width={bar} height={h} rx={3} fill="var(--chart-track)" />
          <rect x={x(i) - bar / 2} y={y(v)} width={bar} height={h - y(v)} rx={3} fill="var(--chart-actual)" />
        </g>
      ))}
      <polyline points={plan} fill="none" stroke="var(--chart-plan)" strokeWidth={1.5} strokeDasharray="5 4" />
    </svg>
  );
}

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-border-strong bg-surface p-5 shadow-2xl shadow-black/20 sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Invoicely</p>
        <span className="rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">+ Add month</span>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-background/40 p-4">
        <Step n={1} title="Where you are" />
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl tracking-tight">€1,200</span>
          <span className="num rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px]">↑ 7.1%</span>
        </div>
        <Chart />
      </div>

      <div className="mt-3 space-y-3 rounded-2xl border border-border bg-background/40 p-4">
        <Step n={2} title="Where you want to go" />
        <p className="text-lg tracking-tight">
          <span className="num">€10,000</span> <span className="text-muted">a month by</span> Mar 2028
        </p>
        <div className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className={cx("h-2 flex-1 rounded-[2px]", i < 3 ? "bg-accent" : "bg-surface-3")} />
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2 rounded-2xl border border-border bg-background/40 p-4">
        <Step n={3} title="What it takes" />
        <p className="text-lg tracking-tight">
          Win about <span className="num">41</span> new customers a month
        </p>
        <p className="border-l-2 border-accent pl-3 text-xs text-muted">
          At your current pace you stall around €2,741 a month.
        </p>
      </div>
    </div>
  );
}
