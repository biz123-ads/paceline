"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CREDIT_COST, CREDIT_PACKS, type CreditPackId } from "@/config/credits";
import { refreshCredits, useCredits } from "@/lib/credits";
import { useServices } from "@/lib/services";
import { formatMoney } from "@/lib/format";
import { Button, Card, CardHeader } from "@/components/ui";

function CheckoutResult() {
  const params = useSearchParams();
  const result = params.get("credits");
  useEffect(() => {
    if (result !== "success") return;
    // The webhook may land a moment after the redirect.
    const timers = [1_000, 4_000, 10_000].map((ms) => setTimeout(() => void refreshCredits(), ms));
    return () => timers.forEach(clearTimeout);
  }, [result]);
  if (result === "success") {
    return <p className="mt-4 text-sm text-foreground">Payment received. Your credits will appear in a moment.</p>;
  }
  if (result === "cancelled") return <p className="mt-4 text-sm text-muted">Checkout cancelled; nothing was charged.</p>;
  return null;
}

/** Balance of assistant credits, and packs to buy when sales are on. */
export function CreditsCard() {
  const services = useServices();
  const credits = useCredits();
  const [busy, setBusy] = useState<CreditPackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!services.assistant) return null;

  async function buy(pack: CreditPackId) {
    setBusy(pack);
    setError(null);
    const response = await fetch("/api/credits/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pack }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (response?.ok && body.url) {
      window.location.assign(body.url);
      return;
    }
    setBusy(null);
    setError(body.error ?? "Could not open the checkout. Try again.");
  }

  return (
    <Card>
      <CardHeader
        title="Assistant credits"
        hint={`A question costs ${CREDIT_COST.question} credit, or ${CREDIT_COST.webSearch} when it searches the web.`}
      />
      <p className="num text-3xl tracking-tight">
        {credits ?? "—"} <span className="text-base text-muted">credits</span>
      </p>
      {services.creditSales && (
        <div className="mt-5 flex flex-wrap gap-3">
          {CREDIT_PACKS.map((pack) => (
            <Button key={pack.id} onClick={() => buy(pack.id)} disabled={busy !== null}>
              {busy === pack.id
                ? "Opening checkout…"
                : `${pack.credits} credits · ${formatMoney(pack.price, pack.currency.toUpperCase())}`}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <Suspense>
        <CheckoutResult />
      </Suspense>
    </Card>
  );
}
