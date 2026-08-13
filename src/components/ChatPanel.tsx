"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildQueryString,
  parseSearchParams,
} from "@/lib/store/filters";
import {
  INTENT_GROUPS,
  CURATED_QUESTIONS,
  type IntentKey,
  type AnswerTable,
} from "@/lib/ai/curated";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "llm" | "offline";
  intent?: IntentKey;
  table?: AnswerTable;
  error?: boolean;
}

interface ChatPanelProps {
  initialQuestion?: string;
  llmEnabled?: boolean;
}

type AnswerMode = "llm" | "engine";

function currentParams(): Record<string, string | string[]> {
  if (typeof window === "undefined") return {};
  const usp = new URLSearchParams(window.location.search);
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of usp.entries()) out[k] = v;
  return out;
}

export default function ChatPanel({
  initialQuestion,
  llmEnabled = false,
}: ChatPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>(llmEnabled ? "llm" : "engine");
  const [expanded, setExpanded] = useState<string | null>("Performance vs target");
  const bottomRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  const pushToUrl = (question: string) => {
    const current = parseSearchParams(currentParams());
    const params: Record<string, string | string[]> = {
      q: question.slice(0, 400),
    };
    for (const k of ["role", "branch", "rep", "source", "model", "from", "to", "asof"]) {
      const v = (current as unknown as Record<string, string>)[k];
      if (v) params[k] = v;
    }
    router.replace(`${pathname}${buildQueryString(params)}`, { scroll: false });
  };

  const ask = async (text: string, explicitIntent?: IntentKey) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!explicitIntent) pushToUrl(trimmed);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          intent: explicitIntent,
          mode: answerMode,
          filters: currentParams(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: data.error ?? "Something went wrong.", error: true },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: data.text,
            mode: data.mode,
            intent: data.intent,
            table: data.table,
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: "Network error — please try again.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (askedInitial.current) return;
    if (!initialQuestion) return;
    askedInitial.current = true;
    const timer = setTimeout(() => {
      void ask(initialQuestion);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const grouped = INTENT_GROUPS.map((g) => ({
    ...g,
    questions: CURATED_QUESTIONS.filter((q) => q.theme === g.theme),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold">Curated questions</h2>
        <p className="mb-3 text-xs text-zinc-500">
          One click asks the question with your current filters and as-of date.
        </p>
        <div className="space-y-2">
          {grouped.map((group) => (
            <div key={group.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setExpanded((e) => (e === group.theme ? null : group.theme))}
                aria-expanded={expanded === group.theme}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
              >
                {group.theme}
                <span className="ml-2 text-zinc-400">{expanded === group.theme ? "−" : "+"}</span>
              </button>
              {expanded === group.theme && (
                <div className="space-y-1 px-2 pb-2">
                  {group.questions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => ask(q.prompt)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-indigo-950"
                    >
                      {q.prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Assistant</h2>
          <ModeToggle
            value={answerMode}
            llmEnabled={llmEnabled}
            onChange={setAnswerMode}
          />
        </div>
        <div className="flex h-[520px] flex-col rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-900">
                Ask about branch pacing, top reps, funnel drop-off, lost leads,
                delivery delays, or the forecast. Pick a curated question or type
                your own.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : m.error
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-zinc-100 dark:bg-zinc-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.mode && (
                    <p className="mt-1 text-[10px] uppercase tracking-wide opacity-60">
                      {m.mode === "llm" ? "LLM-grounded" : "deterministic engine"}
                      {m.intent ? ` · ${m.intent.replaceAll("_", " ")}` : ""}
                    </p>
                  )}
                  {m.table && <AnswerTableChip table={m.table} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder="Ask a free-form question…"
              aria-label="Ask a question"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => void ask(input)}
              disabled={busy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  value,
  llmEnabled,
  onChange,
}: {
  value: AnswerMode;
  llmEnabled: boolean;
  onChange: (m: AnswerMode) => void;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"
      role="group"
      aria-label="Answer mode"
      title={
        llmEnabled
          ? "AI: LLM with grounded metrics · Engine: deterministic rule engine"
          : "LLM unavailable — set OPENAI_API_KEY to enable AI mode"
      }
    >
      <button
        type="button"
        onClick={() => onChange("engine")}
        aria-pressed={value === "engine"}
        disabled={!llmEnabled && value !== "engine" ? false : undefined}
        className={`px-2.5 py-1 text-xs font-medium ${
          value === "engine"
            ? "bg-indigo-600 text-white"
            : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Engine
      </button>
      <button
        type="button"
        onClick={() => onChange("llm")}
        aria-pressed={value === "llm"}
        disabled={!llmEnabled}
        title={!llmEnabled ? "Set OPENAI_API_KEY to enable AI mode" : undefined}
        className={`px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
          value === "llm"
            ? "bg-indigo-600 text-white"
            : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        AI
      </button>
    </div>
  );
}

function AnswerTableChip({ table }: { table: AnswerTable }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <p className="border-b border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-700">
        {table.title}
      </p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-zinc-500">
            {table.columns.map((c) => (
              <th key={c} className="px-2 py-1 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800/60">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}