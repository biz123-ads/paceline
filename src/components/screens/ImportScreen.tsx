import Link from "next/link";
import {
  CONNECTOR_CATEGORIES,
  CONNECTORS,
  connectorsIn,
  type Connector,
} from "@/import/connectors";
import { ConnectorLogo } from "@/components/import/ConnectorLogo";
import { StatusBadge } from "@/components/import/labels";
import { PageTitle } from "@/components/ui";

function ConnectorCard({ connector }: { connector: Connector }) {
  return (
    <Link
      href={`/import/${connector.id}`}
      className="flex items-start gap-3.5 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <ConnectorLogo id={connector.id} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{connector.name}</span>
          <StatusBadge status={connector.status} />
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          {connector.summary}
        </span>
      </span>
    </Link>
  );
}

export function ImportScreen() {
  const workingToday = CONNECTORS.filter((c) => c.status !== "planned").length;

  return (
    <>
      <PageTitle
        title="Import"
        subtitle={
          <>
            Bring your monthly numbers in from the tools you already use.{" "}
            <span className="num">{workingToday}</span> of{" "}
            <span className="num">{CONNECTORS.length}</span> sources work today; direct,
            read-only connections are on the way.
          </>
        }
      />
      <div className="space-y-8">
        {CONNECTOR_CATEGORIES.map((category) => (
          <section key={category.id} aria-labelledby={`category-${category.id}`}>
            <div className="mb-3">
              <h2 id={`category-${category.id}`} className="text-[15px] font-medium">
                {category.label}
              </h2>
              <p className="mt-0.5 text-xs text-muted">{category.hint}</p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {connectorsIn(category.id).map((connector) => (
                <li key={connector.id} className="flex flex-col [&>a]:flex-1">
                  <ConnectorCard connector={connector} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
