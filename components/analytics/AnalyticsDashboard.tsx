"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addMonths,
  addDays,
} from "date-fns";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { formatCurrency, getCurrentYear } from "@/lib/utils";
import { EXPENSE_TYPE_COLORS } from "@/lib/constants";
import { MultiSelect } from "@/components/ui/FilterDropdown";
import { useExpenses, useAttendanceLogs, useActivities, useChildren, useSchedules } from "@/lib/api-hooks";
import { EngagementTimeline } from "@/components/analytics/EngagementTimeline";
import { FerryBreakdown } from "@/components/analytics/FerryBreakdown";
import type { Expense, AttendanceLog, Activity, Child, Schedule } from "@/lib/types";
import type { AnalyticsSegment } from "@/components/views/AnalyticsView";

const DISPLAY_FONT = "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif";
const PALETTE = ["#2f6f4e", "#1a2c22", "#b45309", "#b42318", "#3d6b7a", "#6b5344", "#4a6741", "#8b5a2b", "#5c7a6a", "#3d4a40"];
// Payers are people, not categories or children, so they get their own hues that
// don't collide with the green category palette or the children's blue/pink.
const PAYER_PALETTE = ["#c2410c", "#0f766e", "#7c3aed", "#ca8a04", "#9f1239", "#475569"];

// Whole dollars (or $12.3k) — the full "$12,345.00" doesn't fit inside a small donut.
const fmtMoneyShort = (v: number) =>
  v >= 10000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v).toLocaleString("en-SG")}`;

// Statuses that represent the child actually showing up (counted toward hours).
const isAttendedLike = (status: string) => status !== "absent" && status !== "cancelled_by_provider";

// Minutes for a single session: prefer stored duration, else derive from times.
function sessionMinutes(log: AttendanceLog): number {
  if (log.duration_minutes && log.duration_minutes > 0) return log.duration_minutes;
  if (log.start_time && log.end_time) {
    const [sh, sm] = log.start_time.split(":").map(Number);
    const [eh, em] = log.end_time.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : 0;
  }
  return 0;
}

// Minutes for a single weekly schedule slot: prefer stored duration, else derive from times.
function scheduleMinutes(s: Schedule): number {
  if (s.duration_minutes && s.duration_minutes > 0) return s.duration_minutes;
  if (s.start_time && s.end_time) {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : 0;
  }
  return 0;
}

const fmtHours = (h: number) => `${h.toFixed(1)}h`;
const fmtPct = (n: number) => `${Math.round(n)}%`;

// % change vs previous period; null when there's no baseline to compare against.
function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

interface Bucket { key: string; label: string }

function bucketsInRange(from: Date, to: Date, gran: "week" | "month"): Bucket[] {
  const out: Bucket[] = [];
  if (gran === "month") {
    let d = startOfMonth(from);
    while (d <= to) {
      out.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy") });
      d = addMonths(d, 1);
    }
  } else {
    let d = startOfWeek(from, { weekStartsOn: 0 });
    while (d <= to) {
      out.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM") });
      d = addDays(d, 7);
    }
  }
  return out;
}

const recordBucket = (dateStr: string, gran: "week" | "month") =>
  gran === "month"
    ? format(parseISO(dateStr.slice(0, 10)), "yyyy-MM")
    : format(startOfWeek(parseISO(dateStr.slice(0, 10)), { weekStartsOn: 0 }), "yyyy-MM-dd");

// ── Reusable presentation pieces ──────────────────────────────────────────

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{children}</h3>;
}

function ChartCard({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-[var(--rule)] bg-[var(--sheet)] p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] px-3 py-2">
      {label != null && <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 shrink-0" style={{ backgroundColor: p.color || p.payload?.fill }} />
          <span className="text-[var(--text-secondary)]">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Donuts need a share-of-total alongside the value; `total` is passed in by the
// caller since Recharts' Tooltip payload doesn't reliably expose Pie's percent.
function DonutTooltip({ active, payload, formatter, total }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total > 0 ? (p.value / total) * 100 : 0;
  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 shrink-0" style={{ backgroundColor: p.payload?.fill || p.color }} />
        <span className="text-[var(--text-secondary)]">{p.name}</span>
        <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">
          {formatter ? formatter(p.value) : p.value}
          <span className="ml-1 font-normal text-[var(--text-muted)]">({Math.round(pct)}%)</span>
        </span>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex border border-[var(--rule)] bg-[var(--sheet)]">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs font-medium cursor-pointer ${i > 0 ? "border-l border-[var(--rule)]" : ""} ${value === o.value ? "bg-[var(--ink)] text-[var(--sheet)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface DonutDatum { name: string; value: number; color: string }

// A KPI tile that shows a category breakdown as a mini donut instead of a single number + sparkline.
function MiniDonutKpi({ label, data, center, formatter, animate }: { label: string; data: DonutDatum[]; center: string; formatter: (v: number) => string; animate: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] p-5 md:p-6">
      <CardTitle>{label}</CardTitle>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="relative w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={46} paddingAngle={2} stroke="none" isAnimationActive={animate} animationDuration={700}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<DonutTooltip formatter={formatter} total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{center}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] min-w-0">
              <span className="w-2 h-2 shrink-0" style={{ backgroundColor: d.color }} />
              <span className="truncate text-[var(--text-secondary)]">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ActivityBarGroup {
  id: string;
  name: string;
  color: string;
  rows: { name: string; id: string | null; value: number; detail?: string }[];
}

// Per-child horizontal bars where the activity name sits on the bar itself, so the
// bar can use the full card width instead of sharing it with a label column.
function ActivityBarGroups({ groups, format, onSelect }: { groups: ActivityBarGroup[]; format: (v: number) => string; onSelect: (id: string | null) => void }) {
  return (
    <div className="space-y-5">
      {groups.map(g => {
        const rows = g.rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value);
        if (rows.length === 0) return null;
        const max = Math.max(...rows.map(r => r.value));
        return (
          <div key={g.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5" style={{ backgroundColor: g.color }} />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{g.name}</h4>
            </div>
            <div className="space-y-1">
              {rows.map(r => (
                <button
                  key={r.name}
                  onClick={() => onSelect(r.id)}
                  title={`${r.name} · ${format(r.value)}${r.detail ? ` (${r.detail})` : ""}`}
                  className="relative flex items-center w-full h-7 rounded-[4px] bg-[var(--bg-secondary)] overflow-hidden cursor-pointer text-left"
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-[4px]"
                    style={{ width: `${(r.value / max) * 100}%`, backgroundColor: `color-mix(in srgb, ${g.color} 35%, transparent)` }}
                  />
                  <span className="relative flex-1 min-w-0 px-2 text-xs text-[var(--text-primary)] truncate">{r.name}</span>
                  <span className="relative shrink-0 pr-2 text-xs font-semibold tabular-nums text-[var(--text-primary)]">{format(r.value)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const axisProps = {
  stroke: "var(--text-muted)",
  tick: { fontSize: 11, fill: "var(--text-muted)" } as const,
  tickLine: false,
  axisLine: false,
};

// ── Page ──────────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ segment }: { segment: AnalyticsSegment }) {
  const router = useRouter();
  const goToActivity = (id: string | null | undefined) => { if (id) router.push(`/activity/${id}`); };
  const { data: expensesData = [], isLoading: le } = useExpenses({ limit: 500 });
  const { data: logsData = [], isLoading: ll } = useAttendanceLogs({ limit: "all" });
  const { data: activitiesData = [] } = useActivities();
  const { data: childrenData = [] } = useChildren();
  const { data: schedulesData = [] } = useSchedules();
  const loading = le || ll;

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAnimate(!reduce);
  }, []);

  // Year filter — multi-select, defaults to the current year. Empty = all years.
  const [filterYears, setFilterYears] = useState<string[]>([String(getCurrentYear())]);
  const toggleFilterYear = (year: string) => setFilterYears(prev => (prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]));
  const yearOptions = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i);

  // Child filter — all selected by default; toggling a pill off hides that child.
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const childrenInit = useRef(false);
  const toggleChild = (id: string) => setSelectedChildren(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  useEffect(() => {
    if (!childrenInit.current && (childrenData as Child[]).length) {
      setSelectedChildren((childrenData as Child[]).map(c => c.id));
      childrenInit.current = true;
    }
  }, [childrenData]);

  const data = useMemo(() => {
    const childOk = (id: string) => selectedChildren.includes(id);

    // Effective range spanning the selected years (all years, when none are selected).
    const allYears = [
      ...new Set([...(expensesData as Expense[]).map(e => e.payment_date.slice(0, 4)), ...(logsData as AttendanceLog[]).map(l => l.date.slice(0, 4))]),
    ];
    const activeYears = filterYears.length > 0 ? filterYears : allYears;
    const minYear = activeYears.length ? Math.min(...activeYears.map(Number)) : getCurrentYear();
    const maxYear = activeYears.length ? Math.max(...activeYears.map(Number)) : getCurrentYear();
    const from = startOfMonth(parseISO(`${minYear}-01-01`));
    const to = endOfMonth(parseISO(`${maxYear}-12-01`));
    const prevYears = filterYears.map(y => String(Number(y) - 1));

    const yearOk = (d: string) => activeYears.includes(d.slice(0, 4));
    const prevYearOk = (d: string) => filterYears.length > 0 && prevYears.includes(d.slice(0, 4));

    const expIn = (expensesData as Expense[]).filter(e => childOk(e.child_id) && yearOk(e.payment_date));
    const expPrev = (expensesData as Expense[]).filter(e => childOk(e.child_id) && prevYearOk(e.payment_date));
    const logIn = (logsData as AttendanceLog[]).filter(l => childOk(l.child_id) && yearOk(l.date));
    const logPrev = (logsData as AttendanceLog[]).filter(l => childOk(l.child_id) && prevYearOk(l.date));

    // Lookups
    const actById = new Map((activitiesData as Activity[]).map(a2 => [a2.id, a2]));
    const childById = new Map((childrenData as Child[]).map(c => [c.id, c]));
    const activityLabel = (id: string | null | undefined, fallback?: string) => {
      const act = id ? actById.get(id) : undefined;
      return act?.activity_name || act?.institution || fallback || "Unknown";
    };

    // Category color map gathered from joined data, fallback to palette.
    const catColor = new Map<string, string>();
    for (const e of expensesData as Expense[]) if (e.category) catColor.set(e.category.name, e.category.color_code);
    for (const a2 of activitiesData as Activity[]) if (a2.category) catColor.set(a2.category.name, a2.category.color_code);
    const colorForCat = (name: string, i: number) => catColor.get(name) || PALETTE[i % PALETTE.length];

    const childColor = (name: string) => (childrenData as Child[]).find(c => c.name === name)?.color_code || PALETTE[0];

    // ── KPIs ──
    const sum = (arr: Expense[]) => arr.reduce((s, e) => s + e.amount, 0);
    const totalSpend = sum(expIn);
    const prevSpend = sum(expPrev);

    const attended = (arr: AttendanceLog[]) => arr.filter(l => l.status === "attended").length;
    const sessions = attended(logIn);
    const prevSessions = attended(logPrev);

    const hours = (arr: AttendanceLog[]) => arr.filter(l => isAttendedLike(l.status)).reduce((s, l) => s + sessionMinutes(l), 0) / 60;
    const totalHours = hours(logIn);
    const prevHours = hours(logPrev);

    // Monthly sparkline buckets — only months that fall in a selected year (skips gap years).
    const monthBuckets = bucketsInRange(from, to, "month").filter(bk => activeYears.includes(bk.key.slice(0, 4)));
    const spendByMonth = monthBuckets.map(bk => expIn.filter(e => recordBucket(e.payment_date, "month") === bk.key).reduce((s, e) => s + e.amount, 0));
    const sessionsByMonth = monthBuckets.map(bk => logIn.filter(l => l.status === "attended" && recordBucket(l.date, "month") === bk.key).length);
    const hoursByMonth = monthBuckets.map(bk => logIn.filter(l => isAttendedLike(l.status) && recordBucket(l.date, "month") === bk.key).reduce((s, l) => s + sessionMinutes(l), 0) / 60);

    // ── Spending ──
    const childNames = (childrenData as Child[]).map(c => c.name);
    const spendTrend = monthBuckets.map(bk => {
      const row: Record<string, number | string> = { label: bk.label };
      for (const cn of childNames) {
        row[cn] = expIn.filter(e => recordBucket(e.payment_date, "month") === bk.key && (e.child?.name || childById.get(e.child_id)?.name) === cn).reduce((s, e) => s + e.amount, 0);
      }
      return row;
    });

    const byCat = new Map<string, number>();
    for (const e of expIn) { const n = e.category?.name || "Uncategorized"; byCat.set(n, (byCat.get(n) || 0) + e.amount); }
    const spendByCategory: DonutDatum[] = [...byCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: colorForCat(name, i) }));

    // Child-level views follow the children list's order (first child first), not spend size.
    const byChild = new Map<string, number>();
    for (const e of expIn) { const n = e.child?.name || childById.get(e.child_id)?.name || "Unknown"; byChild.set(n, (byChild.get(n) || 0) + e.amount); }
    const childRank = (name: string) => { const i = childNames.indexOf(name); return i === -1 ? childNames.length : i; };
    const spendByChild = [...byChild.entries()]
      .sort((x, y) => childRank(x[0]) - childRank(y[0]))
      .map(([name, value]) => ({ name, value, color: childColor(name) }));

    const spendByActivityByChild = (childrenData as Child[])
      .filter(c => selectedChildren.includes(c.id))
      .map(c => {
        const byAct = new Map<string, { id: string | null; value: number }>();
        for (const e of expIn) {
          if (e.child_id !== c.id) continue;
          const n = activityLabel(e.activity_id, e.institution);
          const cur = byAct.get(n) || { id: e.activity_id ?? null, value: 0 };
          cur.value += e.amount;
          byAct.set(n, cur);
        }
        const rows = [...byAct.entries()].sort((x, y) => y[1].value - x[1].value).map(([name, v]) => ({ name, value: v.value, id: v.id }));
        return { id: c.id, name: c.name, color: c.color_code, rows };
      })
      .filter(g => g.rows.length > 0);

    const byPayer = new Map<string, number>();
    for (const e of expIn) { const n = e.paid_by || "—"; byPayer.set(n, (byPayer.get(n) || 0) + e.amount); }
    const payerSplit: DonutDatum[] = [...byPayer.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([name, value], i) => ({ name, value, color: PAYER_PALETTE[i % PAYER_PALETTE.length] }));

    // Payer × child: how much each payer spent on each child.
    const payerChildCols = (childrenData as Child[]).filter(c => selectedChildren.includes(c.id));
    const payerByChild = {
      children: payerChildCols.map(c => ({ id: c.id, name: c.name, color: c.color_code })),
      rows: payerSplit.map(p => ({
        payer: p.name,
        amounts: payerChildCols.map(c => expIn.filter(e => (e.paid_by || "—") === p.name && e.child_id === c.id).reduce((s, e) => s + e.amount, 0)),
      })),
    };
    const payerByChildMax = Math.max(1, ...payerByChild.rows.flatMap(r => r.amounts));

    const byExpenseType = new Map<string, number>();
    for (const e of expIn) {
      const n = e.expense_type || "Lesson";
      byExpenseType.set(n, (byExpenseType.get(n) || 0) + e.amount);
    }
    const spendByExpenseType: DonutDatum[] = [...byExpenseType.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([name, value]) => ({
        name,
        value,
        color: EXPENSE_TYPE_COLORS[name as keyof typeof EXPENSE_TYPE_COLORS] || PALETTE[0],
      }));

    // ── Attendance ──
    const attByChildMap = new Map<string, { attended: number; absent: number; other: number }>();
    for (const l of logIn) {
      const n = l.child?.name || childById.get(l.child_id)?.name || "Unknown";
      const cur = attByChildMap.get(n) || { attended: 0, absent: 0, other: 0 };
      if (l.status === "attended") cur.attended++; else if (l.status === "absent") cur.absent++; else cur.other++;
      attByChildMap.set(n, cur);
    }
    const attendanceByChild = [...attByChildMap.entries()].map(([child, v]) => ({ child, ...v }));

    // Per activity, split by child: attended sessions (matches Sessions by Category) and
    // attended hours (matches Hours by Category).
    const sessionsByActivityByChild = (childrenData as Child[])
      .filter(c => selectedChildren.includes(c.id))
      .map(c => {
        const byAct = new Map<string, { id: string | null; sessions: number; hours: number }>();
        for (const l of logIn) {
          if (l.child_id !== c.id || !isAttendedLike(l.status)) continue;
          const n = l.activity?.activity_name || l.activity?.institution || activityLabel(l.activity_id);
          const cur = byAct.get(n) || { id: l.activity_id ?? null, sessions: 0, hours: 0 };
          if (l.status === "attended") cur.sessions += 1;
          cur.hours += sessionMinutes(l) / 60;
          byAct.set(n, cur);
        }
        const rows = [...byAct.entries()].map(([name, v]) => ({ name, ...v }));
        return { id: c.id, name: c.name, color: c.color_code, rows };
      })
      .filter(g => g.rows.length > 0);

    // Sessions and hours by category — for the Overview KPI donuts (independent of the
    // Hours Over Time chart's own group-by toggle, which can switch to "by activity").
    const sessByCat = new Map<string, number>();
    for (const l of logIn) { if (l.status !== "attended") continue; const g = l.activity?.category?.name || "Uncategorized"; sessByCat.set(g, (sessByCat.get(g) || 0) + 1); }
    const sessionsByCategoryKpi: DonutDatum[] = [...sessByCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: colorForCat(name, i) }));

    const hoursByCat = new Map<string, number>();
    for (const l of logIn) { if (!isAttendedLike(l.status)) continue; const g = l.activity?.category?.name || "Uncategorized"; hoursByCat.set(g, (hoursByCat.get(g) || 0) + sessionMinutes(l) / 60); }
    const hoursByCategoryKpi: DonutDatum[] = [...hoursByCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: colorForCat(name, i) }));

    // Cost per hour, by activity, per child. Price comes from the activity's latest
    // Lesson-type payment (amount ÷ lessons it covers), divided by the median length of
    // its attended sessions. Restarted stints of the same activity are combined by name.
    // Activities whose latest Lesson payment has no lesson count are left out.
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const costPerHourByChild = (childrenData as Child[])
      .filter(c => selectedChildren.includes(c.id))
      .map(c => {
        const latestLesson = new Map<string, Expense>();
        for (const e of expIn) {
          if (e.child_id !== c.id || !e.activity_id || (e.expense_type || "Lesson") !== "Lesson") continue;
          const n = activityLabel(e.activity_id, e.institution);
          const cur = latestLesson.get(n);
          if (!cur || e.payment_date > cur.payment_date) latestLesson.set(n, e);
        }
        const minutesByAct = new Map<string, number[]>();
        for (const l of logIn) {
          if (l.child_id !== c.id || !isAttendedLike(l.status)) continue;
          const m = sessionMinutes(l);
          if (m <= 0) continue;
          const n = l.activity?.activity_name || l.activity?.institution || activityLabel(l.activity_id);
          minutesByAct.set(n, [...(minutesByAct.get(n) || []), m]);
        }
        const rows = [...latestLesson.entries()].flatMap(([name, e]) => {
          const mins = minutesByAct.get(name);
          if (!e.num_lessons || e.num_lessons <= 0 || !mins?.length) return [];
          const perLesson = e.amount / e.num_lessons;
          const sessionMin = median(mins);
          return [{
            name,
            id: e.activity_id ?? null,
            value: perLesson / (sessionMin / 60),
            detail: `${formatCurrency(perLesson)} per ${Math.round(sessionMin)}-min lesson`,
          }];
        });
        return { id: c.id, name: c.name, color: c.color_code, rows };
      })
      .filter(g => g.rows.length > 0);

    // Weekly load, by day — attended hours per child landing on each day of the week.
    const heatByChild = new Map<string, number[]>();
    for (const l of logIn) {
      if (!isAttendedLike(l.status)) continue;
      const n = l.child?.name || childById.get(l.child_id)?.name || "Unknown";
      const arr = heatByChild.get(n) || [0, 0, 0, 0, 0, 0, 0];
      const dow = parseISO(l.date.slice(0, 10)).getDay();
      arr[dow] += sessionMinutes(l) / 60;
      heatByChild.set(n, arr);
    }
    const weeklyHeatmap = {
      dayNames: ["S", "M", "T", "W", "T", "F", "S"],
      rows: [...heatByChild.entries()].map(([name, hours]) => ({ name, hours, color: childColor(name) })),
      max: Math.max(1, ...[...heatByChild.values()].flat()),
    };

    return {
      from, to, activeYears,
      kpis: {
        totalSpend, spendDelta: pctDelta(totalSpend, prevSpend),
        sessions, sessionsDelta: pctDelta(sessions, prevSessions),
        totalHours, hoursDelta: pctDelta(totalHours, prevHours),
        spendByMonth, sessionsByMonth, hoursByMonth,
      },
      childNames, childColor, colorForCat,
      spendTrend, spendByCategory, spendByChild, spendByActivityByChild, payerSplit, payerByChild, payerByChildMax, spendByExpenseType, costPerHourByChild,
      attendanceByChild, sessionsByActivityByChild, weeklyHeatmap, sessionsByCategoryKpi, hoursByCategoryKpi,
      // raw for hours section (depends on its own toggles)
      logIn,
    };
  }, [expensesData, logsData, activitiesData, childrenData, filterYears, selectedChildren]);

  // ── Hours section (its own toggles) ──
  const [hoursGroup, setHoursGroup] = useState<"category" | "activity">("category");
  const [hoursGran, setHoursGran] = useState<"week" | "month">("month");
  const [hoursView, setHoursView] = useState<"stacked" | "percent">("stacked");
  const [attView, setAttView] = useState<"stacked" | "percent">("stacked");
  const [loadView, setLoadView] = useState<"total" | "scheduled">("total");
  const [actMetric, setActMetric] = useState<"sessions" | "hours">("sessions");

  const hoursViz = useMemo(() => {
    const logIn = data.logIn.filter(l => isAttendedLike(l.status));
    const groupOf = (l: AttendanceLog) =>
      hoursGroup === "category"
        ? (l.activity?.category?.name || "Uncategorized")
        : (l.activity?.activity_name || l.activity?.institution || "Unknown");

    // Order groups by total hours, descending, so the first (bottom-most, since Recharts
    // stacks bars in the order their <Bar> elements are given) is the biggest commitment.
    const totalHoursByGroup = new Map<string, number>();
    for (const l of logIn) { const g = groupOf(l); totalHoursByGroup.set(g, (totalHoursByGroup.get(g) || 0) + sessionMinutes(l) / 60); }
    const groupNames = [...totalHoursByGroup.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const buckets = bucketsInRange(data.from, data.to, hoursGran).filter(bk => data.activeYears.includes(bk.key.slice(0, 4)));
    const allBuckets = buckets.map(bk => {
      const row: Record<string, number | string> = { label: bk.label };
      for (const g of groupNames) row[g] = 0;
      for (const l of logIn) {
        if (recordBucket(l.date, hoursGran) === bk.key) {
          const g = groupOf(l);
          row[g] = (row[g] as number) + sessionMinutes(l) / 60;
        }
      }
      return row;
    });
    // The range is padded out to whole years, so start at the first bucket with
    // any hours and stop at the last — otherwise empty months frame the bars.
    const hasHours = (row: Record<string, number | string>) => groupNames.some(g => (row[g] as number) > 0);
    const firstIdx = allBuckets.findIndex(hasHours);
    const lastIdx = allBuckets.length - 1 - [...allBuckets].reverse().findIndex(hasHours);
    const overTime = firstIdx === -1 ? [] : allBuckets.slice(firstIdx, lastIdx + 1);

    // Pre-normalize to fractions-of-bucket-total rather than relying on Recharts'
    // stackOffset="expand" — that only rescales the drawn bar height, it doesn't
    // change the values Tooltip/YAxis read, so they'd still show raw hours.
    const overTimePercent = overTime.map(row => {
      const total = groupNames.reduce((s, g) => s + (row[g] as number), 0);
      const pctRow: Record<string, number | string> = { label: row.label };
      for (const g of groupNames) pctRow[g] = total > 0 ? (row[g] as number) / total : 0;
      return pctRow;
    });

    return { groupNames, overTime, overTimePercent };
  }, [data, hoursGroup, hoursGran]);

  // ── Weekly schedule load (a typical current week, independent of the date/year filter) ──
  // `is_active` stays true on every past term's row once set, so a slot's terms pile up
  // over the years unless we also keep only the one in effect today — and dedupe any
  // exact (activity, day, time) repeat so a slot counts once per typical week.
  const scheduleHeatmap = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const inEffect = (s: Schedule) =>
      (!s.effective_from || s.effective_from.slice(0, 10) <= todayStr) &&
      (!s.effective_until || s.effective_until.slice(0, 10) >= todayStr);

    const childColor = (name: string) => (childrenData as Child[]).find(c => c.name === name)?.color_code || PALETTE[0];
    const heatByChild = new Map<string, number[]>();
    const seenSlots = new Set<string>();
    for (const s of schedulesData as Schedule[]) {
      const childId = s.activity?.child_id;
      if (!childId || !selectedChildren.includes(childId) || !inEffect(s)) continue;
      const slotKey = `${s.activity_id}|${s.day_of_week}|${s.start_time}`;
      if (seenSlots.has(slotKey)) continue;
      seenSlots.add(slotKey);
      const name = s.activity?.child?.name || "Unknown";
      const arr = heatByChild.get(name) || [0, 0, 0, 0, 0, 0, 0];
      arr[s.day_of_week] += scheduleMinutes(s) / 60;
      heatByChild.set(name, arr);
    }
    return {
      dayNames: ["S", "M", "T", "W", "T", "F", "S"],
      rows: [...heatByChild.entries()].map(([name, hours]) => ({ name, hours, color: childColor(name) })),
      max: Math.max(1, ...[...heatByChild.values()].flat()),
    };
  }, [schedulesData, childrenData, selectedChildren]);

  const k = data.kpis;

  // The page shell (wrapper + Header) lives in the route; this component renders
  // the body only, behind the same skeleton the dynamic import shows.
  if (loading) {
    return (
      <div className="px-5 md:px-8 space-y-6 pb-24 md:pb-8 pt-1 md:pt-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-[var(--bg-secondary)] animate-pulse" />)}</div>
        {[1, 2].map(i => <div key={i} className="h-80 bg-[var(--bg-secondary)] animate-pulse" />)}
      </div>
    );
  }

  return (
    <>
      <div className="px-5 md:px-8 space-y-10 pb-24 md:pb-8 pt-1 md:pt-2">
        {/* Filter bar */}
        <div className="space-y-3">
          <ChildFilter
            children={childrenData as Child[]}
            selected={selectedChildren}
            onToggle={toggleChild}
          />
          <FilterBar stretch>
            <FilterField label="Year">
              <MultiSelect
                className="w-32"
                ariaLabel="Filter by year"
                selected={filterYears}
                onToggle={toggleFilterYear}
                allLabel="All Years"
                emptyLabel="All Years"
                pluralNoun="Years"
                options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
              />
            </FilterField>
          </FilterBar>
        </div>

        {/* ── Attendance ── */}
        {segment === "attendance" && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MiniDonutKpi label="Sessions by Category" data={data.sessionsByCategoryKpi} center={String(k.sessions)} formatter={(v) => String(v)} animate={animate} />
              <MiniDonutKpi label="Hours by Category" data={data.hoursByCategoryKpi} center={fmtHours(k.totalHours)} formatter={(v) => fmtHours(v)} animate={animate} />
            </div>

            <ChartCard title="Hours Over Time">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Segmented value={hoursGroup} onChange={setHoursGroup} options={[{ value: "category", label: "By category" }, { value: "activity", label: "By activity" }]} />
                <Segmented value={hoursGran} onChange={setHoursGran} options={[{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />
                <Segmented value={hoursView} onChange={setHoursView} options={[{ value: "stacked", label: "Stacked" }, { value: "percent", label: "100%" }]} />
              </div>
              {hoursViz.overTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hoursView === "percent" ? hoursViz.overTimePercent : hoursViz.overTime} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                    {hoursView === "percent" ? (
                      <YAxis {...axisProps} width={44} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    ) : (
                      <YAxis {...axisProps} width={44} tickFormatter={(v) => `${v}h`} />
                    )}
                    <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => hoursView === "percent" ? fmtPct(v * 100) : fmtHours(v)} />} />
                    {hoursViz.groupNames.map((g, i) => {
                      const isLast = i === hoursViz.groupNames.length - 1;
                      return <Bar key={g} dataKey={g} name={g} stackId="h" fill={data.colorForCat(g, i)} radius={isLast ? [6, 6, 0, 0] : [0, 0, 0, 0]} isAnimationActive={animate} animationDuration={700} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-[var(--text-muted)]">No attended sessions in this period</div>
              )}
              {hoursViz.overTime.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                  {hoursViz.groupNames.map((g, i) => (
                    <div key={g} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: data.colorForCat(g, i) }} />
                      <span className="text-[var(--text-secondary)]">{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {data.attendanceByChild.length > 0 && (() => {
              const series = [
                { key: "attended", name: "Attended", color: "#16A34A" },
                { key: "absent", name: "Absent", color: "#DC2626" },
                { key: "other", name: "Other", color: "#9ca3af" },
              ] as const;
              const rows = attView === "percent"
                ? data.attendanceByChild.map(r => {
                    const t = r.attended + r.absent + r.other;
                    return { child: r.child, attended: t ? r.attended / t : 0, absent: t ? r.absent / t : 0, other: t ? r.other / t : 0 };
                  })
                : data.attendanceByChild;
              return (
                <ChartCard
                  title="Attendance by Child"
                  action={<Segmented value={attView} onChange={setAttView} options={[{ value: "stacked", label: "Stacked" }, { value: "percent", label: "100%" }]} />}
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="child" {...axisProps} />
                      {attView === "percent" ? (
                        <YAxis {...axisProps} width={44} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                      ) : (
                        <YAxis {...axisProps} width={44} allowDecimals={false} />
                      )}
                      <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => attView === "percent" ? fmtPct(v * 100) : String(v)} />} />
                      {series.map((s, i) => (
                        <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} radius={i === series.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]} isAnimationActive={animate} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                    {series.map(s => (
                      <div key={s.key} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-[var(--text-secondary)]">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              );
            })()}

            {(data.weeklyHeatmap.rows.length > 0 || scheduleHeatmap.rows.length > 0) && (() => {
              const source = loadView === "total" ? data.weeklyHeatmap : scheduleHeatmap;
              // Rows come out in data order; show them in the children list's order instead.
              const childOrder = (childrenData as Child[]).map(c => c.name);
              const rank = (name: string) => { const i = childOrder.indexOf(name); return i === -1 ? childOrder.length : i; };
              const load = { ...source, rows: [...source.rows].sort((a, b) => rank(a.name) - rank(b.name)) };
              return (
                <ChartCard
                  title="Weekly Load, by Day"
                  action={<Segmented value={loadView} onChange={setLoadView} options={[{ value: "total", label: "Total hours" }, { value: "scheduled", label: "Scheduled" }]} />}
                >
                  {load.rows.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      {loadView === "total" ? "No attended sessions in this period." : "No classes on the current schedule."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {load.rows.map(row => (
                        <div key={row.name} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-xs text-[var(--text-secondary)]">{row.name}</span>
                          <div className="flex-1 grid grid-cols-7 gap-1">
                            {row.hours.map((h, i) => (
                              <div
                                key={i}
                                title={`${load.dayNames[i]} · ${fmtHours(h)}`}
                                className="h-8 rounded-sm flex items-center justify-center text-[10px] tabular-nums"
                                style={{ backgroundColor: row.color, opacity: h > 0 ? Math.max(0.15, h / load.max) : 0.06 }}
                              >
                                {h > 0 ? h.toFixed(1) : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pl-16">
                        <div className="flex-1 grid grid-cols-7 gap-1">
                          {load.dayNames.map((d, i) => (
                            <span key={i} className="text-center text-[10px] text-[var(--text-muted)]">{d}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </ChartCard>
              );
            })()}

            {data.sessionsByActivityByChild.length > 0 && (
              <ChartCard
                title={actMetric === "sessions" ? "Sessions by Activity" : "Hours by Activity"}
                action={<Segmented value={actMetric} onChange={setActMetric} options={[{ value: "sessions", label: "Sessions" }, { value: "hours", label: "Hours" }]} />}
              >
                <ActivityBarGroups
                  groups={data.sessionsByActivityByChild.map(g => ({
                    ...g,
                    rows: g.rows.map(r => ({ name: r.name, id: r.id, value: actMetric === "sessions" ? r.sessions : r.hours })),
                  }))}
                  format={v => (actMetric === "sessions" ? String(v) : fmtHours(v))}
                  onSelect={goToActivity}
                />
              </ChartCard>
            )}

            <div className="space-y-4">
              <FerryBreakdown logs={data.logIn} children={(childrenData as Child[]).filter(c => selectedChildren.includes(c.id))} />
            </div>

            <div className="space-y-4">
              <EngagementTimeline activities={activitiesData} children={(childrenData as Child[]).filter(c => selectedChildren.includes(c.id))} />
            </div>
          </section>
        )}

        {/* ── Spending ── */}
        {segment === "spending" && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.spendByCategory.length > 0 && (
                <MiniDonutKpi label="Spending by Category" data={data.spendByCategory} center={fmtMoneyShort(k.totalSpend)} formatter={(v) => formatCurrency(v)} animate={animate} />
              )}
              {data.spendByExpenseType.length > 0 && (
                <MiniDonutKpi label="Spending by Type" data={data.spendByExpenseType} center={fmtMoneyShort(k.totalSpend)} formatter={(v) => formatCurrency(v)} animate={animate} />
              )}
              {data.payerSplit.length > 0 && (
                <MiniDonutKpi label="Who Paid" data={data.payerSplit} center={fmtMoneyShort(k.totalSpend)} formatter={(v) => formatCurrency(v)} animate={animate} />
              )}
            </div>

            {data.spendTrend.length > 0 && (
              <ChartCard title="Monthly Spend Trend">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.spendTrend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...axisProps} width={52} tickFormatter={(v) => fmtMoneyShort(v)} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    {data.childNames.map(cn => (
                      <Line key={cn} type="linear" dataKey={cn} name={cn} stroke={data.childColor(cn)} strokeWidth={2} dot={{ r: 2.5, fill: data.childColor(cn), strokeWidth: 0 }} activeDot={{ r: 3.5 }} isAnimationActive={animate} animationDuration={700} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                  {data.childNames.map(cn => (
                    <div key={cn} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: data.childColor(cn) }} />
                      <span className="text-[var(--text-secondary)]">{cn}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            )}

            {data.costPerHourByChild.length > 0 && (
              <ChartCard title="Cost per Hour, by Activity">
                <ActivityBarGroups groups={data.costPerHourByChild} format={v => `${formatCurrency(v)}/hr`} onSelect={goToActivity} />
              </ChartCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.payerByChild.rows.length > 0 && data.payerByChild.children.length > 0 && (
                <ChartCard title="Who Paid for Whom">
                  <div
                    className="grid gap-1 text-xs"
                    style={{ gridTemplateColumns: `minmax(5rem, 8rem) repeat(${data.payerByChild.children.length}, minmax(0, 1fr))` }}
                  >
                    <div />
                    {data.payerByChild.children.map(c => (
                      <div key={c.id} className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate">
                        <span className="w-2 h-2 shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </div>
                    ))}
                    {data.payerByChild.rows.map(row => (
                      <Fragment key={row.payer}>
                        <div className="h-9 flex items-center pr-1 text-xs text-[var(--text-secondary)]">
                          <span className="truncate" title={row.payer}>{row.payer}</span>
                        </div>
                        {row.amounts.map((amt, i) => {
                          const c = data.payerByChild.children[i];
                          const alpha = amt === 0 ? 0 : 0.15 + (amt / data.payerByChildMax) * 0.75;
                          return (
                            <div
                              key={c.id}
                              title={`${row.payer} → ${c.name}: ${formatCurrency(amt)}`}
                              className="h-9 rounded-[4px] flex items-center justify-center text-[11px] tabular-nums"
                              style={{
                                backgroundColor: amt === 0 ? "var(--bg-secondary)" : `color-mix(in srgb, ${c.color} ${Math.round(alpha * 100)}%, transparent)`,
                                color: alpha > 0.55 ? "#fff" : "var(--text-primary)",
                              }}
                            >
                              {amt > 0 ? formatCurrency(amt) : ""}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </ChartCard>
              )}
              {data.spendByChild.length > 0 && (
                <ChartCard title="Spend by Child">
                  {/* Plain bars scaled to the biggest spender, so it spans the full width —
                      Recharts' axis rounds up to the next tick and leaves a gap on the right. */}
                  <div className="space-y-2">
                    {(() => {
                      const max = Math.max(...data.spendByChild.map(d => d.value));
                      return data.spendByChild.map(d => (
                        <div key={d.name} title={`${d.name} · ${formatCurrency(d.value)}`} className="relative flex items-center h-9 rounded-[4px] bg-[var(--bg-secondary)] overflow-hidden">
                          <span
                            className="absolute inset-y-0 left-0 rounded-[4px]"
                            style={{ width: `${max > 0 ? (d.value / max) * 100 : 0}%`, backgroundColor: `color-mix(in srgb, ${d.color} 35%, transparent)` }}
                          />
                          <span className="relative flex-1 min-w-0 px-2.5 text-sm text-[var(--text-primary)] truncate">{d.name}</span>
                          <span className="relative shrink-0 pr-2.5 text-sm font-semibold tabular-nums text-[var(--text-primary)]">{formatCurrency(d.value)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </ChartCard>
              )}
            </div>

            {data.spendByActivityByChild.length > 0 && (
              <ChartCard title="Top Activities by Spend">
                <ActivityBarGroups groups={data.spendByActivityByChild} format={fmtMoneyShort} onSelect={goToActivity} />
              </ChartCard>
            )}
          </section>
        )}
      </div>
    </>
  );
}
