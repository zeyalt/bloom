"use client";

import { Copy, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { SchoolHours } from "@/lib/types";
import type { SchoolDayInput } from "@/lib/my-day-api";

export interface DayHours {
  on: boolean;
  start: string;
  end: string;
  /** After-school activity: shown = the fields are open; what it is and when it ends. */
  after: { shown: boolean; label: string; until: string };
}
export type WeekHours = Record<number, DayHours>;

const fieldCls = "w-full min-w-0 px-2 py-2 text-base md:text-sm border border-[var(--rule)] rounded-lg bg-white focus:outline-none focus:border-[var(--stem)] disabled:bg-[var(--bg-secondary)] disabled:text-[var(--ink-faint)]";
const captionCls = "text-xs leading-4 font-medium text-[var(--ink-soft)]";

const noAfter = { shown: false, label: "", until: "" };

/** A child's saved hours as form state; with nothing saved, Monday to Friday are on, times blank. */
export function weekFromRows(childId: string, rows: SchoolHours[]): WeekHours {
  const mine = rows.filter(r => r.child_id === childId);
  const week: WeekHours = {};
  for (let d = 0; d < 7; d++) {
    const r = mine.find(x => x.day_of_week === d);
    week[d] = r
      ? {
          on: r.is_school_day, start: r.start_time ?? "", end: r.end_time ?? "",
          after: r.after_school ? { shown: true, label: r.after_school, until: r.after_school_until ?? "" } : noAfter,
        }
      : { on: mine.length === 0 && d >= 1 && d <= 5, start: "", end: "", after: noAfter };
  }
  return week;
}

export function weekToInput(week: WeekHours): SchoolDayInput[] {
  return Object.entries(week).map(([d, h]) => {
    const activity = h.on && h.after.shown && h.after.label.trim() ? h.after.label.trim() : null;
    return {
      day_of_week: Number(d),
      is_school_day: h.on,
      start_time: h.on && h.start ? h.start : null,
      end_time: h.on && h.end ? h.end : null,
      after_school: activity,
      after_school_until: activity && h.after.until ? h.after.until : null,
    };
  });
}

/** Returns an error message for the first day whose times don't make sense, else null. */
export function weekError(week: WeekHours): string | null {
  for (const { value, fullLabel } of DAYS_OF_WEEK) {
    const h = week[value];
    if (!h.on) continue;
    if (h.start && h.end && h.end <= h.start) return `${fullLabel}: school must end after it starts.`;
    if (h.after.shown && h.after.label.trim() && h.end && h.after.until && h.after.until <= h.end)
      return `${fullLabel}: the after-school activity must end after school does.`;
  }
  return null;
}

/**
 * One row per weekday: is there school, when it starts and ends, and an optional
 * after-school activity (e.g. CCA) with its end time — My Day counts "home from school"
 * from that later time. Times are optional; without them My Day still knows it's a school
 * day, it just can't show when they get home.
 */
export function SchoolHoursEditor({ value, onChange }: { value: WeekHours; onChange: (next: WeekHours) => void }) {
  const set = (d: number, patch: Partial<DayHours>) => onChange({ ...value, [d]: { ...value[d], ...patch } });
  const setAfter = (d: number, patch: Partial<DayHours["after"]>) => set(d, { after: { ...value[d].after, ...patch } });
  const monday = value[1];
  const otherSchoolDays = [2, 3, 4, 5].filter(d => value[d].on);

  function copyMonday() {
    const next = { ...value };
    for (const d of otherSchoolDays) next[d] = { ...next[d], start: monday.start, end: monday.end };
    onChange(next);
  }

  return (
    <div>
      <p className="mb-2 text-sm leading-5 text-[var(--ink-soft)]">
        When school starts and ends each weekday. Add an after-school activity, like CCA, on days they get home later.
      </p>

      {/* Column captions, lined up with the time boxes below. */}
      <div className="grid grid-cols-[40px_minmax(0,1fr)] sm:grid-cols-[40px_112px_minmax(0,1fr)] gap-2 pb-1 border-b border-[var(--rule)]">
        <span className="hidden sm:block sm:col-start-2" />
        <div className="col-start-2 sm:col-start-3 grid grid-cols-2 gap-2">
          <span className={captionCls}>School starts</span>
          <span className={captionCls}>School ends</span>
        </div>
      </div>

      <ul className="divide-y divide-[var(--rule)] border-b border-[var(--rule)]">
        {DAYS_OF_WEEK.map(({ value: d, label, fullLabel }) => {
          const h = value[d];
          return (
            <li key={d} className="py-2">
              {/* Phone: day + switch, then the two times on their own line. Wider: one line. */}
              <div className="grid grid-cols-[40px_minmax(0,1fr)] sm:grid-cols-[40px_112px_minmax(0,1fr)] items-center gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
                <button
                  type="button"
                  aria-pressed={h.on}
                  aria-label={`${fullLabel}: ${h.on ? "school day" : "no school"}`}
                  onClick={() => set(d, { on: !h.on })}
                  className={cn(
                    "justify-self-start sm:justify-self-stretch h-10 px-3 text-sm font-medium rounded-lg border cursor-pointer",
                    h.on ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)]" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)]"
                  )}
                >
                  {h.on ? "School" : "No school"}
                </button>
                <div className={cn("col-start-2 sm:col-start-3 grid grid-cols-2 gap-2", !h.on && "hidden sm:grid")}>
                  <input type="time" aria-label={`${fullLabel}: school starts`} value={h.start} disabled={!h.on}
                    onChange={e => set(d, { start: e.target.value })} className={fieldCls} />
                  <input type="time" aria-label={`${fullLabel}: school ends`} value={h.end} disabled={!h.on}
                    onChange={e => set(d, { end: e.target.value })} className={fieldCls} />
                </div>

                {h.on && (h.after.shown ? (
                  // Phone: the activity's name on its own line (with ×), "Until" below. Wider: one line.
                  <div className="col-start-2 sm:col-end-4 grid grid-cols-[minmax(0,1fr)_48px] sm:grid-cols-[minmax(0,1fr)_8rem_48px] items-end gap-x-2 gap-y-2">
                    <label className="min-w-0">
                      <span className={captionCls}>After school</span>
                      <input type="text" value={h.after.label} onChange={e => setAfter(d, { label: e.target.value })}
                        placeholder="e.g. CCA – Badminton" className={cn(fieldCls, "mt-1")} />
                    </label>
                    <IconButton icon={X} label={`Remove ${fullLabel}’s after-school activity`} onClick={() => set(d, { after: noAfter })}
                      className="sm:col-start-3 sm:row-start-1" />
                    <label className="min-w-0 w-36 sm:w-auto sm:col-start-2 sm:row-start-1">
                      <span className={captionCls}>Until</span>
                      <input type="time" value={h.after.until} onChange={e => setAfter(d, { until: e.target.value })}
                        className={cn(fieldCls, "mt-1")} />
                    </label>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAfter(d, { shown: true })}
                    className="col-start-2 sm:col-end-4 justify-self-start inline-flex items-center gap-1 h-10 -ml-1 px-1 text-sm font-medium text-[var(--stem)] hover:underline cursor-pointer">
                    <Plus size={16} aria-hidden="true" /> After-school activity
                  </button>
                ))}
              </div>

              {/* Right under Monday, where its times were just typed. */}
              {d === 1 && h.on && h.start && h.end && otherSchoolDays.length > 0 && (
                <div className="mt-2 ml-12">
                  <Button size="sm" variant="secondary" onClick={copyMonday}>
                    <Copy size={16} aria-hidden="true" /> Copy to other school days
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
