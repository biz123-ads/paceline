import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantEvent } from "@/assistant/events";
import { sampleProjectBundle } from "@/lib/sample-project";

/**
 * The route with the model, Supabase and storage replaced by fakes: checks
 * the tool loop, the credit reservation and the refunds, without a network.
 */

const USER = "11111111-1111-4111-8111-111111111111";
const bundle = sampleProjectBundle(new Date("2026-10-11T10:00:00Z"));
const project = bundle.projects[0];

/** Each call to messages.stream() takes the next scripted reply. */
const replies: (Record<string, unknown> | Error)[] = [];
const requests: Record<string, unknown>[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    beta = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          requests.push(structuredClone(params));
          const reply = replies.shift()!;
          let onText: (t: string) => void = () => {};
          return {
            on: (_event: "text", cb: (t: string) => void) => (onText = cb),
            finalMessage: async () => {
              if (reply instanceof Error) throw reply;
              for (const block of reply.content as { type: string; text?: string }[]) {
                if (block.type === "text") onText(block.text!);
              }
              return reply;
            },
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  void args;
  return name === "reserve_credits" && reserveFails
    ? { error: { message: "insufficient_credits" } }
    : { error: null };
});
const inserted: Record<string, unknown>[] = [];
let reserveFails = false;

vi.mock("@/lib/supabase/server", () => ({
  currentUser: async () => ({ id: USER, email: "a@example.com" }),
  supabaseForRequest: async () => ({}),
  supabaseAdmin: () => ({
    rpc,
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [{ delta: 10 }, { delta: -1 }] }) }),
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

vi.mock("@/server/status", () => ({
  serviceStatus: () => ({ accounts: true, assistant: true, creditSales: false }),
}));

vi.mock("@/storage/cloud", () => ({
  createCloudStorage: () => ({
    projects: { get: async (id: string) => (id === project.id ? project : undefined) },
    snapshots: { listByProject: async () => bundle.snapshots },
    goals: { getByProject: async () => bundle.goals[0] },
    assumptions: { get: async () => undefined },
  }),
}));

const { POST } = await import("./route");

function message(content: unknown[], stop_reason: string) {
  return {
    content,
    stop_reason,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 80, cache_creation_input_tokens: 0 },
  };
}

async function ask(body: object) {
  const response = await POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        webSearch: false,
        messages: [{ role: "user", text: "What if I charge 25?" }],
        ...body,
      }),
    }),
  );
  const text = response.status === 200 ? await response.text() : "";
  const events = text.trim() ? text.trim().split("\n").map((l) => JSON.parse(l) as AssistantEvent) : [];
  return { response, events };
}

const WHAT_IF = {
  price_per_customer: 25,
  churn_percent: null,
  new_customers_per_month: null,
  monthly_costs: null,
  target_monthly_revenue: null,
  deadline: null,
};

beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
  inserted.length = 0;
  rpc.mockClear();
  reserveFails = false;
});

describe("POST /api/assistant", () => {
  it("runs the plan for a what-if, then streams the answer", async () => {
    replies.push(
      message([{ type: "tool_use", id: "tu_1", name: "run_plan", input: WHAT_IF }], "tool_use"),
      message([{ type: "text", text: "At €25 you need **400** customers." }], "end_turn"),
    );
    const { events } = await ask({});

    expect(events.map((e) => e.type)).toEqual(["tool", "text", "done"]);
    expect(events.at(-1)).toEqual({ type: "done", balance: 9, charged: 1 });
    expect(rpc).toHaveBeenCalledWith("reserve_credits", expect.objectContaining({ p_user_id: USER, p_amount: 1 }));
    expect(rpc).not.toHaveBeenCalledWith("refund_credits", expect.anything());

    // The second request carries the engine's result back to the model.
    const toolResult = (requests[1].messages as { content: { type: string; content?: string }[] }[]).at(-1)!
      .content[0];
    expect(toolResult.type).toBe("tool_result");
    expect(JSON.parse(toolResult.content!).goal.paying_customers_needed).toBe(400);
    expect(inserted[0]).toMatchObject({ outcome: "answered", credits: 1, model_turns: 2, input_tokens: 200 });
  });

  it("gives the credits back when the model fails", async () => {
    replies.push(new Error("overloaded"));
    const { events } = await ask({});
    expect(events.map((e) => e.type)).toEqual(["error", "done"]);
    expect(rpc).toHaveBeenCalledWith("refund_credits", expect.anything());
    expect(inserted[0]).toMatchObject({ outcome: "failed", credits: 0 });
  });

  it("gives the credits back on a refusal", async () => {
    replies.push(message([], "refusal"));
    const { events } = await ask({});
    expect(events.map((e) => e.type)).toEqual(["refused", "done"]);
    expect(rpc).toHaveBeenCalledWith("refund_credits", expect.anything());
  });

  it("asks for a final answer, without tools, on the last turn", async () => {
    for (let i = 0; i < 4; i++) {
      replies.push(message([{ type: "tool_use", id: `tu_${i}`, name: "run_plan", input: WHAT_IF }], "tool_use"));
    }
    replies.push(message([{ type: "text", text: "Done." }], "end_turn"));
    await ask({});
    expect(requests).toHaveLength(5);
    expect(requests[3].tool_choice).toEqual({ type: "auto" });
    expect(requests[4].tool_choice).toEqual({ type: "none" });
  });

  it("charges web search questions more and offers the search tool", async () => {
    replies.push(message([{ type: "text", text: "Here are some." }], "end_turn"));
    await ask({ webSearch: true });
    expect(rpc).toHaveBeenCalledWith("reserve_credits", expect.objectContaining({ p_amount: 3 }));
    expect((requests[0].tools as { name: string }[]).map((t) => t.name)).toEqual(["run_plan", "web_search"]);
  });

  it("refuses without enough credits, before calling the model", async () => {
    reserveFails = true;
    const { response } = await ask({});
    expect(response.status).toBe(402);
    expect(requests).toHaveLength(0);
  });

  it("rejects a conversation that does not end with a question", async () => {
    const { response } = await ask({ messages: [{ role: "assistant", text: "Hi" }] });
    expect(response.status).toBe(400);
  });
});
