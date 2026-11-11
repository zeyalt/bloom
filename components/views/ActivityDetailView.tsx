"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Check, X, Minus } from "lucide-react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Header, BackButton } from "@/components/layout/Header";
import { Page, PageBody } from "@/components/layout/Page";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS, EXPENSE_TYPE_COLORS, normalizeLessonType, type ExpenseType } from "@/lib/constants";
import { useActivities, useAttendanceLogs, useExpenses, useMilestones, useChildren } from "@/lib/api-hooks";
import { costPerHour } from "@/lib/cost-per-hour";

const isAttendedLike = (status: string) => status !== "absent" && status !== "cancelled_by_provider";

// Recent-attendance marks: any attended-like status is a tick, provider cancellations a dash.
const MARKS = {
  attended: { color: "#16A34A", Icon: Check },
  cancelled: { color: "#78716C", Icon: Minus },
  absent: { color: "#DC2626", Icon: X },
} as const;
type Mark = keyof typeof MARKS;
const markOf = (status: string): Mark =>
  status === "cancelled_by_provider" ? "cancelled" : isAttendedLike(status) ? "attended" : "absent";

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
  // Cost per hour uses the same method as Analytics: all of this child's stints of the
  // same-named activity, so a restarted activity is priced from its latest payment.
  // Every stint of this activity for this child (a restarted activity has several records).
  const stints = useMemo(() => {
    if (!activity) return [];
    const label = activity.activity_name || activity.institution;
    return activities.filter(a => a.child_id === activity.child_id && (a.activity_name || a.institution) === label);
  }, [activity, activities]);
  // Payments across every stint (P1, P2, P3… of the same class), so it doesn't matter
  // which year's record a payment is attached to — the price and the list agree.
  const expenses = useMemo(() => {
    const stintIds = new Set(stints.map(a => a.id));
    return expensesAll.filter(e => e.activity_id && stintIds.has(e.activity_id));
  }, [stints, expensesAll]);
  const price = useMemo(() => {
    if (!activity) return null;
    const stintIds = new Set(stints.map(a => a.id));
    return costPerHour(expenses, allLogs.filter(l => stintIds.has(l.activity_id)));
  }, [activity, stints, expenses, allLogs]);
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

    // Last 50 sessions, oldest → newest so the strip reads left to right (scrolls back in time).
    const recentLogs = [...logs]
      .sort((a, b) => b.date.localeCompare(a.date) || (b.start_time ?? "").localeCompare(a.start_time ?? ""))
      .slice(0, 50)
      .reverse();
    const recentExpenses = [...expenses].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 5);

    // All-time tally, using the same tick / cross / dash rule as the strip's icons.
    const statusTally: Record<Mark, number> = { attended: 0, cancelled: 0, absent: 0 };
    for (const l of logs) statusTally[markOf(l.status)]++;

    return { sessionsAttended, attendanceRate, totalHours, senders, fetchers, people, recentLogs, statusTally, recentExpenses };
  }, [logs, expenses]);

  // Tapped column in the recent-attendance strip; falls back to the latest session.
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  // Open the strip scrolled to the newest session; older ones are a scroll to the left.
  const stripRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [stats.recentLogs]);
  const selectedLog = stats.recentLogs.find(l => l.id === selectedLogId) ?? stats.recentLogs.at(-1);

  const loading = la || ll || le || lm;
  const ferryPalette = ["#2f6f4e", "#b45309", "#3d6b7a", "#6b5344", "#7c3aed", "#9f1239"];

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-8 pt-20 flex flex-col gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />)}
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-8 pt-20 text-center text-[var(--ink-soft)]">
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
    <Page>
      <Header
        title={title}
        subtitle={[child?.name, activity.activity_name ? activity.institution : null, activity.level].filter(Boolean).join(" · ")}
        leading={<BackButton icon={ArrowLeft} onClick={() => router.back()} />}
      />

      <PageBody clear="nav">
        {/* Label beside value, one line per field; two columns of fields from sm up. */}
        <dl className="border border-[var(--rule)] bg-[var(--sheet)] px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {details.map(d => (
            <div key={d.label} className="flex items-baseline gap-3 min-w-0">
              <dt className="w-28 shrink-0 text-xs text-[var(--ink-faint)]">{d.label}</dt>
              <dd className="min-w-0 text-sm font-medium text-[var(--ink)]">
                {d.value}
                {d.note && <span className="block text-xs font-normal text-[var(--ink-faint)]">{d.note}</span>}
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
              <div className="text-xs text-[var(--ink-faint)] mt-1 leading-tight">
                {formatCurrency(price.perLesson)} per {Math.round(price.sessionMinutes)}-min lesson
              </div>
            ) : (
              <div className="text-xs text-[var(--ink-faint)] mt-1 leading-tight">No lesson payment with a lesson count</div>
            )}
          </div>
        </div>

        {/* 4: sender / fetcher distribution — one 100% bar each */}
        {(stats.senders.length > 0 || stats.fetchers.length > 0) && (
          <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4">
            <h3 className="font-semibold text-[var(--ink)] mb-4">Who sends &amp; fetches</h3>
            <div className="space-y-4">
              {([["Sender", stats.senders], ["Fetcher", stats.fetchers]] as const).map(([role, rows]) => (
                <div key={role}>
                  <p className="text-xs text-[var(--ink-faint)] mb-2">{role}</p>
                  {rows.length === 0 ? (
                    <p className="text-xs text-[var(--ink-faint)]">None recorded.</p>
                  ) : (
                    <div className="flex h-6 w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
                      {rows.map(f => {
                        const color = ferryPalette[stats.people.indexOf(f.name) % ferryPalette.length];
                        return (
                          <div
                            key={f.name}
                            style={{ width: `${f.pct}%`, backgroundColor: color }}
                            className="flex items-center justify-center text-xs font-bold text-white"
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
                <span key={name} className="inline-flex items-center gap-2 text-xs text-[var(--ink-soft)]">
                  <span className="w-2 h-2 shrink-0" style={{ backgroundColor: ferryPalette[i % ferryPalette.length] }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Milestones timeline */}
        <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4">
          <h3 className="font-semibold text-[var(--ink)] mb-1">Milestones</h3>
          <p className="text-xs text-[var(--ink-faint)] mb-4">Gradings, achievements, and other key moments</p>
          {milestones.length === 0 ? (
            <p className="text-sm text-[var(--ink-faint)]">No milestones logged yet for this activity.</p>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[var(--rule)]" />
              <div className="space-y-4">
                {milestones.map(m => (
                  <div key={m.id} className="relative">
                    <span className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-[var(--stem)] ring-2 ring-[var(--sheet)]" />
                    <div className="flex items-start gap-2">
                      <Trophy size={16} className="text-[var(--warn)] mt-1 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--ink-faint)]">{formatDate(m.date)}</div>
                        <div className="text-sm font-medium text-[var(--ink)]">{m.title}</div>
                        {m.result && <div className="text-xs text-[var(--ink-soft)] mt-1">{m.result}</div>}
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
          <div className="px-4 pt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h3 className="font-semibold text-[var(--ink)]">Recent attendance</h3>
            {stats.recentLogs.length > 0 && (
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-soft)]" aria-label="All-time attendance">
                <li className="basis-full sm:basis-auto whitespace-nowrap text-xs sm:text-xs uppercase sm:normal-case tracking-wide sm:tracking-normal text-[var(--ink-faint)]">All time</li>
                {(Object.entries(MARKS) as [Mark, (typeof MARKS)[Mark]][]).map(([key, { color, Icon }]) => (
                  <li key={key} className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full text-white" style={{ backgroundColor: color }}>
                      <Icon size={12} strokeWidth={3.5} />
                    </span>
                    <span className="font-semibold text-[var(--ink)]">{stats.statusTally[key]}</span> {key}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {stats.recentLogs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[var(--ink-faint)]">No attendance logged yet.</p>
          ) : (
            <div className="px-3 sm:px-4 pt-3 pb-4">
              {/* One column per session, oldest → newest; the latest is ringed. */}
              {/* Tap (or click) a column to show its details below; defaults to the latest session. */}
              <ol ref={stripRef} className="flex gap-1 overflow-x-auto overscroll-x-contain snap-x pb-1">
                {stats.recentLogs.map((l, i) => {
                  const iso = l.date.slice(0, 10);
                  // Two sessions on one day (e.g. a competition and the class it replaced):
                  // say which is which under the mark — the lesson type if it isn't a normal
                  // class, else the start time.
                  const sameDay = stats.recentLogs[i - 1]?.date.slice(0, 10) === iso || stats.recentLogs[i + 1]?.date.slice(0, 10) === iso;
                  const lessonType = normalizeLessonType(l.lesson_type);
                  const special = lessonType && lessonType !== "Normal" ? lessonType : null;
                  const tag = special ? (special.length <= 5 ? special : special.slice(0, 4)) : sameDay && l.start_time ? formatTime(l.start_time).replace(/^0/, "").replace(/ (AM|PM)$/, "") : null;
                  const label = ATTENDANCE_STATUS_LABELS[l.status] || l.status;
                  const mark = markOf(l.status);
                  const latest = i === stats.recentLogs.length - 1;
                  const { color: bg, Icon } = MARKS[mark];
                  const desc = `${formatDate(iso)}${l.start_time ? ` · ${formatTime(l.start_time)}` : ""} · ${special ? `${special} · ` : ""}${label}`;
                  const selected = l.id === selectedLog?.id;
                  return (
                    <li key={l.id} className="shrink-0 w-9 sm:w-11 snap-end">
                      <button
                        type="button"
                        onClick={() => setSelectedLogId(l.id)}
                        aria-label={desc}
                        aria-pressed={selected}
                        className={`w-full flex flex-col items-center gap-2 pt-2 pb-1 rounded-[var(--radius-md)] cursor-pointer transition-colors ${selected ? "bg-[var(--bg-secondary)]" : "hover:bg-[var(--bg-secondary)]/60"}`}
                      >
                        <span className="flex flex-col items-center leading-tight">
                          <span className="text-xs font-semibold text-[var(--ink)]">{format(parseISO(iso), "d")}</span>
                          <span className="text-xs text-[var(--ink-faint)]">{format(parseISO(iso), "MMM")}</span>
                        </span>
                        <span
                          className={`flex items-center justify-center rounded-full text-white w-6 h-6 sm:w-7 sm:h-7 ${latest ? "ring-2 ring-offset-2 ring-offset-[var(--sheet)]" : ""}`}
                          style={{ backgroundColor: bg, ...(latest ? { ["--tw-ring-color" as string]: bg } : {}) }}
                        >
                          <Icon size={16} strokeWidth={3} />
                        </span>
                        {/* Same-day sessions and non-standard ones (competition, trial…) get a tag. */}
                        <span className="h-4 text-xs leading-4 font-medium text-[var(--ink-soft)] whitespace-nowrap">{tag}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {selectedLog && (
                <div className="mt-2 px-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-live="polite">
                  <span className="font-medium text-[var(--ink)]">{format(parseISO(selectedLog.date.slice(0, 10)), "EEE, d MMM yyyy")}</span>
                  {selectedLog.start_time && (
                    <span className="text-[var(--ink-soft)]">{formatTime(selectedLog.start_time)}{selectedLog.end_time ? `–${formatTime(selectedLog.end_time)}` : ""}</span>
                  )}
                  {normalizeLessonType(selectedLog.lesson_type) && normalizeLessonType(selectedLog.lesson_type) !== "Normal" && (
                    <span className="text-[var(--ink-soft)]">· {normalizeLessonType(selectedLog.lesson_type)}</span>
                  )}
                  <Badge
                    label={ATTENDANCE_STATUS_LABELS[selectedLog.status] || selectedLog.status}
                    color={ATTENDANCE_STATUS_COLORS[selectedLog.status]}
                  />
                </div>
              )}
              <p className="mt-2 px-1 text-xs text-[var(--ink-faint)]">
                Last {stats.recentLogs.length} sessions · scroll left for older · tap a date for details
              </p>
            </div>
          )}
        </div>

        {/* 6: recent expenses */}
        <div className="border border-[var(--rule)] bg-[var(--sheet)]">
          <h3 className="font-semibold text-[var(--ink)] px-4 pt-6">Recent expenses</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="border-b border-[var(--rule)] text-xs text-[var(--ink-faint)]">
                  <th className="text-left font-semibold px-4 py-2">Date</th>
                  <th className="text-left font-semibold px-3 py-2">Description</th>
                  <th className="hidden sm:table-cell text-left font-semibold px-3 py-2">Category</th>
                  <th className="text-right font-semibold px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExpenses.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-4 text-[var(--ink-faint)]">No expenses logged yet.</td></tr>
                ) : stats.recentExpenses.map(e => (
                  <tr key={e.id} className="border-b border-[var(--rule)] last:border-0">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(e.payment_date)}</td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">
                      {e.description || "—"}
                      {/* Phones: category sits under the description so the amount stays in view. */}
                      <span className="sm:hidden mt-1 flex"><ExpenseCategory type={e.expense_type} /></span>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 whitespace-nowrap"><ExpenseCategory type={e.expense_type} /></td>
                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-2" />
        </div>
      </PageBody>
    </Page>
  );
}

function ExpenseCategory({ type }: { type?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ink-soft)]">
      <span className="w-2 h-2 rounded-full shrink-0" aria-hidden="true"
        style={{ backgroundColor: EXPENSE_TYPE_COLORS[type as ExpenseType] ?? "var(--ink-faint)" }} />
      {type || "—"}
    </span>
  );
}
