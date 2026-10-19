"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Receipt, CalendarCheck, ListChecks, Clock, TrendingUp, TrendingDown } from "lucide-react";
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
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS, EXPENSE_TYPE_COLORS } from "@/lib/constants";
import { MultiSelect } from "@/components/ui/FilterDropdown";
import { useExpenses, useAttendanceLogs, useActivities, useChildren, useSchedules } from "@/lib/api-hooks";
import { EngagementTimeline } from "@/components/analytics/EngagementTimeline";
import { FerryBreakdown } from "@/components/analytics/FerryBreakdown";
import type { Expense, AttendanceLog, Activity, Child, Schedule } from "@/lib/types";
import type { AnalyticsSegment } from "@/components/views/AnalyticsView";

const DISPLAY_FONT = "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif";
const PALETTE = ["#2f6f4e", "#1a2c22", "#b45309", "#b42318", "#3d6b7a", "#6b5344", "#4a6741", "#8b5a2b", "#5c7a6a", "#3d4a40"];

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

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-[var(--rule)] bg-[var(--sheet)] p-5 md:p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
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

function DeltaPill({ delta, suffix = "%" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <span className="text-[11px] text-[var(--text-muted)]">— no prior data</span>;
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${up ? "text-[var(--stem)]" : "text-[var(--margin)]"}`}>
      <Icon size={12} />
      {up ? "+" : ""}{Math.round(delta)}{suffix}
    </span>
  );
}

function KpiCard({ label, value, delta, deltaSuffix = "%", spark, color, icon, animate }: {
  label: string; value: string; delta: number | null; deltaSuffix?: string;
  spark: number[]; color: string; icon: React.ReactNode; animate: boolean;
}) {
  const sparkData = spark.map((v, i) => ({ i, v }));
  const id = `spark-${label.replace(/\s+/g, "")}`;
  const hasSpark = spark.some(v => v > 0);
  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[var(--ink-faint)]">{label}</span>
        <span className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${color}1a`, color }}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{value}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <DeltaPill delta={delta} suffix={deltaSuffix} />
        {hasSpark && (
          <div className="w-14 sm:w-20 h-7 sm:h-8 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={animate} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
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

function Donut({ data, center, sub, formatter, animate }: { data: DonutDatum[]; center: string; sub: string; formatter: (v: number) => string; animate: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none" cornerRadius={6} isAnimationActive={animate} animationDuration={700}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<DonutTooltip formatter={formatter} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{center}</span>
          <span className="text-[11px] text-[var(--ink-faint)]">{sub}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[var(--text-secondary)] truncate">{d.name}</span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)] shrink-0">{formatter(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A KPI tile that shows a category breakdown as a mini donut instead of a single number + sparkline.
function MiniDonutKpi({ label, data, center, formatter, animate }: { label: string; data: DonutDatum[]; center: string; formatter: (v: number) => string; animate: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] p-4 md:p-5">
      <span className="text-sm text-[var(--ink-faint)]">{label}</span>
      <div className="mt-2 flex items-center justify-center gap-3">
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
    const rate = (arr: AttendanceLog[]) => (arr.length ? (attended(arr) / arr.length) * 100 : 0);
    const attRate = rate(logIn);
    const prevRate = rate(logPrev);

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
    const rateByMonth = monthBuckets.map(bk => {
      const m = logIn.filter(l => recordBucket(l.date, "month") === bk.key);
      return m.length ? (m.filter(l => l.status === "attended").length / m.length) * 100 : 0;
    });

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

    const byChild = new Map<string, number>();
    for (const e of expIn) { const n = e.child?.name || childById.get(e.child_id)?.name || "Unknown"; byChild.set(n, (byChild.get(n) || 0) + e.amount); }
    const spendByChild = [...byChild.entries()].map(([name, value]) => ({ name, value, color: childColor(name) }));

    const byAct = new Map<string, { id: string | null; value: number }>();
    for (const e of expIn) {
      const n = activityLabel(e.activity_id, e.institution);
      const cur = byAct.get(n) || { id: e.activity_id ?? null, value: 0 };
      cur.value += e.amount;
      byAct.set(n, cur);
    }
    const topActivitiesSpend = [...byAct.entries()].sort((x, y) => y[1].value - x[1].value).slice(0, 8).map(([name, v]) => ({ name, value: v.value, id: v.id }));

    const byPayer = new Map<string, number>();
    for (const e of expIn) { const n = e.paid_by || "—"; byPayer.set(n, (byPayer.get(n) || 0) + e.amount); }
    const payerSplit: DonutDatum[] = [...byPayer.entries()].map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));

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
    const statusCounts = new Map<string, number>();
    for (const l of logIn) statusCounts.set(l.status, (statusCounts.get(l.status) || 0) + 1);
    const statusMix: DonutDatum[] = [...statusCounts.entries()].sort((x, y) => y[1] - x[1]).map(([s, value]) => ({ name: ATTENDANCE_STATUS_LABELS[s] || s, value, color: ATTENDANCE_STATUS_COLORS[s] || "#9ca3af" }));

    const attByChildMap = new Map<string, { attended: number; absent: number; other: number }>();
    for (const l of logIn) {
      const n = l.child?.name || childById.get(l.child_id)?.name || "Unknown";
      const cur = attByChildMap.get(n) || { attended: 0, absent: 0, other: 0 };
      if (l.status === "attended") cur.attended++; else if (l.status === "absent") cur.absent++; else cur.other++;
      attByChildMap.set(n, cur);
    }
    const attendanceByChild = [...attByChildMap.entries()].map(([child, v]) => ({ child, ...v }));

    const reasonMap = new Map<string, number>();
    for (const l of logIn) if (l.status === "absent") { const n = l.absence_reason || "Unspecified"; reasonMap.set(n, (reasonMap.get(n) || 0) + 1); }
    const absenceReasons = [...reasonMap.entries()].sort((x, y) => y[1] - x[1]).map(([name, value]) => ({ name, value }));

    const sessByActMap = new Map<string, { id: string | null; value: number }>();
    for (const l of logIn) {
      const n = l.activity?.activity_name || l.activity?.institution || activityLabel(l.activity_id);
      const cur = sessByActMap.get(n) || { id: l.activity_id ?? null, value: 0 };
      cur.value += 1;
      sessByActMap.set(n, cur);
    }
    const sessionsByActivity = [...sessByActMap.entries()].sort((x, y) => y[1].value - x[1].value).slice(0, 8).map(([name, v]) => ({ name, value: v.value, id: v.id }));

    // Sessions and hours by category — for the Overview KPI donuts (independent of the
    // Hours Over Time chart's own group-by toggle, which can switch to "by activity").
    const sessByCat = new Map<string, number>();
    for (const l of logIn) { if (l.status !== "attended") continue; const g = l.activity?.category?.name || "Uncategorized"; sessByCat.set(g, (sessByCat.get(g) || 0) + 1); }
    const sessionsByCategoryKpi: DonutDatum[] = [...sessByCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: colorForCat(name, i) }));

    const hoursByCat = new Map<string, number>();
    for (const l of logIn) { if (!isAttendedLike(l.status)) continue; const g = l.activity?.category?.name || "Uncategorized"; hoursByCat.set(g, (hoursByCat.get(g) || 0) + sessionMinutes(l) / 60); }
    const hoursByCategoryKpi: DonutDatum[] = [...hoursByCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: colorForCat(name, i) }));

    // Cost per hour, by activity — total spend over total attended hours for the same activity.
    const spendByActId = new Map<string, number>();
    const labelByActId = new Map<string, string>();
    for (const e of expIn) {
      if (!e.activity_id) continue;
      spendByActId.set(e.activity_id, (spendByActId.get(e.activity_id) || 0) + e.amount);
      if (!labelByActId.has(e.activity_id)) labelByActId.set(e.activity_id, activityLabel(e.activity_id, e.institution));
    }
    const hoursByActId = new Map<string, number>();
    for (const l of logIn) {
      if (!isAttendedLike(l.status) || !l.activity_id) continue;
      hoursByActId.set(l.activity_id, (hoursByActId.get(l.activity_id) || 0) + sessionMinutes(l) / 60);
      if (!labelByActId.has(l.activity_id)) labelByActId.set(l.activity_id, l.activity?.activity_name || l.activity?.institution || activityLabel(l.activity_id));
    }
    const costPerHourByActivity = [...labelByActId.entries()]
      .map(([id, name]) => {
        const spend = spendByActId.get(id) || 0;
        const hrs = hoursByActId.get(id) || 0;
        return hrs > 0 && spend > 0 ? { id, name, value: spend / hrs } : null;
      })
      .filter((x): x is { id: string; name: string; value: number } => x !== null)
      .sort((x, y) => x.value - y.value)
      .slice(0, 8);

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
        attRate, rateDelta: prevRate === 0 && attRate === 0 ? null : attRate - prevRate,
        sessions, sessionsDelta: pctDelta(sessions, prevSessions),
        totalHours, hoursDelta: pctDelta(totalHours, prevHours),
        spendByMonth, sessionsByMonth, hoursByMonth, rateByMonth,
      },
      childNames, childColor, colorForCat,
      spendTrend, spendByCategory, spendByChild, topActivitiesSpend, payerSplit, spendByExpenseType, costPerHourByActivity,
      statusMix, attendanceByChild, absenceReasons, sessionsByActivity, weeklyHeatmap, sessionsByCategoryKpi, hoursByCategoryKpi,
      // raw for hours section (depends on its own toggles)
      logIn,
    };
  }, [expensesData, logsData, activitiesData, childrenData, filterYears, selectedChildren]);

  // ── Hours section (its own toggles) ──
  const [hoursGroup, setHoursGroup] = useState<"category" | "activity">("category");
  const [hoursGran, setHoursGran] = useState<"week" | "month">("month");
  const [hoursView, setHoursView] = useState<"stacked" | "percent">("stacked");

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
    const overTime = buckets.map(bk => {
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard label="Attendance rate" value={fmtPct(k.attRate)} delta={k.rateDelta} deltaSuffix="pp" spark={k.rateByMonth} color="#1a2c22" icon={<CalendarCheck size={16} />} animate={animate} />
              <MiniDonutKpi label="Sessions by Category" data={data.sessionsByCategoryKpi} center={String(k.sessions)} formatter={(v) => String(v)} animate={animate} />
              <MiniDonutKpi label="Hours by Category" data={data.hoursByCategoryKpi} center={fmtHours(k.totalHours)} formatter={(v) => fmtHours(v)} animate={animate} />
            </div>

            <div className="space-y-4">
              <ChartCard title="Hours Over Time">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Segmented value={hoursGroup} onChange={setHoursGroup} options={[{ value: "category", label: "By category" }, { value: "activity", label: "By activity" }]} />
                  <Segmented value={hoursGran} onChange={setHoursGran} options={[{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />
                  <Segmented value={hoursView} onChange={setHoursView} options={[{ value: "stacked", label: "Stacked" }, { value: "percent", label: "100%" }]} />
                </div>
                {hoursViz.groupNames.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hoursView === "percent" ? hoursViz.overTimePercent : hoursViz.overTime} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                      <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                      <YAxis {...axisProps} width={36} tickFormatter={(v) => hoursView === "percent" ? `${Math.round(v * 100)}%` : `${v}h`} />
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
                {hoursViz.groupNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {hoursViz.groupNames.map((g, i) => (
                      <div key={g} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: data.colorForCat(g, i) }} />
                        <span className="text-[var(--text-secondary)]">{g}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.statusMix.length > 0 && (
                <ChartCard title="Status Mix">
                  <Donut data={data.statusMix} center={String(data.statusMix.reduce((s, d) => s + d.value, 0))} sub="logs" formatter={(v) => String(v)} animate={animate} />
                </ChartCard>
              )}
              {data.attendanceByChild.length > 0 && (
                <ChartCard title="Attendance by Child">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.attendanceByChild} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                      <XAxis dataKey="child" {...axisProps} />
                      <YAxis {...axisProps} width={32} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip />} />
                      <Bar dataKey="attended" name="Attended" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} isAnimationActive={animate} />
                      <Bar dataKey="absent" name="Absent" stackId="a" fill="#DC2626" isAnimationActive={animate} />
                      <Bar dataKey="other" name="Other" stackId="a" fill="#9ca3af" radius={[8, 8, 0, 0]} isAnimationActive={animate} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>

            {data.weeklyHeatmap.rows.length > 0 && (
              <ChartCard title="Weekly Load, by Day">
                <div className="space-y-2">
                  {data.weeklyHeatmap.rows.map(row => (
                    <div key={row.name} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-[var(--text-secondary)]">{row.name}</span>
                      <div className="flex-1 grid grid-cols-7 gap-1">
                        {row.hours.map((h, i) => (
                          <div
                            key={i}
                            title={`${data.weeklyHeatmap.dayNames[i]} · ${fmtHours(h)}`}
                            className="h-8 rounded-sm flex items-center justify-center text-[10px] tabular-nums"
                            style={{ backgroundColor: row.color, opacity: h > 0 ? Math.max(0.15, h / data.weeklyHeatmap.max) : 0.06 }}
                          >
                            {h > 0 ? h.toFixed(1) : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pl-16">
                    <div className="flex-1 grid grid-cols-7 gap-1">
                      {data.weeklyHeatmap.dayNames.map((d, i) => (
                        <span key={i} className="text-center text-[10px] text-[var(--text-muted)]">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </ChartCard>
            )}

            {scheduleHeatmap.rows.length > 0 && (
              <ChartCard title="Weekly Schedule Load, by Day">
                <div className="space-y-2">
                  {scheduleHeatmap.rows.map(row => (
                    <div key={row.name} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-[var(--text-secondary)]">{row.name}</span>
                      <div className="flex-1 grid grid-cols-7 gap-1">
                        {row.hours.map((h, i) => (
                          <div
                            key={i}
                            title={`${scheduleHeatmap.dayNames[i]} · ${fmtHours(h)}`}
                            className="h-8 rounded-sm flex items-center justify-center text-[10px] tabular-nums"
                            style={{ backgroundColor: row.color, opacity: h > 0 ? Math.max(0.15, h / scheduleHeatmap.max) : 0.06 }}
                          >
                            {h > 0 ? h.toFixed(1) : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pl-16">
                    <div className="flex-1 grid grid-cols-7 gap-1">
                      {scheduleHeatmap.dayNames.map((d, i) => (
                        <span key={i} className="text-center text-[10px] text-[var(--text-muted)]">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </ChartCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.sessionsByActivity.length > 0 && (
                <ChartCard title="Sessions by Activity">
                  <ResponsiveContainer width="100%" height={Math.max(160, data.sessionsByActivity.length * 36)}>
                    <BarChart data={data.sessionsByActivity} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" {...axisProps} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" {...axisProps} width={130} />
                      <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Sessions" radius={[0, 8, 8, 0]} fill="#10b981" isAnimationActive={animate} animationDuration={700} onClick={(d: any) => goToActivity(d?.id)} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {data.absenceReasons.length > 0 ? (
                <ChartCard title="Absence Reasons">
                  <ResponsiveContainer width="100%" height={Math.max(160, data.absenceReasons.length * 36)}>
                    <BarChart data={data.absenceReasons} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" {...axisProps} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" {...axisProps} width={110} />
                      <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Absences" radius={[0, 8, 8, 0]} fill="#DC2626" isAnimationActive={animate} animationDuration={700} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              ) : (
                <ChartCard title="Absence Reasons">
                  <div className="h-[160px] flex items-center justify-center text-sm text-[var(--text-muted)]">No absences in this period 🎉</div>
                </ChartCard>
              )}
            </div>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total spend" value={formatCurrency(k.totalSpend)} delta={k.spendDelta} spark={k.spendByMonth} color="#2f6f4e" icon={<Receipt size={16} />} animate={animate} />
            </div>

            {data.spendTrend.length > 0 && (
              <ChartCard title="Monthly Spend Trend">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.spendTrend} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      {data.childNames.map((cn, ci) => (
                        <linearGradient key={cn} id={`gc-${ci}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={data.childColor(cn)} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={data.childColor(cn)} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} width={48} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    {data.childNames.map((cn, ci) => (
                      <Area key={cn} type="monotone" dataKey={cn} name={cn} stackId="1" stroke={data.childColor(cn)} strokeWidth={2} fill={`url(#gc-${ci})`} isAnimationActive={animate} animationDuration={700} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {data.costPerHourByActivity.length > 0 && (
              <ChartCard title="Cost per Hour, by Activity">
                <ResponsiveContainer width="100%" height={Math.max(160, data.costPerHourByActivity.length * 36)}>
                  <BarChart data={data.costPerHourByActivity} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={130} />
                    <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => `${formatCurrency(v)}/hr`} />} />
                    <Bar dataKey="value" name="$/hr" radius={[0, 8, 8, 0]} fill="#2f6f4e" isAnimationActive={animate} animationDuration={700} onClick={(d: any) => goToActivity(d?.id)} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {data.spendByExpenseType.length > 0 && (
                <ChartCard title="Spend by Type">
                  <Donut data={data.spendByExpenseType} center={formatCurrency(data.spendByExpenseType.reduce((s, d) => s + d.value, 0))} sub="total" formatter={(v) => formatCurrency(v)} animate={animate} />
                </ChartCard>
              )}
              {data.spendByCategory.length > 0 && (
                <ChartCard title="Spend by Category">
                  <Donut data={data.spendByCategory} center={formatCurrency(data.spendByCategory.reduce((s, d) => s + d.value, 0))} sub="total" formatter={(v) => formatCurrency(v)} animate={animate} />
                </ChartCard>
              )}
              {data.payerSplit.length > 0 && (
                <ChartCard title="Who Paid">
                  <Donut data={data.payerSplit} center={formatCurrency(data.payerSplit.reduce((s, d) => s + d.value, 0))} sub="total" formatter={(v) => formatCurrency(v)} animate={animate} />
                </ChartCard>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.spendByChild.length > 0 && (
                <ChartCard title="Spend by Child">
                  <ResponsiveContainer width="100%" height={Math.max(140, data.spendByChild.length * 60)}>
                    <BarChart data={data.spendByChild} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" {...axisProps} width={70} />
                      <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                      <Bar dataKey="value" name="Spend" radius={[0, 8, 8, 0]} isAnimationActive={animate} animationDuration={700}>
                        {data.spendByChild.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {data.topActivitiesSpend.length > 0 && (
                <ChartCard title="Top Activities by Spend">
                  <ResponsiveContainer width="100%" height={Math.max(160, data.topActivitiesSpend.length * 36)}>
                    <BarChart data={data.topActivitiesSpend} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" {...axisProps} width={130} />
                      <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                      <Bar dataKey="value" name="Spend" radius={[0, 0, 0, 0]} fill="#2f6f4e" isAnimationActive={animate} animationDuration={700} onClick={(d: any) => goToActivity(d?.id)} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
