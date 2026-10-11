import type { ReactNode } from "react";
import type { ValueSource } from "@/plan/measure";
import { cx } from "@/components/ui";

export const SOURCE_TAGS: Record<ValueSource, { label: string; title: string; className: string }> = {
  measured: {
    label: "measured",
    title: "Measured from the months you entered.",
    className: "text-faint",
  },
  estimated: {
    label: "estimated",
    title: "Inferred from the change in paying customers. Enter new and churned customers to measure it.",
    className: "text-faint",
  },
  default: {
    label: "assumed",
    title: "Not enough data to measure it, so this is an assumption. Change it in the plan.",
    className: "text-muted underline decoration-dotted underline-offset-2",
  },
  user: {
    label: "your value",
    title: "You set this value in the plan.",
    className: "text-accent",
  },
};

/** A number plus a small tag saying where it comes from. */
export function LeverValue({
  source,
  children,
}: {
  source: ValueSource;
  children: ReactNode;
}) {
  const tag = SOURCE_TAGS[source];
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="num">{children}</span>
      <span title={tag.title} className={cx("text-[10px]", tag.className)}>
        {tag.label}
      </span>
    </span>
  );
}
