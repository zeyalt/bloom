"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, Copy, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const KNOWN_HEADERS = new Set([
  "Overview",
  "Key highlights",
  "Skills & progress",
  "Struggles & watch-outs",
  "Suggested next focus",
]);

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function stripFence(raw: string) {
  return raw
    .replace(/^```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function headingLevel(line: string): { level: 1 | 2 | 3; text: string } | null {
  const hashed = line.match(/^(#{1,3})\s*(.+)$/);
  if (hashed) {
    return { level: hashed[1].length as 1 | 2 | 3, text: hashed[2].trim() };
  }
  const boldOnly = line.match(/^\*\*(.+)\*\*$/);
  const candidate = (boldOnly ? boldOnly[1] : line).trim();
  if (KNOWN_HEADERS.has(candidate)) return { level: 2, text: candidate };
  return null;
}

function bulletText(line: string): string | null {
  const m = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
  return m ? m[1] : null;
}

function parseBlocks(raw: string): Block[] {
  const lines = stripFence(raw).split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }

    const heading = headingLevel(trimmed);
    if (heading) {
      blocks.push({ type: "h", ...heading });
      i++;
      continue;
    }

    const firstBullet = bulletText(trimmed);
    if (firstBullet !== null) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) break;
        const b = bulletText(t);
        if (b === null) break;
        items.push(b);
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (headingLevel(t) || bulletText(t) !== null) break;
      para.push(t);
      i++;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

function toCopyText(raw: string): string {
  return parseBlocks(raw)
    .map(block => {
      if (block.type === "h") return block.text;
      if (block.type === "ul") return block.items.map(item => `• ${stripInline(item)}`).join("\n");
      return stripInline(block.text);
    })
    .join("\n\n")
    .trim();
}

function writeClipboard(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function stripInline(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return <code key={i} className="text-[0.9em]">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function SummaryText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === "h") {
          const Tag = block.level === 1 ? "h3" : "h4";
          return (
            <Tag
              key={i}
              className={block.level === 1
                ? "text-lg font-semibold tracking-tight text-[var(--ink)] mt-5 first:mt-0"
                : "text-sm font-semibold tracking-tight text-[var(--ink)] mt-4 first:mt-0"}
            >
              <Inline text={block.text} />
            </Tag>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-1.5 pl-0 list-none">
              {block.items.map((item, j) => (
                <li key={j} className="relative pl-4 text-[var(--ink-soft)]">
                  <span className="absolute left-0 top-[0.55em] w-1.5 h-1.5 bg-[var(--stem)]" aria-hidden />
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[var(--ink-soft)]">
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  title: string;
  kind: "journey" | "overview";
  activityId?: string;
  childId?: string;
}

export function SummaryCard({ title, kind, activityId, childId }: Props) {
  const qc = useQueryClient();
  const scopeKey = activityId ? `activity:${activityId}` : childId ? `child:${childId}` : "all";
  const scopeQuery = activityId ? `?activity_id=${activityId}` : childId ? `?child_id=${childId}` : "";

  const { data: cached } = useQuery({
    queryKey: ["ai-summary", scopeKey],
    queryFn: async () => {
      const r = await fetch(`/api/ai/summary${scopeQuery}`);
      if (!r.ok) return { summary: null } as { summary: string | null; generated_at?: string };
      return r.json() as Promise<{ summary: string | null; generated_at?: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [local, setLocal] = useState<{ summary: string; at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const summary = local?.summary ?? cached?.summary ?? "";
  const at = local?.at ?? cached?.generated_at ?? "";

  async function generate() {
    setLoading(true); setError("");
    try {
      const body = activityId ? { activity_id: activityId } : childId ? { child_id: childId } : {};
      const r = await fetch("/api/ai/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to generate summary");
      setLocal({ summary: j.summary, at: j.generated_at });
      qc.invalidateQueries({ queryKey: ["ai-summary", scopeKey] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    setError("");
    const text = toCopyText(summary);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = writeClipboard(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1600);
  }

  const emptyHint = kind === "journey"
    ? "Generate an AI summary of this activity’s journey."
    : "Generate an AI overview and key highlights from these reflections.";

  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-base font-semibold text-[var(--ink)] truncate">{title}</h3>
        </div>
        {summary && (
          <div className="shrink-0 flex items-center gap-3">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Regenerate
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--margin)]">{error}</p>}

      {summary ? (
        <div className="mt-3">
          <SummaryText text={summary} />
          {at && (
            <p className="text-[11px] text-[var(--ink-faint)] mt-4">
              Updated {formatDistanceToNow(new Date(at), { addSuffix: true })} · From the reflections
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-[var(--ink-soft)]">{emptyHint}</p>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[var(--sheet)] bg-[var(--ink)] hover:bg-[var(--stem)] active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 cursor-pointer"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Generating…" : "Generate Summary"}
          </button>
        </div>
      )}
    </div>
  );
}
