import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Small presentational building blocks shared by every screen. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("rounded-2xl border border-border bg-surface p-5", className)}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
  hint,
}: {
  title: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-medium">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-background hover:bg-foreground/85",
  secondary:
    "border border-border-strong bg-surface-2 text-foreground hover:bg-surface-3",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};

function buttonClass(variant: ButtonVariant, size: "sm" | "md", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
    size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
    BUTTON_STYLES[variant],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

/** Monochrome pill with an arrow, like "↑ 18.3%": up is white, down is grey. */
export function DeltaBadge({
  value,
  label,
  className,
}: {
  /** Sign decides the colour; zero is neutral. */
  value: number;
  label: string;
  className?: string;
}) {
  const tone = value > 0 ? "text-foreground" : "text-muted";
  return (
    <span
      className={cx(
        "num inline-flex items-center gap-1 rounded-md bg-surface-3 px-2 py-0.5 text-xs",
        tone,
        className,
      )}
    >
      <span aria-hidden>{value > 0 ? "↑" : value < 0 ? "↓" : "→"}</span>
      {label}
    </span>
  );
}

/** Pill buttons, one selected (the "1 Week / 1 Month / 1 Year" control). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 rounded-full border px-3 text-xs transition-colors",
            o.value === value
              ? "border-border-strong bg-surface-3 text-foreground"
              : "border-border text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Row of small blocks, filled up to `fraction` (the "score" bar). Blue is
 * kept for the goal; everything else is neutral.
 */
export function SegmentBar({
  fraction,
  segments = 20,
  tone = "neutral",
  label,
}: {
  fraction: number;
  segments?: number;
  tone?: "accent" | "neutral";
  label: string;
}) {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * segments);
  const on = tone === "accent" ? "bg-accent" : "bg-foreground/85";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(1, fraction) * 100)}
      className="flex gap-[3px]"
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={cx("h-2.5 flex-1 rounded-[2px]", i < filled ? on : "bg-surface-3")}
        />
      ))}
    </div>
  );
}

// Form controls need hooks (ids that tie labels to inputs), so they live in
// a client module; re-exported here so every screen imports from one place.
export { Field, Select, TextArea, TextInput } from "./form";

/** Neutral by default; "strong" for things worth reading first. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "strong";
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "strong"
          ? "border-border-strong bg-surface-2 text-foreground"
          : "border-border bg-surface text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx("animate-pulse rounded-2xl bg-surface", className)} />
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-medium tracking-tight sm:text-[28px]">
          {title}
        </h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * Horizontal scroller for wide tables inside a Card. Focusable so keyboard
 * users can scroll it, unless the table has its own inputs (`focusable=false`).
 */
export function ScrollX({
  label,
  children,
  focusable = true,
  className,
}: {
  label: string;
  children: ReactNode;
  focusable?: boolean;
  className?: string;
}) {
  return (
    <div
      role={focusable ? "region" : undefined}
      aria-label={focusable ? label : undefined}
      tabIndex={focusable ? 0 : undefined}
      className={cx(
        "-mx-5 overflow-x-auto px-5 outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
        className,
      )}
    >
      {children}
    </div>
  );
}
