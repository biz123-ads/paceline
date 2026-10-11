"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjectData } from "@/components/data/hooks";
import { ButtonLink, cx } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { KIND_LABELS, STAGE_LABELS } from "./labels";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Plan", segment: "/plan" },
  { label: "Data", segment: "/data" },
  { label: "Details", segment: "/details" },
] as const;

export function ProjectHeader() {
  const pathname = usePathname();
  const state = useProjectData();
  // "/projects/<id>/data" -> "/projects/<id>"
  const base = pathname.split("/").slice(0, 3).join("/");
  const project = state.status === "ready" ? state.data?.project : undefined;

  // Missing project: the page itself shows the not-found message.
  if (state.status === "ready" && !project) return null;

  return (
    <div className="mb-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-medium tracking-tight sm:text-[28px]">
            {project?.name ?? <span className="text-faint">…</span>}
          </h1>
          {project && (
            <p className="mt-1 text-sm text-muted">
              {KIND_LABELS[project.kind]} · {STAGE_LABELS[project.stage]} ·{" "}
              {project.currency}
            </p>
          )}
        </div>
        <ButtonLink href={`${base}/data#add`} variant="primary">
          <PlusIcon /> Add month
        </ButtonLink>
      </div>
      <div className="border-b border-border">
        <nav
          aria-label="Project"
          className="-mb-px flex gap-1 overflow-x-auto text-sm [scrollbar-width:none]"
        >
          {TABS.map(({ label, segment }) => {
            const href = `${base}${segment}`;
            const active = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "border-b-2 px-3 py-2.5 whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
