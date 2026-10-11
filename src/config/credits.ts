/**
 * Assistant credits. One question costs a fixed number of credits, shown
 * before sending; each request has hard limits (output tokens, model turns,
 * searches), so every question has a known maximum cost.
 */
export const CREDIT_COST = {
  question: 1,
  /** A question that may search the web, with sources. */
  webSearch: 3,
} as const;

/** Free credits a new account starts with (granted in the database). */
export const SIGNUP_BONUS = 10;

/** Packs sold through Stripe Checkout. Prices in cents. */
export const CREDIT_PACKS = [
  { id: "starter", credits: 50, price: 500, currency: "eur" },
  { id: "builder", credits: 150, price: 1200, currency: "eur" },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
