import Link from "next/link";
import type { ReactNode } from "react";
import {
  CONNECTOR_CATEGORIES,
  type Connector,
  type ConnectorMetric,
} from "@/import/connectors";
import { IMPORT_FIELDS, IMPORT_FIELD_LABELS } from "@/import/csv-import";
import { ConnectorLogo } from "@/components/import/ConnectorLogo";
import { CsvImportLauncher } from "@/components/import/CsvImportLauncher";
import { StatusBadge, methodText } from "@/components/import/labels";
import { Button, Card, CardHeader, Notice, cx } from "@/components/ui";
import { ArrowLeftIcon, CheckIcon, PlugIcon } from "@/components/icons";

const METRICS = IMPORT_FIELDS.filter((f): f is ConnectorMetric => f !== "period");

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mb-5 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] text-muted">
            {i + 1}
          </span>
          <span className="leading-relaxed text-muted">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Today's route in: a CSV file into a project's Data tab. */
function ImportNowCard({ connector }: { connector: Connector }) {
  const layout = (
    <>
      Lay it out with <span className="text-foreground">one row per month</span>: the month,
      MRR and paying customers. New customers, churned customers and costs are optional.
    </>
  );
  const pick =
    "Pick the project, open the importer and choose the file. You see a preview before anything is saved.";
  const steps = connector.csvExport
    ? [
        layout,
        <>
          In {connector.name}: <span className="text-foreground">{connector.csvExport}</span>.
        </>,
        pick,
      ]
    : [layout, `${pick} The importer also has a template to start from.`];

  return (
    <Card>
      <CardHeader
        title={connector.csvExport ? "Import it now, as CSV" : "Import it now"}
        hint="Columns are matched by name, in English or Italian; you can fix any match."
      />
      <Steps items={steps} />
      <CsvImportLauncher />
    </Card>
  );
}

function DirectCard({ connector }: { connector: Connector }) {
  if (connector.direct === null) {
    return (
      <Card>
        <CardHeader
          title="Direct connection"
          hint={`Not planned: ${connector.name} has no public API, so a CSV export stays the way in.`}
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Direct connection"
        // A planned connector already says so in its header.
        action={connector.status !== "planned" && <StatusBadge status="planned" />}
      />
      <p className="text-sm leading-relaxed text-muted">
        {methodText(connector.direct, connector.account ?? connector.name)}{" "}
        {connector.direct === "file"
          ? "Rows are read the same way as a CSV."
          : "Months then sync on their own, into the same monthly table, marked as synced. Nothing in your account is ever changed."}
      </p>
      <Button className="mt-4" disabled>
        <PlugIcon /> Connect {connector.name}
      </Button>
    </Card>
  );
}

function MetricsCard({ connector }: { connector: Connector }) {
  return (
    <Card>
      <CardHeader title="What it brings in" hint="Into the project's monthly table." />
      <ul className="space-y-2.5">
        {METRICS.map((metric) => {
          const included = connector.metrics.includes(metric);
          return (
            <li
              key={metric}
              className={cx(
                "flex items-center justify-between gap-3 text-sm",
                included ? "text-foreground" : "text-faint",
              )}
            >
              <span>{IMPORT_FIELD_LABELS[metric]}</span>
              {included ? <CheckIcon /> : <span aria-hidden>—</span>}
              <span className="sr-only">{included ? "Included" : "Not included"}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ConnectorScreen({ connector }: { connector: Connector }) {
  const category = CONNECTOR_CATEGORIES.find((c) => c.id === connector.category);

  return (
    <>
      <Link
        href="/import"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon /> All sources
      </Link>

      <div className="mb-6 flex items-start gap-4">
        <ConnectorLogo id={connector.id} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-medium tracking-tight sm:text-[28px]">
              {connector.name}
            </h1>
            <StatusBadge status={connector.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {category?.label} · {connector.summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {connector.status === "planned" ? (
            <>
              <DirectCard connector={connector} />
              <Notice>
                Until then, type the months into a project&apos;s Data tab, or{" "}
                <Link href="/import/csv" className="text-foreground underline underline-offset-4">
                  import them from a CSV
                </Link>
                .
              </Notice>
            </>
          ) : (
            <>
              <ImportNowCard connector={connector} />
              {connector.status === "via-csv" && <DirectCard connector={connector} />}
            </>
          )}
        </div>
        <MetricsCard connector={connector} />
      </div>
    </>
  );
}
