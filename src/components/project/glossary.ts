/**
 * Plain-language explanations for the few finance words the app cannot
 * avoid. Screens say "monthly revenue" and "customers who leave"; these show
 * up behind the "?" next to them, with the jargon in brackets for search.
 */
export const GLOSSARY = {
  revenue:
    "What your subscriptions bring in each month (MRR, monthly recurring revenue). One-off sales don't count; yearly plans count as a twelfth a month.",
  customers: "People or companies paying you this month. Free users don't count.",
  price:
    "What a paying customer brings in a month, on average: monthly revenue ÷ paying customers (ARPU).",
  churn:
    "Share of paying customers who cancel in a month (churn). 5% means 5 out of every 100 leave.",
  newCustomers: "Paying customers you win in a month, before the ones who leave.",
  costs: "Everything the project spends in a month: tools, hosting, ads, salaries.",
  runway:
    "How many months your cash lasts if costs and revenue stay where they are (runway).",
  breakEven: "The first month your revenue covers your costs (break-even).",
  planLine:
    "The path from where you were when you set the goal to the target, growing by the same percentage every month.",
  flow: "Paying customers you won (above the line) and lost (below it) each month. When more join than leave, you grow even at the same price.",
  leverImpact:
    "Each number is improved by the same share on its own, the others staying as they are, to show which one matters most for your goal. Try it sets that number in What if, and you can go back.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
