import { APP_NAME } from "@/config/app";
import { buildPlan } from "@/plan/engine";
import { formatMoney } from "@/lib/format";
import { summarizePlan, type ProjectSnapshot } from "./run-plan";

/**
 * Instructions: fixed, so the prompt cache can reuse them across every
 * question and user. Project data goes in a second block after them.
 */
export const ASSISTANT_INSTRUCTIONS = `You are the assistant inside ${APP_NAME}, an app where founders of small SaaS products and apps track their monthly numbers and plan the way to a revenue goal. You talk with the founder about one of their projects, whose data follows.

How to answer:
- Answer in the language the founder writes in. Be direct and brief: a few short paragraphs or a short list. Use plain words; when a finance term helps (MRR, churn, ARPU, runway), explain it in passing.
- Ground everything in the project's data. Say when there are too few months for a firm conclusion.
- For any "what if" (a different price, churn, pace of new customers, costs, goal or date), call the run_plan tool and quote its results. Never work out plan numbers yourself; the tool uses the same engine as the app, so its numbers match what the founder sees.
- Values marked "default" or "estimated" are guesses, not measurements. Say so when they drive a conclusion.
- Competitors and market facts: only name them from web search results, with the sources. If web search is not available in this conversation, say that you can look them up when the founder turns on web search, and do not name competitors from memory as facts.
- You are not a financial, tax or legal advisor. Suggest ideas and trade-offs; leave decisions to the founder.
- Formatting: plain text, "- " for list items, **bold** for the one or two numbers that matter. No tables, no headings.`;

const optional = (label: string, value: string | undefined | null) => (value ? `${label}: ${value}\n` : "");

/** The project as text: details, every month, the goal, and today's plan. */
export function projectContext(data: ProjectSnapshot): string {
  const { project, snapshots, goal } = data;
  const money = (cents: number | undefined) =>
    cents === undefined ? "-" : formatMoney(cents, project.currency);
  const plan = buildPlan({
    history: snapshots,
    goal,
    assumptions: data.assumptions,
    cashBalance: project.cashBalance,
  });

  const rows = snapshots.map(
    (s) =>
      `${s.period} | ${money(s.mrr)} | ${s.payingCustomers} | ${s.newCustomers ?? "-"} | ${s.churnedCustomers ?? "-"} | ${money(s.costs)} | ${s.source}`,
  );

  return `# Project
Name: ${project.name}
Kind: ${project.kind}; stage: ${project.stage}; currency: ${project.currency}
${optional("Description", project.description)}${optional("Pricing", project.pricingSummary)}${optional("Customers are", project.targetAudience)}${optional("Website", project.websiteUrl)}${optional("Launched", project.launchDate)}
# Months entered (oldest first)
month | monthly revenue (MRR) | paying customers | new customers | customers who left | costs | source
${rows.length ? rows.join("\n") : "(none yet)"}

# The plan today, from the app's engine (JSON)
${JSON.stringify(summarizePlan(data, plan), null, 1)}
`;
}
