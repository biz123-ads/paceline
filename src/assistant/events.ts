import type { RunPlanInput } from "./run-plan";

/** One line of the assistant's streamed answer (newline-delimited JSON). */
export type AssistantEvent =
  /** A piece of the answer's text. */
  | { type: "text"; text: string }
  /** The model ran the plan engine with these "what if" values. */
  | { type: "tool"; input: RunPlanInput }
  /** Web pages the answer cites. */
  | { type: "sources"; sources: { url: string; title: string }[] }
  /** The model declined; credits were returned. */
  | { type: "refused" }
  | { type: "error"; message: string }
  /** Finished: credits left, and what this question cost. */
  | { type: "done"; balance: number; charged: number };
