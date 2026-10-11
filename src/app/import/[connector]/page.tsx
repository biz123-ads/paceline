import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONNECTORS, findConnector } from "@/import/connectors";
import { ConnectorScreen } from "@/components/screens/ConnectorScreen";

/** The catalog is fixed, so every connector page is built ahead of time. */
export function generateStaticParams() {
  return CONNECTORS.map((c) => ({ connector: c.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/import/[connector]">): Promise<Metadata> {
  const connector = findConnector((await params).connector);
  return { title: connector ? `Import from ${connector.name}` : "Import" };
}

export default async function ConnectorPage({ params }: PageProps<"/import/[connector]">) {
  const connector = findConnector((await params).connector);
  if (!connector) notFound();
  return <ConnectorScreen connector={connector} />;
}
