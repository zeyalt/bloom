"use client";

import { format, parseISO } from "date-fns";
import type { Goal } from "@/lib/types";
import { day, daysBetween, round1, type MeasuredProgress } from "@/lib/goal-progress";

const INK = "#1a2c22", PLAN = "#9cc3ab", TREND = "#4a5c52", TARGET = "#2f6f4e", GRID = "#e1e8e0", MUTED = "#4a5c52";

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map(f => f * mag).find(f => f >= raw) ?? 10 * mag;
}

/**
 * Readings over time with the planned path (first reading → target on the target date),
 * the trend projected to the target date, the target line and a today marker.
 */
export function GoalChart({ goal, progress, today }: { goal: Goal; progress: MeasuredProgress; today: string }) {
  const { readings, first, latest, projected } = progress;
  if (!first || !latest || readings.length < 2 || goal.target_value === null) return null;
  const target = goal.target_value;
  const targetDay = day(goal.target_date);
  const end = [targetDay, latest.date].sort().pop()!;

  const W = 340, H = 210, L = 38, R = 330, T = 18, B = 182;
  const values = [...readings.map(r => r.value), target, ...(projected !== null ? [projected] : [])];
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || 1;
  lo -= pad; hi += pad;
  const span = Math.max(1, daysBetween(first.date, end));
  const X = (iso: string) => L + (daysBetween(first.date, iso) / span) * (R - L);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (B - T);

  const step = niceStep((hi - lo) / 4);
  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(round1(v));
  const mid = new Date((Date.parse(first.date) + Date.parse(end)) / 2).toISOString().slice(0, 10);
  const xTicks = [first.date, mid, end];

  const path = readings.map((r, i) => `${i ? "L" : "M"}${X(r.date).toFixed(1)} ${Y(r.value).toFixed(1)}`).join(" ");
  const planPath = `M${X(first.date)} ${Y(first.value)} L${X(targetDay)} ${Y(target)}`;
  const trendPath = projected !== null && latest.date < targetDay
    ? `M${X(latest.date)} ${Y(latest.value)} L${X(targetDay)} ${Y(projected)}` : null;
  const showToday = today > first.date && today < end;
  const unit = goal.unit ?? "";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`${goal.title}: ${readings.length} readings from ${first.value} to ${latest.value} ${unit}, target ${target} ${unit} by ${format(parseISO(targetDay), "d MMM yyyy")}`}>
        {yTicks.map(v => (
          <g key={v}>
            <line x1={L} x2={R} y1={Y(v)} y2={Y(v)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={Y(v) + 3} textAnchor="end" fontSize={10} fill={MUTED}>{v}</text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text key={d + i} x={Math.min(R - 16, Math.max(L + 16, X(d)))} y={H - 8} textAnchor="middle" fontSize={10} fill={MUTED}>
            {format(parseISO(d), "MMM ''yy")}
          </text>
        ))}
        <line x1={L} x2={R} y1={Y(target)} y2={Y(target)} stroke={TARGET} strokeWidth={1.5} strokeDasharray="5 4" />
        {showToday && (
          <g>
            <line x1={X(today)} x2={X(today)} y1={T - 6} y2={B} stroke="#9aa9a0" strokeWidth={1} strokeDasharray="1 3" />
            <text x={X(today)} y={T - 8} textAnchor="middle" fontSize={9} fill={MUTED}>today</text>
          </g>
        )}
        <path d={planPath} fill="none" stroke={PLAN} strokeWidth={2.5} strokeLinecap="round" />
        {trendPath && <path d={trendPath} fill="none" stroke={TREND} strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" />}
        <path d={path} fill="none" stroke={INK} strokeWidth={2.25} strokeLinejoin="round" />
        {readings.map(r => <circle key={r.id} cx={X(r.date)} cy={Y(r.value)} r={3.5} fill={INK} />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-[var(--ink-soft)]">
        <Legend stroke={INK} width={2.25} label="Readings" />
        <Legend stroke={PLAN} width={2.5} label="Planned path" />
        <Legend stroke={TREND} width={1.5} dash="2 3" label="Trend" />
        <Legend stroke={TARGET} width={1.5} dash="4 3" label="Target" />
      </div>
    </div>
  );
}

function Legend({ stroke, width, dash, label }: { stroke: string; width: number; dash?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="8" aria-hidden="true"><line x1="0" x2="18" y1="4" y2="4" stroke={stroke} strokeWidth={width} strokeDasharray={dash} /></svg>
      {label}
    </span>
  );
}

/** Small readings line for a goal card: readings, planned path and target. */
export function GoalSparkline({ goal, progress }: { goal: Goal; progress: MeasuredProgress }) {
  const { readings, first } = progress;
  if (!first || goal.target_value === null) return null;
  const target = goal.target_value, targetDay = day(goal.target_date);
  const end = [targetDay, readings[readings.length - 1].date].sort().pop()!;
  const W = 300, H = 40;
  const vals = [...readings.map(r => r.value), target];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(1, daysBetween(first.date, end));
  const X = (iso: string) => 3 + (daysBetween(first.date, iso) / span) * (W - 6);
  const Y = (v: number) => 4 + (1 - (v - lo) / ((hi - lo) || 1)) * (H - 8);
  const last = readings[readings.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
      <line x1={0} x2={W} y1={Y(target)} y2={Y(target)} stroke={TARGET} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={`M${X(first.date)} ${Y(first.value)} L${X(targetDay)} ${Y(target)}`} fill="none" stroke={PLAN} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <path d={readings.map((r, i) => `${i ? "L" : "M"}${X(r.date)} ${Y(r.value)}`).join(" ")} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={X(last.date)} cy={Y(last.value)} r={3} fill={INK} />
    </svg>
  );
}
