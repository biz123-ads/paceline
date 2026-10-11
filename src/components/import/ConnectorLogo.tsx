import { useId, type ReactNode } from "react";
import { cx } from "@/components/ui";

/** The apps the Data tab imports from. */
export type ConnectorId = "excel" | "google-sheets" | "numbers" | "stripe";

/*
 * Each app's current official icon: Excel (2025), Google Sheets (August 2026)
 * and Stripe from their published SVGs; Numbers redrawn from its 15.1 app
 * icon, which Apple ships only as a bitmap. The marks belong to their owners.
 * Gradient ids come from useId, so a mark can appear more than once a page.
 */

const EXCEL_BACK =
  "M69.43 159.72C69.43 125.2 97.41 97.22 131.92 97.22H486.01V458.33C486.01 481.34 467.36 500 444.35 500H152.74C106.73 500 69.43 462.69 69.43 416.67Z";
const EXCEL_FOLD =
  "M69.43 229.17C69.43 194.65 97.41 166.67 131.92 166.67H319.38C296.37 166.67 277.72 185.33 277.72 208.34V291.67C277.72 314.68 259.07 333.34 236.06 333.34H152.75C106.74 333.34 69.44 370.65 69.44 416.67V229.17Z";
const EXCEL_TOP =
  "M69.43 83.33C69.43 37.31 106.73 0 152.74 0H319.37V166.67H152.74C106.73 166.67 69.43 203.98 69.43 250Z";
const EXCEL_CORNER =
  "M319.37 0H444.34C467.35 0 486 18.65 486 41.66V125.01C486 148.02 467.35 166.67 444.34 166.67H319.37C296.36 166.67 277.71 148.02 277.71 125.01V41.66C277.71 18.65 296.36 0 319.37 0Z";
const EXCEL_TILE =
  "M45.13 236.11H177.04C201.96 236.11 222.17 256.32 222.17 281.24V413.2C222.17 438.13 201.96 458.33 177.04 458.33H45.13C20.21 458.33 0 438.13 0 413.2V281.24C0 256.32 20.21 236.11 45.13 236.11Z";
const EXCEL_X =
  "M169.48 410.71H135.23L113.73 370.24C112.96 368.82 112.37 367.7 111.96 366.87 111.61 365.99 111.22 364.98 110.81 363.86H110.46C109.93 365.28 109.43 366.43 108.96 367.31 108.49 368.2 107.93 369.29 107.28 370.59L84.98 410.7H52.68L91.44 347.12 55.34 283.72H89.14L108.25 319.85C109.02 321.33 109.67 322.63 110.2 323.75 110.79 324.81 111.38 326.08 111.97 327.56H112.32C113.14 325.85 113.79 324.49 114.27 323.49 114.8 322.49 115.51 321.16 116.39 319.51L136.21 283.74H168.42L131.79 346.17 169.49 410.72Z";

function Excel({ id }: { id: string }) {
  const fill = (n: number) => `url(#${id}${n})`;
  return (
    <>
      <defs>
        <radialGradient id={`${id}0`} gradientUnits="userSpaceOnUse" cx="-746.66" cy="781.44" r="13.89" gradientTransform="matrix(-28.326 -29.808 -23.119 21.98 -2596.39 -38900.309)">
          <stop offset="0.06" stopColor="#379539" />
          <stop offset="0.42" stopColor="#297c2d" />
          <stop offset="0.7" stopColor="#15561c" />
        </radialGradient>
        <radialGradient id={`${id}1`} gradientUnits="userSpaceOnUse" cx="-773.19" cy="771.25" r="13.89" gradientTransform="matrix(-11.976 -11.581 -8.959 9.268 -2155.12 -15858.88)">
          <stop offset="0" stopColor="#073b10" stopOpacity="0.7" />
          <stop offset="0.99" stopColor="#084a13" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}2`} gradientUnits="userSpaceOnUse" x1="69.43" y1="291.67" x2="260.84" y2="291.67">
          <stop offset="0" stopColor="#52d17c" />
          <stop offset="0.33" stopColor="#4aa647" />
        </linearGradient>
        <linearGradient id={`${id}3`} gradientUnits="userSpaceOnUse" x1="194.4" y1="166.67" x2="194.4" y2="340.32">
          <stop offset="0" stopColor="#29852f" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#4aa647" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}4`} gradientUnits="userSpaceOnUse" x1="80.49" y1="204.78" x2="311.45" y2="4.46">
          <stop offset="0" stopColor="#66d052" />
          <stop offset="1" stopColor="#85e972" />
        </linearGradient>
        <radialGradient id={`${id}5`} gradientUnits="userSpaceOnUse" cx="-824.11" cy="810.99" r="13.89" gradientTransform="matrix(-9.02 0 0 19.09 -7120.4 -15378.69)">
          <stop offset="0.29" stopColor="#4eb43b" />
          <stop offset="1" stopColor="#72cc61" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}6`} gradientUnits="userSpaceOnUse" x1="182.11" y1="125" x2="69.43" y2="125">
          <stop offset="0.18" stopColor="#c0e075" stopOpacity="0" />
          <stop offset="1" stopColor="#d1eb95" />
        </linearGradient>
        <radialGradient id={`${id}7`} gradientUnits="userSpaceOnUse" cx="-769.14" cy="808.9" r="13.89" gradientTransform="matrix(-16.908 -13.682 13.641 -16.863 -23523.369 3309.71)">
          <stop offset="0.44" stopColor="#79e96d" />
          <stop offset="1" stopColor="#d0eb76" />
        </radialGradient>
        <radialGradient id={`${id}8`} gradientUnits="userSpaceOnUse" cx="-675.64" cy="793.28" r="13.89" gradientTransform="matrix(15.992 15.998 45.542 -45.548 -25315.85 47178.18)">
          <stop offset="0" stopColor="#20a85e" />
          <stop offset="0.94" stopColor="#09442a" />
        </radialGradient>
        <radialGradient id={`${id}9`} gradientUnits="userSpaceOnUse" cx="-657.62" cy="853.99" r="13.89" gradientTransform="matrix(0 11.2 12.9 0 -10902.85 7734.8)">
          <stop offset="0.58" stopColor="#33a662" stopOpacity="0" />
          <stop offset="0.97" stopColor="#98f0b0" stopOpacity="0.3" />
        </radialGradient>
      </defs>
      <path fill={fill(0)} d={EXCEL_BACK} />
      <path fill={fill(1)} d={EXCEL_BACK} />
      <path fill={fill(2)} d={EXCEL_FOLD} />
      <path fill={fill(3)} d={EXCEL_FOLD} />
      <path fill={fill(4)} d={EXCEL_TOP} />
      <path fill={fill(5)} d={EXCEL_TOP} />
      <path fill={fill(6)} d={EXCEL_TOP} />
      <path fill={fill(7)} d={EXCEL_CORNER} />
      <path fill={fill(8)} d={EXCEL_TILE} />
      <path fill={fill(9)} d={EXCEL_TILE} />
      <path fill="#fff" d={EXCEL_X} />
    </>
  );
}

function GoogleSheets({ id }: { id: string }) {
  return (
    <>
      <defs>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="24" y="32" width="160" height="128">
          <rect x="24" y="32" width="160" height="128" rx="20" fill="#fff" />
        </mask>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="130.24" y1="0" x2="28.76" y2="0">
          <stop stopColor="#0ebc5f" />
          <stop offset="0.95" stopColor="#78c9ff" />
        </linearGradient>
        <filter id={`${id}f`} filterUnits="userSpaceOnUse" x="-4" y="33" width="168" height="126" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <g transform="rotate(180 400 290.91)">
        <path
          fill="#009954"
          d="M0 193.64C0 152.99 0 132.66 6.38 116.54A90.91 90.91 0 0 1 57.45 65.48C73.57 59.09 93.89 59.09 134.55 59.09H410.91C451.56 59.09 471.89 59.09 488.01 65.47A90.91 90.91 0 0 1 539.07 116.54C545.45 132.66 545.45 152.99 545.45 193.64V388.18C545.45 428.83 545.45 449.16 539.07 465.28A90.91 90.91 0 0 1 488.01 516.34C471.89 522.73 451.56 522.73 410.91 522.73H134.55C93.89 522.73 73.57 522.73 57.44 516.34A90.91 90.91 0 0 1 6.38 465.28C0 449.16 0 428.83 0 388.18Z"
        />
        <g mask={`url(#${id}m)`} transform="matrix(4.5454545 0 0 4.5454545 -36.363636 -145.45454)">
          <path fill="#0ebc5f" d="M24 32h160v128H24Z" />
          <g filter={`url(#${id}f)`}>
            <rect x="8" y="45" width="144" height="102" rx="25.6" fill={`url(#${id}g)`} />
          </g>
        </g>
        <path
          stroke="#fff"
          strokeLinecap="round"
          strokeWidth="54.55"
          d="M327.27 404.55H709.09M618.18 490.91V200"
        />
      </g>
    </>
  );
}

function Numbers({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#008400" />
          <stop offset="0.5" stopColor="#006504" />
          <stop offset="1" stopColor="#00333b" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1ba31e" />
          <stop offset="0.55" stopColor="#0b900e" />
          <stop offset="1" stopColor="#57c41b" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ceff6d" />
          <stop offset="1" stopColor="#99ee4f" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.4" fill={`url(#${id}b)`} />
      <g fill={`url(#${id}c)`} stroke="#7cf05a" strokeOpacity="0.55" strokeWidth="0.3">
        <rect x="4.78" y="12" width="4.43" height="6.29" rx="1.1" />
        <rect x="9.9" y="3.03" width="4.43" height="15.26" rx="1.1" />
        <rect x="14.8" y="7.57" width="4.43" height="10.72" rx="1.1" />
      </g>
      <rect x="4.89" y="19.34" width="14.21" height="1.63" rx="0.815" fill={`url(#${id}l)`} />
    </>
  );
}

function Stripe() {
  return (
    <>
      <rect width="24" height="24" rx="5.4" fill="#635bff" />
      <path
        fill="#fff"
        transform="translate(4.8 4.8) scale(0.6)"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
      />
    </>
  );
}

const MARKS: Record<ConnectorId, { viewBox: string; draw: (id: string) => ReactNode }> = {
  excel: { viewBox: "0 0 486 500", draw: (id) => <Excel id={id} /> },
  "google-sheets": { viewBox: "0 0 800 581.82", draw: (id) => <GoogleSheets id={id} /> },
  numbers: { viewBox: "0 0 24 24", draw: (id) => <Numbers id={id} /> },
  stripe: { viewBox: "0 0 24 24", draw: () => <Stripe /> },
};

/** An app's logo alone, fitted into a `size` px square. */
export function BrandMark({ id, size = 20 }: { id: ConnectorId; size?: number }) {
  const uid = useId();
  const { viewBox, draw } = MARKS[id];
  return (
    <svg viewBox={viewBox} width={size} height={size} aria-hidden className="shrink-0">
      {draw(uid)}
    </svg>
  );
}

/** One or more app logos on a neutral tile, as the Data tab shows its sources. */
export function ConnectorLogo({ ids }: { ids: ConnectorId[] }) {
  return (
    <span
      className={cx(
        "flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2",
        ids.length === 1 ? "w-10" : "px-2.5",
      )}
    >
      {ids.map((id) => (
        <BrandMark key={id} id={id} />
      ))}
    </span>
  );
}
