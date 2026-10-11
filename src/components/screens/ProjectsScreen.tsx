"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProjectSummaries, type ProjectSummary } from "@/components/data/hooks";
import { GoalProgress } from "@/components/project/GoalProgress";
import { KIND_LABELS, STAGE_LABELS } from "@/components/project/labels";
import { Button, ButtonLink, Card, DeltaBadge, PageTitle, Skeleton } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { formatMoney, formatPercent, formatPeriod } from "@/lib/format";
import { sampleProjectBundle } from "@/lib/sample-project";
import { measureHistory } from "@/plan/measure";
import { getStorage } from "@/storage";
import { LocalDataClaim } from "@/components/account/LocalDataClaim";

function ProjectCard({ summary }: { summary: ProjectSummary }) {
  const { project, snapshots, goal } = summary;
  const { latest, previous, mrrChange } = measureHistory(snapshots);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{project.name}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {KIND_LABELS[project.kind]} · {STAGE_LABELS[project.stage]}
          </p>
        </div>
        {mrrChange !== null && previous && (
          <DeltaBadge
            value={mrrChange}
            label={previous.mrr > 0 ? formatPercent(mrrChange / previous.mrr) : formatMoney(mrrChange, project.currency)}
          />
        )}
      </div>

      <div className="mt-5">
        <p className="text-xs text-muted">
          Monthly revenue{latest ? ` · ${formatPeriod(latest.period)}` : ""}
        </p>
        <p className="num mt-1 text-2xl">
          {latest ? formatMoney(latest.mrr, project.currency) : <span className="text-faint">—</span>}
        </p>
      </div>

      <div className="mt-auto pt-5">
        {goal && latest ? (
          <GoalProgress goal={goal} currentMrr={latest.mrr} currency={project.currency} />
        ) : (
          <p className="text-xs text-faint">
            {latest ? "No goal yet" : "No months entered yet"}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function loadSample() {
    setLoading(true);
    const bundle = sampleProjectBundle();
    await getStorage().importAll(bundle);
    router.push(`/projects/${bundle.projects[0].id}`);
  }

  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <p className="text-lg font-medium">Where is your project heading?</p>
      <p className="mt-2 max-w-md text-sm text-muted">
        Add your monthly numbers, set a goal like “€10k a month by next year”, and see
        what it takes to get there: customers, churn, price, runway.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/projects/new" variant="primary">
          <PlusIcon /> Create a project
        </ButtonLink>
        <Button onClick={loadSample} disabled={loading}>
          {loading ? "Loading…" : "Explore with sample data"}
        </Button>
      </div>
    </Card>
  );
}

export function ProjectsScreen() {
  const state = useProjectSummaries();

  return (
    <>
      <PageTitle
        title="Projects"
        action={
          state.status === "ready" &&
          state.data.length > 0 && (
            <ButtonLink href="/projects/new" variant="primary">
              <PlusIcon /> New project
            </ButtonLink>
          )
        }
      />
      <LocalDataClaim />
      {state.status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      )}
      {state.status === "error" && (
        <Card>
          <p className="text-sm text-danger">
            Could not open the browser database: {state.error.message}
          </p>
        </Card>
      )}
      {state.status === "ready" &&
        (state.data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.data.map((summary) => (
              <ProjectCard key={summary.project.id} summary={summary} />
            ))}
          </div>
        ))}
    </>
  );
}
