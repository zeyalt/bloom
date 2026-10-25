"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useActivities, useAttendanceLogs, useExpenses, useMilestones, useChildren } from "@/lib/api-hooks";
import { costPerHour } from "@/lib/cost-per-hour";

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
  // All logs (one shared cache); this stint's logs and its sibling stints' are both derived below.
  const { data: allLogs = [], isLoading: ll } = useAttendanceLogs({ limit: "all" });
  const { data: expensesAll = [], isLoading: le } = useExpenses({ limit: 500 });
  const { data: milestonesAll = [], isLoading: lm } = useMilestones();
  const { data: children = [] } = useChildren();

  const activity = activities.find(a => a.id === activityId);
  const child = children.find(c => c.id === activity?.child_id);
  const logs = useMemo(() => allLogs.filter(l => l.activity_id === activityId), [allLogs, activityId]);
  const expenses = useMemo(() => expensesAll.filter(e => e.activity_id === activityId), [expensesAll, activityId]);
  // Cost per hour uses the same method as Analytics: all of this child's stints of the
  // same-named activity, so a restarted activity is priced from its latest payment.
  // Every stint of this activity for this child (a restarted activity has several records).
  const stints = useMemo(() => {
    if (!activity) return [];
    const label = activity.activity_name || activity.institution;
    return activities.filter(a => a.child_id === activity.child_id && (a.activity_name || a.institution) === label);
  }, [activity, activities]);
  const price = useMemo(() => {
    if (!activity) return null;
    const stintIds = new Set(stints.map(a => a.id));
    return costPerHour(
      expensesAll.filter(e => e.activity_id && stintIds.has(e.activity_id)),
      allLogs.filter(l => stintIds.has(l.activity_id))
    );
  }, [activity, stints, expensesAll, allLogs]);
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

    // Same rule as Analytics › Who Ferries Whom: "Zeya, Atiqah" credits a session to each name.
    const tally = (pick: (l: (typeof logs)[number]) => string | null | undefined) => {
      const counts = new Map<string, number>();
      for (const l of logs) for (const name of splitNames(pick(l))) counts.set(name, (counts.get(name) || 0) + 1);
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count, pct: total ? (count / total) * 100 : 0 }));
    };
    const senders = tally(l => l.sent_by);
    const fetchers = tally(l => l.fetcher);
    // One colour per person across both bars, ranked by their combined count.
    const combined = new Map<string, number>();
    for (const p of [...senders, ...fetchers]) combined.set(p.name, (combined.get(p.name) || 0) + p.count);
    const people = [...combined.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

    const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const recentExpenses = [...expenses].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 5);

    return { sessionsAttended, attendanceRate, totalHours, senders, fetchers, people, recentLogs, recentExpenses };
  }, [logs, expenses]);

  const loading = la || ll || le || lm;
  const ferryPalette = ["#2f6f4e", "#b45309", "#3d6b7a", "#6b5344", "#7c3aed", "#9f1239"];

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

  // Coach: what the activity record says, else whoever taught the most recent logged session.
  const latestCoach = [...logs].sort((a, b) => b.date.localeCompare(a.date)).find(l => l.instructor_name)?.instructor_name;
  const coach = activity.instructor_name || latestCoach || null;
  const firstStart = stints.map(a => a.start_date).filter((d): d is string => !!d).sort()[0] ?? null;
  const startedLabel = firstStart
    ? `${formatDate(firstStart)} (${formatDistanceToNowStrict(parseISO(firstStart.slice(0, 10)))} ago)`
    : "—";
  const restarted = stints.length > 1 && activity.start_date && activity.start_date !== firstStart;
  const STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused", completed: "Completed", dropped: "Dropped" };
  const statusLabel = STATUS_LABELS[activity.status] ?? activity.status;
  const details: { label: string; value: string; note?: string }[] = [
    { label: "Institution", value: activity.institution },
    { label: "Coach / instructor", value: coach ?? "—" },
    { label: "Started", value: startedLabel, note: restarted ? `This stint from ${formatDate(activity.start_date!)}` : undefined },
    { label: "Level", value: activity.level || "—" },
    { label: "Status", value: statusLabel },
  ];

  return (
    <div className="max-w-[900px] mx-auto w-full">
      <Header
        title={title}
        subtitle={child?.name ?? ""}
        leading={
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 -ml-1 py-1 pr-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
          >
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      <div className="px-5 md:px-8 pb-24 md:pb-10 space-y-6">
        {/* Label beside value, one line per field; two columns of fields from sm up. */}
        <dl className="border border-[var(--rule)] bg-[var(--sheet)] px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {details.map(d => (
            <div key={d.label} className="flex items-baseline gap-3 min-w-0">
              <dt className="w-28 shrink-0 text-xs text-[var(--text-muted)]">{d.label}</dt>
              <dd className="min-w-0 text-sm font-medium text-[var(--text-primary)]">
                {d.value}
                {d.note && <span className="block text-xs font-normal text-[var(--text-muted)]">{d.note}</span>}
              </dd>
            </div>
          ))}
        </dl>

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
              {price ? formatCurrency(price.perHour) : "—"}
            </div>
            <div className="text-xs text-[var(--ink-faint)] mt-1">per hour</div>
            {price ? (
              <div className="text-[11px] text-[var(--text-muted)] mt-1 leading-tight">
                {formatCurrency(price.perLesson)} per {Math.round(price.sessionMinutes)}-min lesson
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-muted)] mt-1 leading-tight">No lesson payment with a lesson count</div>
            )}
          </div>
        </div>

        {/* 4: sender / fetcher distribution — one 100% bar each */}
        {(stats.senders.length > 0 || stats.fetchers.length > 0) && (
          <div className="border border-[var(--rule)] bg-[var(--sheet)] p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Who sends &amp; fetches</h3>
            <div className="space-y-4">
              {([["Sender", stats.senders], ["Fetcher", stats.fetchers]] as const).map(([role, rows]) => (
                <div key={role}>
                  <p className="text-xs text-[var(--text-muted)] mb-1.5">{role}</p>
                  {rows.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">None recorded.</p>
                  ) : (
                    <div className="flex h-6 w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
                      {rows.map(f => {
                        const color = ferryPalette[stats.people.indexOf(f.name) % ferryPalette.length];
                        return (
                          <div
                            key={f.name}
                            style={{ width: `${f.pct}%`, backgroundColor: color }}
                            className="flex items-center justify-center text-[10px] font-bold text-white"
                            title={`${f.name} · ${f.count} (${Math.round(f.pct)}%)`}
                          >
                            {f.pct >= 12 ? `${Math.round(f.pct)}%` : ""}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {stats.people.map((name, i) => (
                <span key={name} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span className="w-2 h-2 shrink-0" style={{ backgroundColor: ferryPalette[i % ferryPalette.length] }} />
                  {name}
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
