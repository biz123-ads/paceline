import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ASSISTANT_INSTRUCTIONS, projectContext } from "@/assistant/context";
import {
  RUN_PLAN_INPUT_JSON_SCHEMA,
  RUN_PLAN_TOOL_NAME,
  runPlan,
  runPlanInputSchema,
} from "@/assistant/run-plan";
import type { AssistantEvent } from "@/assistant/events";
import { CREDIT_COST } from "@/config/credits";
import { currentUser, supabaseAdmin, supabaseForRequest } from "@/lib/supabase/server";
import { serviceStatus } from "@/server/status";
import { createCloudStorage } from "@/storage/cloud";

/** A streamed answer with a few tool calls fits well inside this. */
export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
/** Hard limits per question, so each one has a known maximum cost. */
const MAX_OUTPUT_TOKENS = 8_000;
const MAX_MODEL_TURNS = 5;
const MAX_WEB_SEARCHES = 3;

const requestSchema = z.object({
  projectId: z.uuid(),
  webSearch: z.boolean(),
  /** Text of the conversation so far, oldest first; the last one is the question. */
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(4_000) }))
    .min(1)
    .max(30)
    .refine((m) => m.at(-1)!.role === "user", "The last message must be the question."),
});

const RUN_PLAN_TOOL: Anthropic.Beta.BetaTool = {
  name: RUN_PLAN_TOOL_NAME,
  description:
    "Runs the app's plan engine on this project with 'what if' values and returns the results: customers needed, new customers needed per month, when the goal is reached at this pace (or where growth stalls), runway and break-even. Pass null for anything that stays as it is. Use it for every hypothetical question instead of calculating yourself.",
  input_schema: RUN_PLAN_INPUT_JSON_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema,
  strict: true,
};

function json(status: number, body: object) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  if (!serviceStatus().assistant) return json(503, { error: "The assistant is not set up on this server." });
  const admin = supabaseAdmin()!;
  const user = await currentUser();
  if (!user) return json(401, { error: "Sign in to use the assistant." });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "That message could not be sent." });
  const { projectId, webSearch, messages: history } = parsed.data;

  // Read the project as the user (Row Level Security), not from the request
  // body: what the model sees is exactly what is stored.
  const storage = createCloudStorage((await supabaseForRequest())!);
  const project = await storage.projects.get(projectId);
  if (!project) return json(404, { error: "Project not found." });
  const [snapshots, goal, assumptions] = await Promise.all([
    storage.snapshots.listByProject(projectId),
    storage.goals.getByProject(projectId),
    storage.assumptions.get(projectId),
  ]);
  const data = { project, snapshots, goal, assumptions };

  // Credits are taken before calling the model and given back on failure.
  const cost = webSearch ? CREDIT_COST.webSearch : CREDIT_COST.question;
  const requestId = crypto.randomUUID();
  const reserved = await admin.rpc("reserve_credits", {
    p_user_id: user.id,
    p_amount: cost,
    p_reference: requestId,
  });
  if (reserved.error) {
    return reserved.error.message.includes("insufficient_credits")
      ? json(402, { error: "Not enough credits for this question." })
      : json(500, { error: "Could not check your credits. Try again." });
  }

  const tools: Anthropic.Beta.BetaToolUnion[] = [RUN_PLAN_TOOL];
  if (webSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: MAX_WEB_SEARCHES });

  const encoder = new TextEncoder();
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, turns: 0 };

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let outcome: "answered" | "refused" | "failed" = "failed";
      let sentText = false;
      const sources = new Map<string, string>();

      try {
        const client = new Anthropic();
        const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
          role: m.role,
          content: m.text,
        }));

        for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
          const stream = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: MAX_OUTPUT_TOKENS,
              betas: ["server-side-fallback-2026-07-01"],
              // On a safety decline, Anthropic re-runs the request on the
              // fallback model it recommends for that category.
              fallbacks: "default",
              output_config: { effort: "medium" },
              // The last turn must answer, not call another tool.
              tool_choice: turn === MAX_MODEL_TURNS - 1 ? { type: "none" } : { type: "auto" },
              system: [
                { type: "text", text: ASSISTANT_INSTRUCTIONS },
                // Cached together with the instructions: follow-up questions
                // and tool turns re-read them at a fraction of the price.
                { type: "text", text: projectContext(data), cache_control: { type: "ephemeral" } },
              ],
              tools,
              messages,
            },
            { signal: request.signal },
          );
          stream.on("text", (text) => {
            sentText = true;
            send({ type: "text", text });
          });
          const message = await stream.finalMessage();

          usage.turns++;
          usage.input += message.usage.input_tokens;
          usage.output += message.usage.output_tokens;
          usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
          usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
          usage.searches += message.usage.server_tool_use?.web_search_requests ?? 0;

          for (const block of message.content) {
            if (block.type !== "text") continue;
            for (const c of block.citations ?? []) {
              if (c.type === "web_search_result_location") sources.set(c.url, c.title ?? c.url);
            }
          }

          if (message.stop_reason === "refusal") {
            outcome = "refused";
            send({ type: "refused" });
            break;
          }
          // A long server-side search paused: send the turn back to resume it.
          if (message.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: message.content });
            continue;
          }
          const toolUses = message.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );
          // Done, or out of tokens: never run a tool call that was cut off.
          if (toolUses.length === 0 || message.stop_reason === "max_tokens") {
            outcome = "answered";
            break;
          }

          // Append-only: the assistant turn goes back unchanged, thinking included.
          messages.push({ role: "assistant", content: message.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
            const input = runPlanInputSchema.safeParse(use.input);
            if (use.name !== RUN_PLAN_TOOL_NAME || !input.success) {
              return { type: "tool_result", tool_use_id: use.id, is_error: true, content: "Invalid input for run_plan." };
            }
            send({ type: "tool", input: input.data });
            return { type: "tool_result", tool_use_id: use.id, content: JSON.stringify(runPlan(data, input.data)) };
          });
          messages.push({ role: "user", content: results });
        }

        if (sources.size) {
          send({ type: "sources", sources: [...sources].map(([url, title]) => ({ url, title })) });
        }
      } catch (error) {
        outcome = "failed";
        if (!request.signal.aborted) {
          console.error("assistant request failed", requestId, error);
          send({
            type: "error",
            message:
              error instanceof Anthropic.RateLimitError
                ? "The assistant is busy right now. Your credits were returned; try again in a minute."
                : "Something went wrong. Your credits were returned.",
          });
        }
      }

      // Nothing usable came back: give the credits back (not when the reader
      // left after part of the answer had already arrived).
      const leftEarly = request.signal.aborted && sentText;
      const refund = outcome !== "answered" && !leftEarly;
      if (refund) await admin.rpc("refund_credits", { p_reference: requestId });
      // reserve_credits returned the balance after taking this question's cost.
      const balance = (reserved.data as number) + (refund ? cost : 0);

      // What it really cost, to price credits from measurements.
      const log = {
        id: requestId,
        user_id: user.id,
        project_id: projectId,
        credits: outcome === "answered" || leftEarly ? cost : 0,
        model: MODEL,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_tokens: usage.cacheRead,
        cache_write_tokens: usage.cacheWrite,
        web_searches: usage.searches,
        model_turns: usage.turns,
        outcome,
      };
      console.info("assistant usage", JSON.stringify(log));
      await admin.from("assistant_requests").insert(log);

      if (!request.signal.aborted) {
        send({ type: "done", balance, charged: outcome === "answered" ? cost : 0 });
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
