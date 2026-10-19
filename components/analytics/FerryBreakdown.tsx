"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import type { AttendanceLog, Activity, ActivityCategory, Child } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

const DISPLAY_FONT = "var(--font-display)";

type Role = "sender" | "fetcher";

interface ActivityRec {
  name: string;
  sender: Map<string, number>;
  fetcher: Map<string, number>;
}

// `sent_by`/`fetcher` can hold more than one name (e.g. "Atiqah,Zeya") when a
// session was a joint effort — split it so each named person gets their own
// credit for that session, rather than counting the pair as one combination.
function splitNames(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Sender / fetcher breakdown by activity, per child — a heatmap of session
 * counts, with a toggle for which role (sender or fetcher) it reflects.
 */
export function FerryBreakdown({ logs, children }: { logs: LogWithDetails[]; children: Child[] }) {
  const [role, setRole] = useState<Role>("sender");

  const { perChild, people } = useMemo(() => {
    const personSet = new Set<string>();
    for (const l of logs) {
      for (const p of splitNames(l.sent_by)) personSet.add(p);
      for (const p of splitNames(l.fetcher)) personSet.add(p);
    }
    const people = [...personSet].sort();

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
          for (const p of splitNames(l.sent_by)) rec.sender.set(p, (rec.sender.get(p) || 0) + 1);
          for (const p of splitNames(l.fetcher)) rec.fetcher.set(p, (rec.fetcher.get(p) || 0) + 1);
        }
        const activities = [...actMap.values()].sort((a, b) => a.name.localeCompare(b.name));
        return { child: c, activities };
      });

    return { perChild, people };
  }, [logs, children]);

  if (perChild.length === 0 || people.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No sender or fetcher recorded in this range.</p>;
  }

  // Rank columns left-to-right by total count for the role currently shown, across
  // all children, so the biggest contributor is always leftmost.
  const rankedPeople = [...people].sort((a, b) => {
    const total = (p: string) => perChild.reduce((s, { activities }) => s + activities.reduce((s2, act) => s2 + (act[role].get(p) || 0), 0), 0);
    return total(b) - total(a);
  });

  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>Who Ferries Whom</h3>
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: "sender", label: "Sender" },
            { value: "fetcher", label: "Fetcher" },
          ]}
        />
      </div>

      <div className="space-y-5">
        {perChild.map(({ child, activities }) => {
          const maxCell = Math.max(1, ...activities.flatMap(a => [...a[role].values()]));
          return (
            <div key={child.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5" style={{ backgroundColor: child.color_code }} />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{child.name}</h4>
              </div>

              {/* Phones: each activity name gets its own full-width line above its cells, so the
                  cells use the whole card width. sm+: a 9rem label column, aligned with Timeline. */}
              <div
                className="grid gap-x-1 gap-y-1 text-xs [grid-template-columns:var(--ferry-cols)] sm:[grid-template-columns:var(--ferry-cols-sm)]"
                style={{
                  "--ferry-cols": `repeat(${rankedPeople.length}, minmax(0, 1fr))`,
                  "--ferry-cols-sm": `9rem repeat(${rankedPeople.length}, minmax(0, 1fr))`,
                } as React.CSSProperties}
              >
                <div className="hidden sm:block" />
                {rankedPeople.map(p => (
                  <div key={p} className="text-[10px] text-[var(--text-muted)] text-center truncate" title={p}>{p}</div>
                ))}
                {activities.map(a => (
                  <FerryRow key={a.name} name={a.name} counts={a[role]} people={rankedPeople} maxCell={maxCell} color={child.color_code} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FerryRow({ name, counts, people, maxCell, color }: { name: string; counts: Map<string, number>; people: string[]; maxCell: number; color: string }) {
  return (
    <>
      <div className="col-span-full sm:col-span-1 pt-1.5 sm:pt-0 sm:h-8 flex items-center pr-1 text-xs leading-tight text-[var(--text-secondary)]">
        <span className="truncate" title={name}>{name}</span>
      </div>
      {people.map(p => {
        const c = counts.get(p) || 0;
        const alpha = c === 0 ? 0 : 0.15 + (c / maxCell) * 0.75;
        return (
          <div
            key={p}
            className="h-7 sm:h-8 rounded-[4px] flex items-center justify-center text-[11px] tabular-nums"
            style={{
              backgroundColor: c === 0 ? "var(--bg-secondary)" : `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`,
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
