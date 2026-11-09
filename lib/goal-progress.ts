// Pure progress maths for goals — shared by the Goals list, goal detail and Home.
// Every date here is a "YYYY-MM-DD" string (DATE columns arrive as ISO timestamps; take the day).
import { format } from "date-fns";
import type { Goal, GoalCheckpoint, GoalEntry } from "./types";

const DAY_MS = 86_400_000;

/** The parent's local calendar day. */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export const day = (s: string) => s.slice(0, 10);
const t = (iso: string) => Date.parse(`${day(iso)}T00:00:00Z`);
export const daysBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY_MS);
export const addDays = (iso: string, n: number) => new Date(t(iso) + n * DAY_MS).toISOString().slice(0, 10);
export const round1 = (v: number) => Math.round(v * 10) / 10;

export type Tone = "good" | "warn" | "neutral";
export interface GoalStatus { label: string; tone: Tone }

export function timeLeftLabel(today: string, target: string): string {
  const n = daysBetween(today, target);
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} overdue`;
  if (n === 0) return "Due today";
  if (n < 45) return `${n} days left`;
  const m = Math.round(n / 30.4);
  return `${m} month${m === 1 ? "" : "s"} left`;
}

/** "3 weeks early", "5 days late", "right on time". */
export function earlyLateLabel(achieved: string, target: string): string {
  const n = daysBetween(achieved, target);
  if (n === 0) return "right on time";
  const abs = Math.abs(n), w = Math.round(abs / 7);
  const span = w >= 1 ? `${w} week${w === 1 ? "" : "s"}` : `${abs} day${abs === 1 ? "" : "s"}`;
  return `${span} ${n > 0 ? "early" : "late"}`;
}

// ---------------------------------------------------------------- milestone

export type CheckpointState = "hit" | "missed" | "next" | "upcoming";

export interface MilestoneProgress {
  checkpoints: (GoalCheckpoint & { state: CheckpointState })[];
  hitCount: number;
  next: GoalCheckpoint | null;
  missedCount: number;
  notes: GoalEntry[];
}

export function milestoneProgress(goal: Goal, today: string): MilestoneProgress {
  const sorted = [...goal.checkpoints].sort((a, b) => a.sort_order - b.sort_order || day(a.due_date).localeCompare(day(b.due_date)));
  const nextIdx = sorted.findIndex(c => !c.hit_date && day(c.due_date) >= today);
  const checkpoints = sorted.map((c, i) => ({
    ...c,
    state: (c.hit_date ? "hit" : day(c.due_date) < today ? "missed" : i === nextIdx ? "next" : "upcoming") as CheckpointState,
  }));
  return {
    checkpoints,
    hitCount: checkpoints.filter(c => c.state === "hit").length,
    missedCount: checkpoints.filter(c => c.state === "missed").length,
    next: nextIdx >= 0 ? sorted[nextIdx] : null,
    notes: goal.entries.filter(e => e.note),
  };
}

// ---------------------------------------------------------------- measured

export interface MeasuredProgress {
  readings: { date: string; value: number; id: string }[];
  first: { date: string; value: number } | null;
  latest: { date: string; value: number } | null;
  /** Distance still to go toward the target (≤ 0 once reached). */
  remaining: number | null;
  reached: boolean;
  /** Least-squares trend, per day; null with fewer than 2 readings. */
  slopePerDay: number | null;
  /** Trend value on the target date. */
  projected: number | null;
  reachesOnTrend: boolean | null;
  /** Value on the straight line from the first reading to the target on the target date. */
  planAt: (iso: string) => number | null;
  /** Latest reading minus the planned path at that date, signed so + means ahead. */
  aheadOfPlan: number | null;
  increasing: boolean;
}

export function measuredProgress(goal: Goal): MeasuredProgress {
  const readings = goal.entries
    .filter((e): e is GoalEntry & { value: number } => e.value !== null)
    .map(e => ({ id: e.id, date: day(e.date), value: e.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = readings[0] ?? null, latest = readings[readings.length - 1] ?? null;
  const target = goal.target_value ?? 0;
  const increasing = first ? target >= first.value : true;
  const sign = increasing ? 1 : -1;
  const remaining = latest ? (target - latest.value) * sign : null;
  const targetDay = day(goal.target_date);

  const planAt = (iso: string) => {
    if (!first) return null;
    const span = Math.max(1, daysBetween(first.date, targetDay));
    return first.value + (target - first.value) * (daysBetween(first.date, iso) / span);
  };

  let slopePerDay: number | null = null, projected: number | null = null, reachesOnTrend: boolean | null = null;
  if (readings.length >= 2 && first && latest) {
    const xs = readings.map(r => daysBetween(first.date, r.date)), ys = readings.map(r => r.value);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
    slopePerDay = den ? num / den : 0;
    projected = latest.value + slopePerDay * Math.max(0, daysBetween(latest.date, targetDay));
    reachesOnTrend = (projected - target) * sign >= 0;
  }
  const planned = latest ? planAt(latest.date) : null;
  return {
    readings, first, latest, remaining, reached: remaining !== null && remaining <= 0,
    slopePerDay, projected, reachesOnTrend, planAt, increasing,
    aheadOfPlan: latest && planned !== null && readings.length >= 2 ? (latest.value - planned) * sign : null,
  };
}

// ---------------------------------------------------------------- both

/** Achieved date: set by hand for milestones, the first reading at/over the target for measured goals. */
export function achievedDate(goal: Goal): string | null {
  if (goal.kind === "milestone") return goal.achieved_date ? day(goal.achieved_date) : null;
  if (goal.target_value === null) return null;
  const m = measuredProgress(goal);
  if (!m.first) return null;
  const hit = m.readings.find(r => (goal.target_value! - r.value) * (m.increasing ? 1 : -1) <= 0);
  return hit ? hit.date : null;
}

export function goalStatus(goal: Goal, today: string): GoalStatus {
  if (achievedDate(goal)) return { label: "Achieved", tone: "good" };
  const overdue = day(goal.target_date) < today;
  if (goal.kind === "milestone") {
    if (overdue) return { label: "Overdue", tone: "warn" };
    const p = milestoneProgress(goal, today);
    if (!p.checkpoints.length) return { label: "No plan yet", tone: "neutral" };
    return p.missedCount ? { label: "Behind plan", tone: "warn" } : { label: "On plan", tone: "good" };
  }
  const m = measuredProgress(goal);
  if (overdue) return { label: "Overdue", tone: "warn" };
  if (m.reachesOnTrend === null) return { label: "Needs 2 readings", tone: "neutral" };
  return m.reachesOnTrend ? { label: "On track", tone: "good" } : { label: "Behind trend", tone: "warn" };
}

export const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-[#d9eadc] text-[#1f5a3c]",
  warn: "bg-[#f6e3cc] text-[#8a3f06]",
  neutral: "bg-[var(--bg-secondary)] text-[var(--ink-soft)]",
};

/** Share of the time from goal creation to target date already gone, 0–100. */
export function timeUsedPct(goal: Goal, today: string): number {
  const start = day(goal.created_at), end = day(goal.target_date);
  const span = Math.max(1, daysBetween(start, end));
  return Math.min(100, Math.max(0, Math.round((daysBetween(start, today) / span) * 100)));
}

/** Format a reading: up to one decimal place, plus unit. */
export function fmtValue(v: number, unit: string | null): string {
  return `${round1(v)}${unit ? ` ${unit}` : ""}`;
}
