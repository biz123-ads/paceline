"use client";

import { useState } from "react";
import { useProjectSummaries } from "@/components/data/hooks";
import { ButtonLink, Field, Select, Skeleton } from "@/components/ui";
import { PlusIcon, UploadIcon } from "@/components/icons";

/**
 * Months belong to a project, so the CSV import lives on its Data tab:
 * pick the project here and land there with the importer open.
 */
export function CsvImportLauncher() {
  const summaries = useProjectSummaries();
  const [chosen, setChosen] = useState<string | null>(null);

  if (summaries.status === "loading") return <Skeleton className="h-[60px] max-w-md rounded-lg" />;
  if (summaries.status === "error") {
    return (
      <p className="text-sm text-danger">
        Could not open the browser database: {summaries.error.message}
      </p>
    );
  }

  const projects = summaries.data.map((s) => s.project);
  if (projects.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/projects/new" variant="primary">
          <PlusIcon /> Create a project
        </ButtonLink>
        <span className="text-xs text-muted">Months belong to a project: create one first.</span>
      </div>
    );
  }

  const projectId =
    chosen && projects.some((p) => p.id === chosen) ? chosen : projects[0].id;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Into project" className="w-full sm:w-64">
        <Select value={projectId} onChange={(e) => setChosen(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <ButtonLink href={`/projects/${projectId}/data#import`} variant="primary">
        <UploadIcon /> Open the importer
      </ButtonLink>
    </div>
  );
}
