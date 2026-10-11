import type { Goal } from "@/domain";
import { formatMoney, formatPercent, formatPeriod } from "@/lib/format";
import { SegmentBar } from "@/components/ui";

/** "12% of €10,000 · by Mar 2028" with the segmented bar. */
export function GoalProgress({
  goal,
  currentMrr,
  currency,
  segments = 20,
}: {
  goal: Goal;
  currentMrr: number;
  currency: string;
  segments?: number;
}) {
  const progress = currentMrr / goal.targetMrr;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">
          Goal {formatMoney(goal.targetMrr, currency)}/mo · by {formatPeriod(goal.deadline)}
        </span>
        <span className="num text-accent">{formatPercent(Math.min(progress, 1), { digits: 0 })}</span>
      </div>
      <SegmentBar
        tone="accent"
        fraction={progress}
        segments={segments}
        label={`Progress towards ${formatMoney(goal.targetMrr, currency)} a month`}
      />
    </div>
  );
}
