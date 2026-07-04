"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const HEADERS = new Set([
  "Overview", "Key highlights", "Skills & progress", "Struggles & watch-outs", "Suggested next focus",
]);

function SummaryText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1.5" />;
        if (HEADERS.has(t)) return <p key={i} className="font-semibold text-[var(--text-primary)] mt-2">{t}</p>;
        if (t.startsWith("- ") || t.startsWith("• ")) return <p key={i} className="text-[var(--text-secondary)] pl-3">• {t.replace(/^[-•]\s+/, "")}</p>;
        return <p key={i} className="text-[var(--text-secondary)]">{t}</p>;
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

  const genLabel = kind === "journey" ? "Generate journey summary" : "Generate overview & highlights";
  const emptyHint = kind === "journey"
    ? "Generate an AI summary of this activity’s journey."
    : "Generate an AI overview and key highlights from these reflections.";

  return (
    <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--bg-card)] p-5 md:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={16} className="text-[var(--accent-primary)] shrink-0" />
          <h3 className="text-base font-semibold text-[var(--text-primary)] truncate" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
        </div>
        {summary && (
          <button onClick={generate} disabled={loading} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerate
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {summary ? (
        <div className="mt-3">
          <SummaryText text={summary} />
          {at && (
            <p className="text-[11px] text-[var(--text-muted)] mt-3">
              Updated {formatDistanceToNow(new Date(at), { addSuffix: true })} · AI-generated from reflections
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-[var(--text-secondary)]">{emptyHint}</p>
          <button onClick={generate} disabled={loading} className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Generating…" : genLabel}
          </button>
        </div>
      )}
    </div>
  );
}
