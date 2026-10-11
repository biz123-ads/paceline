"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { APP_NAME } from "@/config/app";
import { useProjectSummaries } from "@/components/data/hooks";
import { cx } from "@/components/ui";
import {
  GridIcon,
  LogoMark,
  MenuIcon,
  PlusIcon,
  SettingsIcon,
} from "@/components/icons";

function Brand() {
  return (
    <Link href="/projects" className="flex items-center gap-2.5 text-foreground">
      <LogoMark />
      <span className="text-[17px] font-medium tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

function NavLink({
  href,
  icon,
  active,
  children,
  onNavigate,
}: {
  href: string;
  icon?: ReactNode;
  active: boolean;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        active
          ? "bg-surface-3 text-foreground"
          : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      <span className="truncate">{children}</span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const summaries = useProjectSummaries();
  const projects = summaries.status === "ready" ? summaries.data : [];

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
      <NavLink href="/projects" icon={<GridIcon />} active={pathname === "/projects"} onNavigate={onNavigate}>
        Projects
      </NavLink>

      {projects.length > 0 && (
        <div className="mt-1 ml-[19px] flex flex-col gap-0.5 border-l border-border pl-3">
          {projects.map(({ project }) => {
            const href = `/projects/${project.id}`;
            return (
              <NavLink
                key={project.id}
                href={href}
                active={pathname === href || pathname.startsWith(`${href}/`)}
                onNavigate={onNavigate}
              >
                {project.name}
              </NavLink>
            );
          })}
        </div>
      )}
      <div className="ml-[19px] border-l border-border pl-3">
        <NavLink
          href="/projects/new"
          icon={<PlusIcon />}
          active={pathname === "/projects/new"}
          onNavigate={onNavigate}
        >
          New project
        </NavLink>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <NavLink
          href="/settings"
          icon={<SettingsIcon />}
          active={pathname === "/settings"}
          onNavigate={onNavigate}
        >
          Settings
        </NavLink>
      </div>
    </nav>
  );
}

/** Where the reference had "Get Pro": data is local, so remind about backups. */
function BackupCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">Saved in this browser</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        No account yet: clearing site data erases your numbers. Keep a backup.
      </p>
      <Link
        href="/settings"
        className="mt-3 inline-flex h-8 items-center rounded-lg bg-surface-3 px-3 text-xs font-medium hover:bg-border-strong"
      >
        Back up data →
      </Link>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 border-r border-border bg-sidebar p-4 md:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <SidebarNav />
        <BackupCard />
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-20 border-b border-border bg-sidebar/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          >
            <MenuIcon />
          </button>
        </div>
        {open && (
          <div className="border-t border-border px-4 py-3">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        )}
      </header>
    </>
  );
}

/** Same frame, no links: shown while the URL is being read. */
export function SidebarFallback() {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 border-r border-border bg-sidebar p-4 md:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
      </aside>
      <header className="h-14 border-b border-border bg-sidebar md:hidden" />
    </>
  );
}
