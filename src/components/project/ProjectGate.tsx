"use client";

import type { ReactNode } from "react";
import { useProjectData, type ProjectData } from "@/components/data/hooks";
import { ButtonLink, Card, Skeleton } from "@/components/ui";

/** Loads the project in the URL and handles loading, errors and not found. */
export function ProjectGate({
  children,
}: {
  children: (data: ProjectData) => ReactNode;
}) {
  const state = useProjectData();

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <p className="text-sm text-danger">
          Could not open the browser database: {state.error.message}
        </p>
      </Card>
    );
  }
  if (!state.data) {
    return (
      <Card className="py-12 text-center">
        <p className="font-medium">Project not found</p>
        <p className="mt-1 text-sm text-muted">
          It may have been deleted, or it lives in another browser.
        </p>
        <ButtonLink href="/projects" className="mt-5">
          Back to projects
        </ButtonLink>
      </Card>
    );
  }
  return <>{children(state.data)}</>;
}
