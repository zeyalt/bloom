"use client";

import { useEffect, useMemo, useState } from "react";
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
  subMonths,
  differenceInCalendarMonths,
  isWithinInterval,
} from "date-fns";
import { Header } from "@/components/layout/Header";
import { formatCurrency, getCurrentYear } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useExpenses, useAttendanceLogs, useActivities, useChildren } from "@/lib/api-hooks";
import type { Expense, AttendanceLog, Activity, Child } from "@/lib/types";

const DISPLAY_FONT = "var(--font-display)";
const PALETTE = ["#0066cc", "#10b981", "#f59e0b", "#ef4444", "#8B5CF6", "#F97316", "#EC4899", "#14B8A6", "#6366F1", "#D946EF"];

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
    <div className={`rounded-2xl border border-[var(--border)]/70 bg-[var(--bg-card)] p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
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
    <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 shadow-lg">
      {label != null && <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.payload?.fill }} />
          <span className="text-[var(--text-secondary)]">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DeltaPill({ delta, suffix = "%" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <span className="text-[11px] text-[var(--text-muted)]">— no prior data</span>;
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
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
    <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--bg-card)] p-4 md:p-5 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
        <span className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${color}1a`, color }}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{value}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <DeltaPill delta={delta} suffix={deltaSuffix} />
        {hasSpark && (
          <div className="w-20 h-8 shrink-0">
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
    <div className="inline-flex p-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]/70">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${value === o.value ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface DonutDatum { name: string; value: number; color: string }

function Donut({ data, center, sub, formatter, animate }: { data: DonutDatum[]; center: string; sub: string; formatter: (v: number) => string; animate: boolean }) {
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={2} stroke="none" cornerRadius={6} isAnimationActive={animate} animationDuration={700}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={formatter} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold tabular-nums text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{center}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{sub}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[var(--text-secondary)]">{d.name}</span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">{formatter(d.value)}</span>
          </div>
        ))}
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

export default function AnalyticsPage() {
  const { data: expensesData = [], isLoading: le } = useExpenses({ limit: 500 });
  const { data: logsData = [], isLoading: ll } = useAttendanceLogs({ limit: 500 });
  const { data: activitiesData = [] } = useActivities();
  const { data: childrenData = [] } = useChildren();
  const loading = le || ll;

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAnimate(!reduce);
  }, []);

  // Month-range filter (yyyy-MM); default Jan this year → current month.
  const thisYear = getCurrentYear();
  const nowMonth = format(new Date(), "yyyy-MM");
  const [fromMonth, setFromMonth] = useState(`${thisYear}-01`);
  const [toMonth, setToMonth] = useState(nowMonth);

  const data = useMemo(() => {
    // Effective range (guard from > to by swapping).
    const a = startOfMonth(parseISO(`${fromMonth}-01`));
    const b = endOfMonth(parseISO(`${toMonth}-01`));
    const from = a <= b ? a : startOfMonth(parseISO(`${toMonth}-01`));
    const to = a <= b ? b : endOfMonth(parseISO(`${fromMonth}-01`));
    const months = differenceInCalendarMonths(to, from) + 1;
    const prevTo = endOfMonth(subMonths(from, 1));
    const prevFrom = startOfMonth(subMonths(from, months));

    const inRange = (d: string, lo: Date, hi: Date) => isWithinInterval(parseISO(d.slice(0, 10)), { start: lo, end: hi });

    const expIn = (expensesData as Expense[]).filter(e => inRange(e.payment_date, from, to));
    const expPrev = (expensesData as Expense[]).filter(e => inRange(e.payment_date, prevFrom, prevTo));
    const logIn = (logsData as AttendanceLog[]).filter(l => inRange(l.date, from, to));
    const logPrev = (logsData as AttendanceLog[]).filter(l => inRange(l.date, prevFrom, prevTo));

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

    // Monthly sparkline buckets
    const monthBuckets = bucketsInRange(from, to, "month");
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

    const byAct = new Map<string, number>();
    for (const e of expIn) { const n = activityLabel(e.activity_id, e.institution); byAct.set(n, (byAct.get(n) || 0) + e.amount); }
    const topActivitiesSpend = [...byAct.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    const byPayer = new Map<string, number>();
    for (const e of expIn) { const n = e.paid_by || "—"; byPayer.set(n, (byPayer.get(n) || 0) + e.amount); }
    const payerSplit: DonutDatum[] = [...byPayer.entries()].map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));

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

    const sessByActMap = new Map<string, number>();
    for (const l of logIn) { const n = l.activity?.activity_name || l.activity?.institution || activityLabel(l.activity_id); sessByActMap.set(n, (sessByActMap.get(n) || 0) + 1); }
    const sessionsByActivity = [...sessByActMap.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    return {
      from, to,
      kpis: {
        totalSpend, spendDelta: pctDelta(totalSpend, prevSpend),
        attRate, rateDelta: prevRate === 0 && attRate === 0 ? null : attRate - prevRate,
        sessions, sessionsDelta: pctDelta(sessions, prevSessions),
        totalHours, hoursDelta: pctDelta(totalHours, prevHours),
        spendByMonth, sessionsByMonth, hoursByMonth, rateByMonth,
      },
      childNames, childColor, colorForCat,
      spendTrend, spendByCategory, spendByChild, topActivitiesSpend, payerSplit,
      statusMix, attendanceByChild, absenceReasons, sessionsByActivity,
      // raw for hours section (depends on its own toggles)
      logIn,
    };
  }, [expensesData, logsData, activitiesData, childrenData, fromMonth, toMonth]);

  // ── Hours section (its own toggles) ──
  const [hoursGroup, setHoursGroup] = useState<"category" | "activity">("category");
  const [hoursGran, setHoursGran] = useState<"week" | "month">("month");

  const hoursViz = useMemo(() => {
    const logIn = data.logIn.filter(l => isAttendedLike(l.status));
    const groupOf = (l: AttendanceLog) =>
      hoursGroup === "category"
        ? (l.activity?.category?.name || "Uncategorized")
        : (l.activity?.activity_name || l.activity?.institution || "Unknown");

    const groupNames = [...new Set(logIn.map(groupOf))];
    const buckets = bucketsInRange(data.from, data.to, hoursGran);
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

    const byCat = new Map<string, number>();
    for (const l of logIn) { const g = l.activity?.category?.name || "Uncategorized"; byCat.set(g, (byCat.get(g) || 0) + sessionMinutes(l) / 60); }
    const hoursByCategory: DonutDatum[] = [...byCat.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({ name, value, color: data.colorForCat(name, i) }));

    const byChild = new Map<string, number>();
    for (const l of logIn) { const n = l.child?.name || "Unknown"; byChild.set(n, (byChild.get(n) || 0) + sessionMinutes(l) / 60); }
    const hoursByChild = [...byChild.entries()].map(([name, value]) => ({ name, value, color: data.childColor(name) }));

    return { groupNames, overTime, hoursByCategory, hoursByChild };
  }, [data, hoursGroup, hoursGran]);

  const k = data.kpis;

  const inputCls = "px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all";
  const sectionHead = (title: string, sub: string) => (
    <div className="flex items-baseline gap-3 mb-1">
      <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>{title}</h2>
      <span className="text-xs text-[var(--text-muted)]">{sub}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto w-full">
        <Header title="Analytics" subtitle="Spend, attendance & time insights" />
        <div className="px-5 md:px-8 space-y-6 pb-8 pt-4 md:pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-[var(--bg-secondary)] rounded-2xl animate-pulse" />)}</div>
          {[1, 2].map(i => <div key={i} className="h-80 bg-[var(--bg-secondary)] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Analytics" subtitle="Spend, attendance & time insights" />

      <div className="px-5 md:px-8 space-y-10 pb-8 pt-4 md:pt-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">From</label>
            <input type="month" value={fromMonth} max={toMonth} onChange={e => setFromMonth(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">To</label>
            <input type="month" value={toMonth} min={fromMonth} max={nowMonth} onChange={e => setToMonth(e.target.value)} className={inputCls} />
          </div>
          <p className="text-xs text-[var(--text-muted)] pb-2.5 ml-auto">
            {format(data.from, "MMM yyyy")} – {format(data.to, "MMM yyyy")}
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total spend" value={formatCurrency(k.totalSpend)} delta={k.spendDelta} spark={k.spendByMonth} color="#0066cc" icon={<Receipt size={16} />} animate={animate} />
          <KpiCard label="Attendance rate" value={fmtPct(k.attRate)} delta={k.rateDelta} deltaSuffix="pp" spark={k.rateByMonth} color="#10b981" icon={<CalendarCheck size={16} />} animate={animate} />
          <KpiCard label="Sessions attended" value={String(k.sessions)} delta={k.sessionsDelta} spark={k.sessionsByMonth} color="#f59e0b" icon={<ListChecks size={16} />} animate={animate} />
          <KpiCard label="Hours attended" value={fmtHours(k.totalHours)} delta={k.hoursDelta} spark={k.hoursByMonth} color="#8B5CF6" icon={<Clock size={16} />} animate={animate} />
        </div>

        {/* ── Section 1: Spending ── */}
        <section className="space-y-4">
          {sectionHead("Spending", "Where the money goes")}

          {data.spendTrend.length > 0 && (
            <ChartCard title="Monthly Spend Trend" subtitle="By child">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <Bar dataKey="value" name="Spend" radius={[0, 8, 8, 0]} fill="#0066cc" isAnimationActive={animate} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </section>

        {/* ── Section 2: Attendance ── */}
        <section className="space-y-4">
          {sectionHead("Attendance & Commitment", "Are they showing up")}

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.sessionsByActivity.length > 0 && (
              <ChartCard title="Sessions by Activity">
                <ResponsiveContainer width="100%" height={Math.max(160, data.sessionsByActivity.length * 36)}>
                  <BarChart data={data.sessionsByActivity} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={130} />
                    <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Sessions" radius={[0, 8, 8, 0]} fill="#10b981" isAnimationActive={animate} animationDuration={700} />
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
        </section>

        {/* ── Section 3: Hours over time ── */}
        <section className="space-y-4">
          {sectionHead("Time Commitment", "Hours spent over time")}

          <ChartCard title="Hours Over Time" subtitle={`Grouped by ${hoursGroup}`}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Segmented value={hoursGroup} onChange={setHoursGroup} options={[{ value: "category", label: "By category" }, { value: "activity", label: "By activity" }]} />
              <Segmented value={hoursGran} onChange={setHoursGran} options={[{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />
            </div>
            {hoursViz.groupNames.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursViz.overTime} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis {...axisProps} width={36} tickFormatter={(v) => `${v}h`} />
                  <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => fmtHours(v)} />} />
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
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.colorForCat(g, i) }} />
                    <span className="text-[var(--text-secondary)]">{g}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hoursViz.hoursByCategory.length > 0 && (
              <ChartCard title="Hours by Category">
                <Donut data={hoursViz.hoursByCategory} center={fmtHours(hoursViz.hoursByCategory.reduce((s, d) => s + d.value, 0))} sub="total" formatter={(v) => fmtHours(v)} animate={animate} />
              </ChartCard>
            )}
            {hoursViz.hoursByChild.length > 0 && (
              <ChartCard title="Hours by Child">
                <ResponsiveContainer width="100%" height={Math.max(140, hoursViz.hoursByChild.length * 60)}>
                  <BarChart data={hoursViz.hoursByChild} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v}h`} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={70} />
                    <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={<ChartTooltip formatter={(v: number) => fmtHours(v)} />} />
                    <Bar dataKey="value" name="Hours" radius={[0, 8, 8, 0]} isAnimationActive={animate} animationDuration={700}>
                      {hoursViz.hoursByChild.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
