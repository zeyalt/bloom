"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import { ChatMarkdown } from "@/components/journal/ChatMarkdown";
import { cn } from "@/lib/utils";
import type { ChartSpec } from "@/lib/chat-chart";

// Charts pull in recharts; load it only once an answer actually has a chart.
const ChatChart = dynamic(() => import("@/components/journal/ChatChart"), {
  ssr: false,
  loading: () => <div className="h-28 w-full rounded-[var(--radius-md)] bg-[var(--bg-secondary)] animate-pulse" />,
});

type Message = { role: "user" | "assistant"; content: string; charts?: ChartSpec[]; at: number };

const SUGGESTIONS = [
  "How much have we spent on each child this year?",
  "Which activity did Zara miss the most this year?",
  "What does Zayyan's week look like right now?",
  "What has school said about Zara lately?",
];

/** Bloom's side of the conversation: a small round mark beside each reply. */
function BloomAvatar() {
  return (
    <span aria-hidden="true" className="shrink-0 w-8 h-8 rounded-full bg-[var(--stem)] text-[var(--sheet)] inline-flex items-center justify-center">
      <Sparkles size={16} />
    </span>
  );
}

const time = (at: number) => format(at, "h:mm a");
/** When a message was sent (called from the send handler, never during render). */
const stamp = () => new Date().getTime();

/**
 * Ask-anything chat over the family's records, laid out like a messaging app: your
 * questions on the right, Bloom's answers on the left with charts under them. The
 * conversation lives in memory only (it survives switching Journal tabs, not a reload).
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
    const next: Message[] = [...messages, { role: "user", content: question, at: stamp() }];
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
      setMessages([...next, { role: "assistant", content: data.answer, charts: Array.isArray(data.charts) ? data.charts : [], at: stamp() }]);
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
    // A centred reading column on wide screens, like a messaging app.
    <div className="flex flex-col w-full max-w-3xl mx-auto">
      {/* Messages stack up from the message bar, newest at the bottom. */}
      <div className="flex flex-col gap-4 pb-20">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <BloomAvatar />
              <div className="max-w-[85%] px-4 py-3 rounded-[18px] rounded-bl-[6px] bg-[var(--sheet)] border border-[var(--rule)] text-sm leading-6 text-[var(--ink)]">
                Hi! Ask me anything about the kids: classes, attendance, spending, reflections or school feedback. I answer from your own records.
              </div>
            </div>
            <div className="pl-10 flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => send(s)} disabled={loading}
                  className="text-left text-sm leading-5 px-3.5 py-2 rounded-full border border-[var(--stem)]/40 bg-[var(--sheet)] text-[var(--stem)] font-medium hover:bg-[#e8f2eb] cursor-pointer disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button type="button" onClick={reset} disabled={loading}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg-secondary)] cursor-pointer disabled:opacity-50">
              <RotateCcw size={14} aria-hidden="true" /> New chat
            </button>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex flex-col items-end gap-1">
              <div className="max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-[18px] rounded-br-[6px] bg-[var(--stem)] text-[var(--sheet)] text-sm leading-6 whitespace-pre-wrap break-words">
                {m.content}
              </div>
              <span className="pr-1 text-xs text-[var(--ink-soft)]">{time(m.at)}</span>
            </div>
          ) : (
            <div key={i} className="flex items-end gap-2">
              <BloomAvatar />
              <div className="min-w-0 max-w-[85%] md:max-w-[75%] flex flex-col gap-2">
                <div className="px-4 py-3 rounded-[18px] rounded-bl-[6px] bg-[var(--sheet)] border border-[var(--rule)] text-sm leading-6 text-[var(--ink)]">
                  <ChatMarkdown text={m.content} />
                </div>
                {m.charts?.map((c, j) => <ChatChart key={j} spec={c} />)}
                <span className="pl-1 text-xs text-[var(--ink-soft)]">{time(m.at)}</span>
              </div>
            </div>
          ),
        )}

        {/* Typing indicator while Bloom looks things up. */}
        {loading && (
          <div className="flex items-end gap-2" role="status" aria-label="Bloom is looking through your records">
            <BloomAvatar />
            <div className="px-4 py-3.5 rounded-[18px] rounded-bl-[6px] bg-[var(--sheet)] border border-[var(--rule)] inline-flex items-center gap-1.5">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-[var(--ink-faint)] motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="self-center max-w-[90%] text-center text-sm text-[var(--margin)]">
            {error} Your question is back in the box, so press send to try again.
          </p>
        )}
      </div>

      {/* The message bar stays at the bottom of the screen, however short the chat: above
          the tab bar on phones, at the window's edge on desktop (beside the sidebar), lined
          up with the centred column. Messages scroll under its page-coloured backing. */}
      <div className="fixed z-20 inset-x-0 md:left-52 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 bg-[var(--paper)]">
       <div className="w-full max-w-3xl mx-auto px-4 md:px-8 pt-2 pb-3">
        <form onSubmit={e => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 pl-4 pr-1.5 py-1.5 rounded-[26px] border border-[var(--rule)] bg-[var(--sheet)] focus-within:border-[var(--stem)] shadow-[0_2px_10px_rgba(26,44,34,0.06)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Message Bloom…"
            aria-label="Your question"
            // The bar's own border shows focus, so the global focus outline is turned off here.
            style={{ outline: "none" }}
            className="flex-1 resize-none bg-transparent py-2.5 text-sm leading-6 text-[var(--ink)] placeholder:text-[var(--ink-faint)] max-h-32 [field-sizing:content]"
          />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Send"
            className={cn("shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full cursor-pointer disabled:cursor-not-allowed",
              "relative before:absolute before:-inset-1 before:content-['']",
              input.trim() && !loading ? "bg-[var(--stem)] text-[var(--sheet)]" : "bg-[var(--bg-secondary)] text-[var(--ink-faint)]")}>
            <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </form>
       </div>
      </div>
      <div ref={endRef} />
    </div>
  );
}
