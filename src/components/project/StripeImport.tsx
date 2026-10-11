"use client";

import { useState, type FormEvent } from "react";
import { metricSnapshotSchema, type MetricSnapshot, type Project } from "@/domain";
import type { StripeImportResult } from "@/import/stripe-mrr";
import { Button, Card, CardHeader, Field, ScrollX, TextInput } from "@/components/ui";
import { formatMoney, formatNumber, formatPeriod } from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { addMonths, currentPeriod } from "@/lib/period";
import { getStorage } from "@/storage";

const PREVIEW_ROWS = 12;

type Fetched = StripeImportResult & { livemode: boolean };

/**
 * Paste a restricted key, see the months it gives, import them. The key goes
 * to our server for this one request and is not saved anywhere.
 */
export function StripeImport({
  project,
  snapshots,
  onClose,
}: {
  project: Project;
  snapshots: MetricSnapshot[];
  onClose: () => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const existing = new Map(snapshots.map((s) => [s.period, s]));

  async function read(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/stripe/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          currency: project.currency,
          to: addMonths(currentPeriod(), -1),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Something went wrong.");
        return;
      }
      setFetched(body as Fetched);
      // Not needed any more: drop it from the page.
      setKey("");
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!fetched) return;
    setBusy(true);
    const storage = getStorage();
    const now = nowIso();
    for (const month of fetched.months) {
      const before = existing.get(month.period);
      // Stripe's numbers win; costs typed by hand are kept.
      await storage.snapshots.upsert(
        metricSnapshotSchema.parse({
          ...before,
          mrr: month.mrr,
          payingCustomers: month.payingCustomers,
          newCustomers: month.newCustomers,
          churnedCustomers: month.churnedCustomers,
          id: before?.id ?? newId(),
          projectId: project.id,
          period: month.period,
          source: "stripe",
          createdAt: before?.createdAt ?? now,
          updatedAt: now,
        }),
      );
    }
    setBusy(false);
    setResult(`Imported ${fetched.months.length} ${fetched.months.length === 1 ? "month" : "months"} from Stripe.`);
    setFetched(null);
  }

  const replacing = fetched?.months.filter((m) => existing.has(m.period)).length ?? 0;

  return (
    <Card>
      <CardHeader
        title="Import from Stripe"
        hint="Revenue, paying customers, and who joined or left, rebuilt month by month from your subscriptions."
        action={
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />

      {!fetched && (
        <form onSubmit={read} noValidate className="space-y-4">
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
            <li>
              In Stripe, open{" "}
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline"
              >
                Developers → API keys
              </a>{" "}
              and create a <span className="text-foreground">restricted key</span>.
            </li>
            <li>
              Give it <span className="text-foreground">Read</span> access to{" "}
              <span className="text-foreground">Subscriptions</span>, nothing else.
            </li>
            <li>Paste it here. We use it once and never store it.</li>
          </ol>
          <Field label="Restricted key" error={error}>
            <TextInput
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
              }}
              placeholder="rk_live_…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={busy || !key.trim()}>
              {busy ? "Reading subscriptions…" : "Read my subscriptions"}
            </Button>
            {result && <p className="text-sm text-foreground">{result}</p>}
          </div>
          <p className="text-xs text-faint">
            Only amounts in {project.currency} are counted, at today&apos;s prices and before
            discounts. Test keys (rk_test_…) work too.
          </p>
        </form>
      )}

      {fetched && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Read {formatNumber(fetched.read)} subscriptions
            {fetched.livemode ? "" : " (test mode)"}.
            {fetched.otherCurrency > 0 &&
              ` ${fetched.otherCurrency} in other currencies were left out.`}
            {fetched.unsupportedPrices > 0 &&
              ` ${fetched.unsupportedPrices} with usage-based prices count as customers but add no revenue.`}
          </p>
          {fetched.months.length === 0 ? (
            <p className="text-sm text-foreground">
              No paying subscriptions in {project.currency} yet, so there is nothing to import.
            </p>
          ) : (
            <ScrollX label="Stripe preview">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="pb-2 font-normal">Month</th>
                    <th className="pb-2 text-right font-normal">Revenue</th>
                    <th className="pb-2 text-right font-normal">Customers</th>
                    <th className="pb-2 text-right font-normal">New</th>
                    <th className="pb-2 text-right font-normal">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {[...fetched.months].reverse().slice(0, PREVIEW_ROWS).map((m) => (
                    <tr key={m.period} className="border-t border-border">
                      <td className="py-2">
                        {formatPeriod(m.period)}
                        {existing.has(m.period) && (
                          <span className="ml-2 text-[11px] text-faint">replaces</span>
                        )}
                      </td>
                      <td className="num py-2 text-right">{formatMoney(m.mrr, project.currency)}</td>
                      <td className="num py-2 text-right">{formatNumber(m.payingCustomers)}</td>
                      <td className="num py-2 text-right">{formatNumber(m.newCustomers)}</td>
                      <td className="num py-2 text-right">{formatNumber(m.churnedCustomers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fetched.months.length > PREVIEW_ROWS && (
                <p className="mt-2 text-xs text-faint">
                  …and {fetched.months.length - PREVIEW_ROWS} earlier months.
                </p>
              )}
            </ScrollX>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {fetched.months.length > 0 && (
              <Button variant="primary" onClick={runImport} disabled={busy}>
                {busy
                  ? "Importing…"
                  : `Import ${fetched.months.length} ${fetched.months.length === 1 ? "month" : "months"}`}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setFetched(null)}>
              Use another key
            </Button>
            {replacing > 0 && (
              <span className="text-xs text-muted">
                {replacing} will replace months you already have (costs are kept).
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
