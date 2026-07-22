"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import type { AttendanceLog, Activity, ActivityCategory, Child } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

const PERSON_PALETTE = ["#0066cc", "#10b981", "#f59e0b", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];

type Role = "sender" | "fetcher";
type Style = "stacked" | "paired" | "heatmap";

interface ActivityRec {
  name: string;
  sender: Map<string, number>;
  fetcher: Map<string, number>;
}

const sumMap = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

/**
 * Sender / fetcher breakdown by activity, per child. Three view styles so the
 * user can compare and keep the one that reads best.
 */
export function FerryBreakdown({ logs, children }: { logs: LogWithDetails[]; children: Child[] }) {
  const [style, setStyle] = useState<Style>("stacked");
  const [role, setRole] = useState<Role>("sender");

  const { perChild, personColor, people } = useMemo(() => {
    const personSet = new Set<string>();
    for (const l of logs) {
      if (l.sent_by) personSet.add(l.sent_by);
      if (l.fetcher) personSet.add(l.fetcher);
    }
    const people = [...personSet].sort();
    const personColor = new Map(people.map((p, i) => [p, PERSON_PALETTE[i % PERSON_PALETTE.length]]));

    const byChild = new Map<string, LogWithDetails[]>();
    for (const l of logs) {
      const arr = byChild.get(l.child_id) ?? [];
      arr.push(l);
      byChild.set(l.child_id, arr);
    }

    const perChild = children
      .filter(c => byChild.has(c.id))
      .map(c => {
        const clogs = byChild.get(c.id)!;
        const actMap = new Map<string, ActivityRec>();
        for (const l of clogs) {
          const act = l.activity?.activity_name || l.activity?.institution || "Unknown";
          if (!actMap.has(act)) actMap.set(act, { name: act, sender: new Map(), fetcher: new Map() });
          const rec = actMap.get(act)!;
          if (l.sent_by) rec.sender.set(l.sent_by, (rec.sender.get(l.sent_by) || 0) + 1);
          if (l.fetcher) rec.fetcher.set(l.fetcher, (rec.fetcher.get(l.fetcher) || 0) + 1);
        }
        const activities = [...actMap.values()].sort((a, b) => a.name.localeCompare(b.name));
        return { child: c, activities };
      });

    return { perChild, personColor, people };
  }, [logs, children]);

  if (perChild.length === 0 || people.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No sender or fetcher recorded in this range.</p>;
  }

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {people.map(p => (
        <span key={p} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: personColor.get(p) }} />
          {p}
        </span>
      ))}
    </div>
  );

  // Reusable 100%-flex segmented bar
  const segBar = (counts: Map<string, number>, total: number) => (
    <div className="flex h-full w-full rounded-[4px] overflow-hidden bg-[var(--bg-secondary)]">
      {total === 0
        ? null
        : people
            .filter(p => counts.get(p))
            .map(p => (
              <div
                key={p}
                title={`${p}: ${counts.get(p)}`}
                style={{ backgroundColor: personColor.get(p), flexGrow: counts.get(p) }}
              />
            ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={style}
          onChange={setStyle}
          options={[
            { value: "stacked", label: "Stacked" },
            { value: "paired", label: "Send → Fetch" },
            { value: "heatmap", label: "Heatmap" },
          ]}
        />
        {style === "stacked" && (
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: "sender", label: "Sender" },
              { value: "fetcher", label: "Fetcher" },
            ]}
          />
        )}
      </div>

      {legend}

      <div className="space-y-6">
        {perChild.map(({ child, activities }) => (
          <div key={child.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 md:p-5 shadow-[var(--shadow-xs)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: child.color_code }} />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{child.name}</h4>
            </div>

            {/* ── Stacked: one bar per activity, width ∝ session count ── */}
            {style === "stacked" && (() => {
              const rows = activities.map(a => {
                const counts = a[role];
                return { name: a.name, counts, total: sumMap(counts) };
              });
              const maxTotal = Math.max(1, ...rows.map(r => r.total));
              return (
                <div className="space-y-2">
                  {rows.map(r => (
                    <div key={r.name} className="flex items-center gap-2.5">
                      <span className="w-24 shrink-0 text-xs text-[var(--text-secondary)] truncate" title={r.name}>{r.name}</span>
                      <div className="flex-1 h-5">
                        <div className="h-full" style={{ width: `${(r.total / maxTotal) * 100}%` }}>{segBar(r.counts, r.total)}</div>
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">{r.total}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Paired: send vs fetch 100%-stacked, per activity ── */}
            {style === "paired" && (
              <div className="space-y-3">
                {activities.map(a => {
                  const sTotal = sumMap(a.sender);
                  const fTotal = sumMap(a.fetcher);
                  return (
                    <div key={a.name}>
                      <div className="text-xs text-[var(--text-secondary)] mb-1">{a.name}</div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">S</span>
                        <div className="flex-1 h-4">{segBar(a.sender, sTotal)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">F</span>
                        <div className="flex-1 h-4">{segBar(a.fetcher, fTotal)}</div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-[var(--text-muted)]">S = who sent · F = who fetched (each bar = 100% of that activity’s sessions)</p>
              </div>
            )}

            {/* ── Heatmap: activity × person, intensity ∝ count ── */}
            {style === "heatmap" && (() => {
              const maxCell = Math.max(
                1,
                ...activities.flatMap(a => [...a.sender.values(), ...a.fetcher.values()])
              );
              const grid = (title: string, get: (a: ActivityRec) => Map<string, number>) => (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">{title}</p>
                  <div className="grid gap-1 text-xs" style={{ gridTemplateColumns: `5.5rem repeat(${people.length}, minmax(0, 1fr))` }}>
                    <div />
                    {people.map(p => (
                      <div key={p} className="text-[10px] text-[var(--text-muted)] text-center truncate" title={p}>{p}</div>
                    ))}
                    {activities.map(a => (
                      <FerryRow key={a.name} name={a.name} counts={get(a)} people={people} maxCell={maxCell} />
                    ))}
                  </div>
                </div>
              );
              return (
                <div className="space-y-4">
                  {grid("Sent", a => a.sender)}
                  {grid("Fetched", a => a.fetcher)}
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

function FerryRow({ name, counts, people, maxCell }: { name: string; counts: Map<string, number>; people: string[]; maxCell: number }) {
  return (
    <>
      <div className="text-xs text-[var(--text-secondary)] truncate self-center" title={name}>{name}</div>
      {people.map(p => {
        const c = counts.get(p) || 0;
        const alpha = c === 0 ? 0 : 0.15 + (c / maxCell) * 0.75;
        return (
          <div
            key={p}
            className="h-7 rounded-[4px] flex items-center justify-center text-[11px] tabular-nums"
            style={{
              backgroundColor: c === 0 ? "var(--bg-secondary)" : `rgba(0, 102, 204, ${alpha})`,
              color: alpha > 0.55 ? "#fff" : "var(--text-muted)",
            }}
          >
            {c || ""}
          </div>
        );
      })}
    </>
  );
}
