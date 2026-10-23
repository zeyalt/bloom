"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUp, RotateCcw } from "lucide-react";
import { ChatMarkdown } from "@/components/journal/ChatMarkdown";
import type { ChartSpec } from "@/lib/chat-chart";

// Charts pull in recharts; load it only once an answer actually has a chart.
const ChatChart = dynamic(() => import("@/components/journal/ChatChart"), {
  ssr: false,
  loading: () => <div className="h-28 w-full rounded-[var(--radius-md)] bg-[var(--bg-secondary)] animate-pulse" />,
});

type Message = { role: "user" | "assistant"; content: string; charts?: ChartSpec[] };

const SUGGESTIONS = [
  "How much have we spent on each child this year?",
  "Which activity did Zara miss the most this year?",
  "What does Zayyan's week look like right now?",
  "Who usually picks Zayyan up from soccer?",
];

/**
 * Ask-anything chat over the family's records. The conversation lives in memory
 * only — it survives switching Journal tabs but not a page reload.
 */
export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading, error]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.answer) throw new Error(data.error || "Something went wrong.");
      setMessages([...next, { role: "assistant", content: data.answer, charts: Array.isArray(data.charts) ? data.charts : [] }]);
    } catch (e) {
      // Drop the unanswered question back into the box so it can be resent as-is.
      setMessages(messages);
      setInput(question);
      setError((e as Error).message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
    setError("");
  }

  return (
    <div className="flex flex-col">
      {messages.length > 0 && (
        <div className="flex justify-end mb-3">
          <button onClick={reset} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--ink)] cursor-pointer disabled:opacity-50">
            <RotateCcw size={13} /> New chat
          </button>
        </div>
      )}

      {/* Messages stack up from the input box, newest at the bottom, like a messaging app. */}
      <div className="flex flex-col justify-end gap-3 min-h-[55dvh] pb-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Ask anything about attendance, schedules, spending or reflections. Answers come from your own records.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  className="text-left text-sm px-3 py-2 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--sheet)] text-[var(--text-primary)] hover:border-[var(--stem)] cursor-pointer disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--ink)] text-[var(--sheet)]">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="max-w-[95%] px-3.5 py-2.5 text-sm leading-relaxed rounded-[var(--radius-md)] bg-[var(--sheet)] border border-[var(--rule)] text-[var(--text-primary)]">
                <ChatMarkdown text={m.content} />
              </div>
              {m.charts?.map((c, j) => <ChatChart key={j} spec={c} />)}
            </div>
          ),
        )}

        {loading && (
          <div className="flex justify-start" aria-live="polite">
            <div className="px-3.5 py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--sheet)] border border-[var(--rule)] text-[var(--text-muted)]">
              Looking through your records…
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--margin)]">
            {error} Your question is back in the box — press send to try again.
          </p>
        )}
      </div>

      {/* Pinned to the bottom of the screen: just above the bottom nav on phones, the
          window's edge on desktop. The page-coloured backing hides messages scrolling under it. */}
      <div className="sticky z-10 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 -mx-5 md:-mx-8 px-5 md:px-8 pt-2 pb-3 bg-[var(--bg-primary)]">
        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-md)] p-2 focus-within:border-[var(--stem)]"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            rows={1}
            placeholder="Ask about your children's activities…"
            aria-label="Your question"
            className="flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none max-h-32 [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-md)] bg-[var(--ink)] text-[var(--sheet)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </div>
      <div ref={endRef} />
    </div>
  );
}
