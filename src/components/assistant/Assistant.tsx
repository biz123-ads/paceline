"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Project } from "@/domain";
import type { AssistantEvent } from "@/assistant/events";
import type { RunPlanInput } from "@/assistant/run-plan";
import { CREDIT_COST } from "@/config/credits";
import { useAuth } from "@/lib/auth";
import { setCreditBalance, useCredits } from "@/lib/credits";
import { formatMoney } from "@/lib/format";
import { useServices } from "@/lib/services";
import { Dialog } from "@/components/overlay";
import { Button, ButtonLink, cx } from "@/components/ui";
import { SendIcon, SparkIcon } from "@/components/icons";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  tools?: RunPlanInput[];
  sources?: { url: string; title: string }[];
  status?: "streaming" | "done" | "refused" | "error";
  error?: string;
}

/** Conversations survive closing the panel, per project, until a reload. */
const conversations = new Map<string, ChatMessage[]>();

function suggestions(project: Project) {
  const price = formatMoney(2500, project.currency);
  return [
    { text: "What do you make of my numbers so far?", web: false },
    { text: "What is holding my growth back?", web: false },
    { text: `What if I raise my price to ${price} a month?`, web: false },
    { text: "Who are my direct competitors, and what do they charge?", web: true },
  ];
}

/** "Price €25 · churn 3%": what the model tried with the plan engine. */
function describeRun(input: RunPlanInput, currency: string): string {
  const parts = [
    input.price_per_customer !== null && `price ${formatMoney(Math.round(input.price_per_customer * 100), currency)}`,
    input.churn_percent !== null && `${input.churn_percent}% leaving a month`,
    input.new_customers_per_month !== null && `${input.new_customers_per_month} new customers a month`,
    input.monthly_costs !== null && `costs ${formatMoney(Math.round(input.monthly_costs * 100), currency)}`,
    input.target_monthly_revenue !== null &&
      `goal ${formatMoney(Math.round(input.target_monthly_revenue * 100), currency)}`,
    input.deadline !== null && `by ${input.deadline}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "your current numbers";
}

/** Bold (**x**) inside a line, as React nodes: no HTML is ever injected. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-medium text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/** The few shapes the assistant is asked to use: paragraphs and "- " lists. */
function Formatted({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-•]\s/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

function Message({ message, currency }: { message: ChatMessage; currency: string }) {
  if (message.role === "user") {
    return (
      <div className="ml-8 self-end rounded-xl bg-surface-3 px-4 py-2.5 text-sm whitespace-pre-line">
        {message.text}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      {message.tools?.map((t, i) => (
        <p key={i} className="text-xs text-faint">
          Ran the plan with {describeRun(t, currency)}
        </p>
      ))}
      {message.text ? (
        <div className="text-foreground/90">
          <Formatted text={message.text} />
        </div>
      ) : (
        message.status === "streaming" && <p className="animate-pulse text-faint">Thinking…</p>
      )}
      {message.status === "refused" && (
        <p className="text-foreground">The assistant can&apos;t help with that one. Your credits were returned.</p>
      )}
      {message.status === "error" && <p className="text-danger">{message.error}</p>}
      {message.sources && message.sources.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-faint">Sources</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {message.sources.map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chat({ project }: { project: Project }) {
  const credits = useCredits();
  const [messages, setMessages] = useState<ChatMessage[]>(() => conversations.get(project.id) ?? []);
  const [draft, setDraft] = useState("");
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    conversations.set(project.id, messages);
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, project.id]);
  useEffect(() => () => abort.current?.abort(), []);

  const cost = web ? CREDIT_COST.webSearch : CREDIT_COST.question;
  const tooFew = credits !== null && credits < cost;

  function update(fn: (last: ChatMessage) => ChatMessage) {
    setMessages((all) => [...all.slice(0, -1), fn(all.at(-1)!)]);
  }

  async function ask(text: string, withWeb: boolean) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setNotice(null);
    setDraft("");
    // Earlier answers that failed carry no text worth sending back.
    const history = [...messages, { role: "user" as const, text: question }]
      .filter((m) => m.text.trim())
      .slice(-20)
      .map(({ role, text }) => ({ role, text }));
    setMessages((all) => [
      ...all,
      { role: "user", text: question },
      { role: "assistant", text: "", status: "streaming" },
    ]);
    abort.current = new AbortController();

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, webSearch: withWeb, messages: history }),
        signal: abort.current.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        update((m) => ({ ...m, status: "error", error: body.error ?? "Something went wrong." }));
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AssistantEvent;
          if (event.type === "text") update((m) => ({ ...m, text: m.text + event.text }));
          else if (event.type === "tool") update((m) => ({ ...m, tools: [...(m.tools ?? []), event.input] }));
          else if (event.type === "sources") update((m) => ({ ...m, sources: event.sources }));
          else if (event.type === "refused") update((m) => ({ ...m, text: "", status: "refused" }));
          else if (event.type === "error") update((m) => ({ ...m, status: "error", error: event.message }));
          else if (event.type === "done") {
            setCreditBalance(event.balance);
            update((m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
          }
        }
      }
    } catch {
      if (!abort.current?.signal.aborted) {
        update((m) => ({ ...m, status: "error", error: "Connection lost. If no answer arrived, your credits were returned." }));
      }
    } finally {
      setBusy(false);
      update((m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (tooFew) {
      setNotice("Not enough credits for this question.");
      return;
    }
    void ask(draft, web);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">
        {messages.length === 0 ? (
          <div className="space-y-4 pb-4">
            <p className="text-sm text-muted">
              Ask about {project.name}: what the numbers say, what to try, what if you changed
              something. The answers use the same plan as this page.
            </p>
            <div className="flex flex-col items-start gap-2">
              {suggestions(project).map((s) => (
                <button
                  key={s.text}
                  type="button"
                  disabled={busy || (credits !== null && credits < (s.web ? CREDIT_COST.webSearch : CREDIT_COST.question))}
                  onClick={() => {
                    setWeb(s.web);
                    void ask(s.text, s.web);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
                >
                  {s.text}
                  {s.web && <span className="ml-1.5 text-xs text-faint">· searches the web</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 pb-4">
            {messages.map((m, i) => (
              <Message key={i} message={m} currency={project.currency} />
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="border-t border-border pt-3">
        <label className="sr-only" htmlFor="assistant-question">
          Your question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="assistant-question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Ask anything about this project…"
            className="min-h-11 flex-1 resize-none rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-foreground/40"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !draft.trim()}
            aria-label={`Send (${cost} ${cost === 1 ? "credit" : "credits"})`}
            className="h-11 w-11 shrink-0 px-0"
          >
            <SendIcon />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={web}
              onChange={(e) => setWeb(e.target.checked)}
              className="accent-foreground"
            />
            Search the web
          </label>
          <span className="num">
            {cost} {cost === 1 ? "credit" : "credits"} · {credits ?? "—"} left
          </span>
        </div>
        {(notice || tooFew) && (
          <p className="mt-2 text-xs text-foreground">
            {notice ?? "Not enough credits for this question."}{" "}
            <Link href="/settings" className="underline">
              Get more
            </Link>
          </p>
        )}
        <p className="mt-2 text-[11px] text-faint">
          To answer, this project&apos;s numbers are sent to Anthropic&apos;s Claude. Answers can be
          wrong: check what matters.
        </p>
      </form>
    </div>
  );
}

/** "Ask AI" in the project header, when the server has the assistant on. */
export function AssistantButton({ project }: { project: Project | undefined }) {
  const services = useServices();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  if (!services.assistant || !project) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <SparkIcon className="text-accent" /> Ask AI
      </Button>
      <Dialog
        side
        open={open}
        onClose={() => setOpen(false)}
        title="Ask about this project"
        description={auth.status === "signed-in" ? undefined : "The assistant needs an account."}
      >
        {auth.status === "signed-in" ? (
          <Chat project={project} />
        ) : (
          <div className={cx("space-y-4 text-sm text-muted")}>
            <p>
              Sign in to ask questions about your numbers. New accounts get free credits to try it.
              Your projects move to your account with you.
            </p>
            <ButtonLink href="/login" variant="primary">
              Sign in
            </ButtonLink>
          </div>
        )}
      </Dialog>
    </>
  );
}
