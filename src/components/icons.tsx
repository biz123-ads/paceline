import type { SVGProps } from "react";

/** Inline stroke icons (16px grid), so there is no icon dependency. */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  );
}

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden {...props}>
      <rect x="1" y="12" width="5" height="9" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="8.5" y="7" width="5" height="14" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="16" y="1" width="5" height="20" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}

export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </Icon>
);

export const ChartIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2 14h12M4 11V8M7 11V5M10 11V7M13 11V3" />
  </Icon>
);

export const TableIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M2 6h12M2 9.5h12M6 6v7.5" />
  </Icon>
);

export const TargetIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="3" />
    <circle cx="8" cy="8" r="0.6" fill="currentColor" />
  </Icon>
);

export const InfoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.2V11M8 5v.01" />
  </Icon>
);

export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </Icon>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);

export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" />
  </Icon>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
  </Icon>
);

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10.5 2.5l3 3L6 13H3v-3z" />
  </Icon>
);

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" />
  </Icon>
);

export const UploadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 10V2M4.5 5.5 8 2l3.5 3.5M2.5 13.5h11" />
  </Icon>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 8.5 6.5 12 13 4.5" />
  </Icon>
);

/** Data coming in: an arrow entering a tray. */
export const ImportIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9.5 2.5h3a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-3M2 8h8M7 5l3 3-3 3" />
  </Icon>
);

export const ArrowLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M13 8H3M6.5 4.5 3 8l3.5 3.5" />
  </Icon>
);

/** Hand-typed numbers. */
export const KeyboardIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
    <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6" />
  </Icon>
);

/** Numbers that came from a connected service. */
export const PlugIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3" />
  </Icon>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 6l4 4 4-4" />
  </Icon>
);

/** The assistant: a four-point spark. */
export const SparkIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 1.5c.4 3.3 1.2 4.1 4.5 4.5-3.3.4-4.1 1.2-4.5 4.5-.4-3.3-1.2-4.1-4.5-4.5 3.3-.4 4.1-1.2 4.5-4.5zM12.5 10.5c.2 1.4.6 1.8 2 2-1.4.2-1.8.6-2 2-.2-1.4-.6-1.8-2-2 1.4-.2 1.8-.6 2-2z" />
  </Icon>
);

export const UserIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.6-2.4 2.6-3.8 5-3.8s4.4 1.4 5 3.8" />
  </Icon>
);

export const CloudIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.7-1 3.5 3.5 0 0 1-.3 7z" />
  </Icon>
);

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </Icon>
);
