import type { ConnectMethod, ConnectorStatus } from "@/import/connectors";
import { cx } from "@/components/ui";

export const STATUS_LABELS: Record<ConnectorStatus, string> = {
  available: "Available",
  "via-csv": "Via CSV",
  planned: "Coming soon",
};

/** How the direct connection will sign in, for a sentence on its page. */
export function methodText(method: ConnectMethod, name: string): string {
  switch (method) {
    case "file":
      return `Drop in the ${name} file as it is, no export step.`;
    case "oauth":
      return `Sign in with ${name} and allow read-only access.`;
    case "api-key":
      return `Paste a read-only API key from ${name}.`;
  }
}

/** Monochrome: what works today reads strongest. */
export function StatusBadge({ status }: { status: ConnectorStatus }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] whitespace-nowrap",
        status === "available"
          ? "border-border-strong bg-surface-3 text-foreground"
          : status === "via-csv"
            ? "border-border-strong text-muted"
            : "border-border text-faint",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
