"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useActivities, useAttendanceLogs, useExpenses, useMilestones, useChildren } from "@/lib/api-hooks";

const isAttendedLike = (status: string) => status !== "absent" && status !== "cancelled_by_provider";

function sessionMinutes(startTime: string | null, endTime: string | null, duration: number | null): number {
  if (duration && duration > 0) return duration;
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : 0;
  }
  return 0;
}

// Splits "Zeya, Atiqah" style combined entries so each name is counted once.
function splitNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function ActivityDetailView({ activityId }: { activityId: string }) {
  const router = useRouter();
  const { data: activities = [], isLoading: la } = useActivities();
  const { data: logs = [], isLoading: ll } = useAttendanceLogs({ activityId, limit: "all" });
  const { data: expensesAll = [], isLoading: le } = useExpenses({ limit: 500 });
  const { data: milestonesAll = [], isLoading: lm } = useMilestones();
  const { data: children = [] } = useChildren();

  const activity = activities.find(a => a.id === activityId);
  const child = children.find(c => c.id === activity?.child_id);
  const expenses = useMemo(() => expensesAll.filter(e => e.activity_id === activityId), [expensesAll, activityId]);
  const milestones = useMemo(
    () => milestonesAll.filter(m => m.activity_id === activityId).sort((a, b) => a.date.localeCompare(b.date)),
    [milestonesAll, activityId]
  );

  const stats = useMemo(() => {
    const sessionsAttended = logs.filter(l => l.status === "attended").length;
    const attendanceRate = logs.length ? (sessionsAttended / logs.length) * 100 : 0;
    const totalHours = logs
      .filter(l => isAttendedLike(l.status))
      .reduce((s, l) => s + sessionMinutes(l.start_time, l.end_time, l.duration_minutes), 0) / 60;
    const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
    const costPerHour = totalHours > 0 ? totalSpend / totalHours : null;

    const ferryCounts = new Map<string, number>();
    for (const l of logs) {
      for (const name of [...splitNames(l.sent_by), ...splitNames(l.fetcher)]) {
        ferryCounts.set(name, (ferryCounts.get(name) || 0) + 1);
      }
    }
    const ferryTotal = [...ferryCounts.values()].reduce((a, b) => a + b, 0);
    const ferryBreakdown = [...ferryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, pct: ferryTotal ? Math.round((count / ferryTotal) * 100) : 0 }));

    const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const recentExpenses = [...expenses].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 5);

    return { sessionsAttended, attendanceRate, totalHours, costPerHour, ferryBreakdown, recentLogs, recentExpenses };
  }, [logs, expenses]);

  const loading = la || ll || le || lm;
  const ferryPalette = ["var(--stem)", "var(--accent-warning)", "var(--ink-faint)", "#3d6b7a"];

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto w-full px-5 md:px-8 pt-4 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />)}
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="max-w-[900px] mx-auto w-full px-5 md:px-8 pt-8 text-center text-[var(--text-muted)]">
        Activity not found.
      </div>
    );
  }

  const title = activity.activity_name || activity.institution;

  return (
    <div className="max-w-[900px] mx-auto w-full">
      <Header
        title={title}
        subtitle={`${child?.name ?? ""} · ${activity.institution}${activity.level ? ` · ${activity.level}` : ""}`}
        action={
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 h-9 px-3 border border-[var(--rule)] bg-[var(--sheet)] text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
          >
            <ArrowLeft size={15} /> Back
          </button>
        }
      />

      <div className="px-5 md:px-8 pb-24 md:pb-10 space-y-6">
        {/* 1–3: stat row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--ink)]">{stats.sessionsAttended}</div>
            <div className="text-xs text-[var(--ink-faint)] mt-1">sessions attended</div>
          </div>
          <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--ink)]">{Math.round(stats.attendanceRate)}%</div>
            <div className="text-xs text-[var(--ink-faint)] mt-1">attendance rate</div>
          </div>
          <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--ink)]">
              {stats.costPerHour !== null ? formatCurrency(stats.costPerHour) : "—"}
            </div>
            <div className="text-xs text-[var(--ink-faint)] mt-1">per hour</div>
          </div>
        </div>

        {/* 4: sender/fetcher distribution */}
        {stats.ferryBreakdown.length > 0 && (
          <div className="border border-[var(--rule)] bg-[var(--sheet)] p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Sender / fetcher distribution</h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">Who sends &amp; fetches for this activity</p>
            <div className="flex h-6 w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
              {stats.ferryBreakdown.map((f, i) => (
                <div
                  key={f.name}
                  style={{ width: `${f.pct}%`, backgroundColor: ferryPalette[i % ferryPalette.length] }}
                  className="flex items-center justify-center text-[10px] font-bold text-[var(--sheet)]"
                  title={`${f.name} · ${f.pct}%`}
                >
                  {f.pct >= 10 ? `${f.pct}%` : ""}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {stats.ferryBreakdown.map((f, i) => (
                <span key={f.name} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span className="w-2 h-2 shrink-0" style={{ backgroundColor: ferryPalette[i % ferryPalette.length] }} />
                  {f.name} · {f.pct}%
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Milestones timeline */}
        <div className="border border-[var(--rule)] bg-[var(--sheet)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Milestones</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Gradings, achievements, and other key moments</p>
          {milestones.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No milestones logged yet for this activity.</p>
          ) : (
            <div className="relative pl-5">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[var(--rule)]" />
              <div className="space-y-4">
                {milestones.map(m => (
                  <div key={m.id} className="relative">
                    <span className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-[var(--stem)] ring-2 ring-[var(--sheet)]" />
                    <div className="flex items-start gap-2">
                      <Trophy size={14} className="text-[var(--accent-warning)] mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--text-muted)]">{formatDate(m.date)}</div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{m.title}</div>
                        {m.result && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{m.result}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5: recent attendance */}
        <div className="border border-[var(--rule)] bg-[var(--sheet)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] px-5 pt-5">Recent attendance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                  <th className="text-left font-semibold px-5 py-2">Date</th>
                  <th className="text-left font-semibold px-3 py-2">Time</th>
                  <th className="text-left font-semibold px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-4 text-[var(--text-muted)]">No attendance logged yet.</td></tr>
                ) : stats.recentLogs.map(l => (
                  <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--text-secondary)]">{l.start_time ? formatTime(l.start_time) : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge label={ATTENDANCE_STATUS_LABELS[l.status] || l.status} color={ATTENDANCE_STATUS_COLORS[l.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-2" />
        </div>

        {/* 6: recent expenses */}
        <div className="border border-[var(--rule)] bg-[var(--sheet)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] px-5 pt-5">Recent expenses</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                  <th className="text-left font-semibold px-5 py-2">Date</th>
                  <th className="text-left font-semibold px-3 py-2">Description</th>
                  <th className="text-right font-semibold px-5 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExpenses.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-4 text-[var(--text-muted)]">No expenses logged yet.</td></tr>
                ) : stats.recentExpenses.map(e => (
                  <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-2 whitespace-nowrap">{formatDate(e.payment_date)}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[220px] truncate">{e.description || "—"}</td>
                    <td className="px-5 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}
