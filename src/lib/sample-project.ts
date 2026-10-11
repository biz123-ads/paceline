import type { ExportBundle } from "@/domain";
import { newId } from "./id";
import { addMonths, currentPeriod, type Period } from "./period";

/**
 * A realistic demo project so a first-time visitor can see every screen with
 * data before typing their own. It goes through importAll like a backup.
 */
export function sampleProjectBundle(now: Date = new Date()): ExportBundle {
  const at = now.toISOString();
  const projectId = newId();
  const lastMonth: Period = addMonths(currentPeriod(now), -1);

  // Paying customers per month, oldest first, and the ones lost each month.
  const customers = [22, 27, 31, 38, 41, 47, 52, 56, 60];
  const churned = [0, 1, 2, 1, 3, 2, 2, 3, 3];
  const costs = [62_000, 64_000, 64_000, 90_000, 91_000, 93_000, 140_000, 145_000, 150_000];
  const first = addMonths(lastMonth, -(customers.length - 1));

  const snapshots: ExportBundle["snapshots"] = customers.map((count, i) => ({
    id: newId(),
    projectId,
    period: addMonths(first, i),
    // 19 € a month, plus a few annual plans that average a little higher.
    mrr: count * 1900 + Math.round(count * 0.25) * 400,
    payingCustomers: count,
    newCustomers: i === 0 ? undefined : count - customers[i - 1] + churned[i],
    churnedCustomers: i === 0 ? undefined : churned[i],
    costs: costs[i],
    source: "manual",
    createdAt: at,
    updatedAt: at,
  }));
  const baseline = snapshots[snapshots.length - 4];

  return {
    version: 1,
    exportedAt: at,
    projects: [
      {
        id: projectId,
        userId: null,
        name: "Invoicely (sample)",
        description:
          "Invoicing for freelancers: send an invoice in 30 seconds, get paid by card. Sample data to explore the app; delete it any time.",
        kind: "saas",
        stage: "growing",
        websiteUrl: "https://example.com",
        currency: "EUR",
        pricingSummary: "19 €/month, 190 €/year",
        targetAudience: "Freelancers and small studios in Europe",
        techStack: ["Next.js", "Postgres", "Stripe"],
        cashBalance: 800_000,
        notes: "",
        createdAt: at,
        updatedAt: at,
      },
    ],
    snapshots,
    goals: [
      {
        id: newId(),
        projectId,
        label: "10k MRR",
        targetMrr: 1_000_000,
        deadline: addMonths(lastMonth, 18),
        baselinePeriod: baseline.period,
        baselineMrr: baseline.mrr,
        createdAt: at,
        updatedAt: at,
      },
    ],
    assumptions: [],
  };
}
