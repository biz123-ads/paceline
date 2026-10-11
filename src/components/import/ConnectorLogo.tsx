import type { CSSProperties } from "react";
import { contrastRatio } from "@/lib/contrast";
import { cx } from "@/components/ui";

/** The sources the Data tab offers today. */
export type ConnectorId = "csv" | "excel" | "google-sheets" | "numbers" | "stripe";

/**
 * Brand marks for the import sources, on a 24×24 grid. Paths come from
 * Simple Icons (CC0); Excel and Numbers are not in that set, so they are
 * simple drawings in the brand colour. The marks belong to their owners.
 */
interface Logo {
  /** Brand colour; null draws in the text colour. */
  color: string | null;
  d: string;
  /** Inner shapes are holes (the X in Excel's tile). */
  evenOdd?: true;
}

const TILE_PATH = "M6 2h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z";

const LOGOS: Record<ConnectorId, Logo> = {
  csv: {
    color: null,
    d: "M6 1.5h7.5V6a2.5 2.5 0 0 0 2.5 2.5H20v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2zM15 1.9l4.6 4.6H16a1 1 0 0 1-1-1zM7 11.5h10V13H7zM7 15h10v1.5H7zM7 18.5h6V20H7z",
    evenOdd: true,
  },
  excel: {
    color: "#107C41",
    d: `${TILE_PATH}M7 6.5h2.9L12 9.9l2.1-3.4H17l-3.5 5.5 3.5 5.5h-2.9L12 14.1l-2.1 3.4H7l3.5-5.5z`,
    evenOdd: true,
  },
  "google-sheets": {
    color: "#34A853",
    d: "M11.318 12.545H7.91v-1.909h3.41v1.91zM14.728 0v6h6l-6-6zm1.363 10.636h-3.41v1.91h3.41v-1.91zm0 3.273h-3.41v1.91h3.41v-1.91zM20.727 6.5v15.864c0 .904-.732 1.636-1.636 1.636H4.909a1.636 1.636 0 0 1-1.636-1.636V1.636C3.273.732 4.005 0 4.909 0h9.318v6.5h6.5zm-3.273 2.773H6.545v7.909h10.91v-7.91zm-6.136 4.636H7.91v1.91h3.41v-1.91z",
  },
  numbers: {
    color: "#21A453",
    d: `${TILE_PATH}M6.5 11h2.6v6.5H6.5zM10.7 6.5h2.6v11h-2.6zM14.9 9h2.6v8.5h-2.6z`,
    evenOdd: true,
  },
  stripe: {
    color: "#635BFF",
    d: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  },
};

// The tile behind each logo is --surface-2 in each theme (globals.css).
const TILE = { dark: "#181818", light: "#f6f6f6" };
/** Below this a brand colour is hard to make out, so the text colour is used. */
const MIN_CONTRAST = 2;

function fillOn(tile: string, color: string | null): string {
  return color && contrastRatio(color, tile) >= MIN_CONTRAST ? color : "var(--foreground)";
}

export function ConnectorLogo({
  id,
  size = "md",
}: {
  id: ConnectorId;
  size?: "md" | "lg";
}) {
  const { color, d, evenOdd } = LOGOS[id];
  // .brand-logo picks the variable for the current theme.
  const style = {
    "--logo-dark": fillOn(TILE.dark, color),
    "--logo-light": fillOn(TILE.light, color),
  } as CSSProperties;
  const glyph = size === "lg" ? 28 : 20;
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center border border-border bg-surface-2",
        size === "lg" ? "h-14 w-14 rounded-xl" : "h-10 w-10 rounded-lg",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={glyph}
        height={glyph}
        fill="currentColor"
        fillRule={evenOdd ? "evenodd" : undefined}
        aria-hidden
        className="brand-logo"
        style={style}
      >
        <path d={d} />
      </svg>
    </span>
  );
}
