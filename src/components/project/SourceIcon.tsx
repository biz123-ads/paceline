import type { SnapshotSource } from "@/domain";
import { KeyboardIcon, PlugIcon } from "@/components/icons";
import { SOURCE_LABELS } from "./labels";

/** Where a month's numbers came from: typed by hand or synced. */
export function SourceIcon({ source }: { source: SnapshotSource }) {
  const Icon = source === "manual" ? KeyboardIcon : PlugIcon;
  // aria-label rather than an sr-only span: an absolutely positioned span
  // inside a horizontally scrolling table escapes it and widens the page.
  return (
    <span
      role="img"
      aria-label={SOURCE_LABELS[source]}
      title={SOURCE_LABELS[source]}
      className="inline-flex"
    >
      <Icon />
    </span>
  );
}
