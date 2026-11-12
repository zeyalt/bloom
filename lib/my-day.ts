/*
 * My Day: what a child's day looks like and what they should do, worked out from data
 * Bloom already has. Pure functions, no fetching, so the tablet screen, the parent's
 * Home card and the tests all agree.
 *
 *   dayInfo()  — is it a school day, a half day or a holiday (and why)?
 *   buildDay() — the timetable and the task list, with ticks applied.
 *
 * Dates are "YYYY-MM-DD" strings in the family's own time zone, like the rest of Bloom.
 */
import type {
  Activity, CalendarDay, Child, Goal, RoutineDayType, RoutineItem, RoutineTier,
  Schedule, SchoolHours, TaskTick,
} from "./types";

// ─── Levels ──────────────────────────────────────────────────────────────────

/** Levels in order, so "moves up each January" can step through them. */
export const SCHOOL_LEVELS = [
  "N1", "N2", "K1", "K2",
  "P1", "P2", "P3", "P4", "P5", "P6",
  "S1", "S2", "S3", "S4", "S5",
] as const;

const LEVEL_NAMES: Record<string, string> = {
  N: "Nursery", K: "Kindergarten", P: "Primary", S: "Secondary",
};

/** "P2" → "Primary 2"; anything unrecognised is shown as typed. */
export function levelName(code: string | null | undefined): string {
  if (!code) return "";
  const m = /^([NKPS])(\d)$/.exec(code);
  return m ? `${LEVEL_NAMES[m[1]]} ${m[2]}` : code;
}

/** The child's level in `year`, stepping up a level per year since it was set (if auto). */
export function levelFor(
  child: Pick<Child, "school_level" | "school_level_year" | "auto_promote">,
  year: number
): string | null {
  const code = child.school_level;
  if (!code) return null;
  if (!child.auto_promote || !child.school_level_year) return code;
  const at = SCHOOL_LEVELS.indexOf(code as (typeof SCHOOL_LEVELS)[number]);
  if (at < 0) return code;
  const steps = Math.max(0, year - child.school_level_year);
  return SCHOOL_LEVELS[Math.min(SCHOOL_LEVELS.length - 1, at + steps)];
}

// ─── Dates and times ─────────────────────────────────────────────────────────

/** Weekday of a "YYYY-MM-DD" date, 0 = Sunday — independent of the device's time zone. */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

const day = (value: string) => value.slice(0, 10);
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// ─── What kind of day ────────────────────────────────────────────────────────

export type DayKind = "school" | "half_day" | "holiday";

export interface DayInfo {
  kind: DayKind;
  /** Short reason, for the parent and the tablet: "Christmas Day", "Weekend", "School day". */
  reason: string;
  /** Today's school hours; null on holidays or when no times were entered. */
  school: { start: string | null; end: string | null; afterSchool: string | null } | null;
  /** The level the child is at on this date (after any January promotion). */
  level: string | null;
}

type ChildForDay = Pick<Child, "id" | "calendar_id" | "school_level" | "school_level_year" | "auto_promote">;

/** No hours entered yet: assume school Monday to Friday, without times. */
function hoursFor(childId: string, weekday: number, hours: SchoolHours[]) {
  const mine = hours.filter(h => h.child_id === childId);
  if (mine.length === 0) {
    const weekdayOn = weekday >= 1 && weekday <= 5;
    return { is_school_day: weekdayOn, start_time: null, end_time: null, after_school: null };
  }
  return mine.find(h => h.day_of_week === weekday) ?? { is_school_day: false, start_time: null, end_time: null, after_school: null };
}

/**
 * The rules, in order:
 *   1. a public holiday → holiday
 *   2. a school holiday or a no-school day on the child's calendar → holiday
 *   3. a weekday the child has no school (weekends, by default) → holiday
 *   4. outside every term on a calendar that has terms for that year → holiday
 *   5. a half day → half day, finishing at its own time
 *   6. otherwise → a school day
 * Calendar days with calendar_id = null apply to every child; `levels` limits a day to
 * certain levels (e.g. P2–P6 starting a day after P1).
 */
export function dayInfo(child: ChildForDay, iso: string, calendarDays: CalendarDay[], hours: SchoolHours[]): DayInfo {
  const weekday = weekdayOf(iso);
  const level = levelFor(child, Number(iso.slice(0, 4)));

  const mine = calendarDays.filter(d =>
    (d.calendar_id === null || d.calendar_id === child.calendar_id) &&
    (!d.levels || (level !== null && d.levels.split(",").map(s => s.trim()).includes(level)))
  );
  const today = mine.filter(d => day(d.start_date) <= iso && iso <= day(d.end_date));
  const holiday = (reason: string): DayInfo => ({ kind: "holiday", reason, school: null, level });

  const publicHoliday = today.find(d => d.kind === "public_holiday");
  if (publicHoliday) return holiday(publicHoliday.title);

  const offDay = today.find(d => d.kind === "school_holiday" || d.kind === "no_school");
  if (offDay) return holiday(offDay.title);

  const h = hoursFor(child.id, weekday, hours);
  if (!h.is_school_day) return holiday(weekday === 0 || weekday === 6 ? "Weekend" : "No school today");

  const year = iso.slice(0, 4);
  const terms = mine.filter(d => d.kind === "term" && d.calendar_id !== null);
  const termsThisYear = terms.filter(d => day(d.start_date).startsWith(year));
  if (termsThisYear.length > 0 && !today.some(d => d.kind === "term")) return holiday("Between terms");

  const school = { start: h.start_time, end: h.end_time, afterSchool: h.after_school };
  const halfDay = today.find(d => d.kind === "half_day");
  if (halfDay) return { kind: "half_day", reason: halfDay.title, school: { ...school, end: halfDay.ends_at ?? school.end }, level };

  return { kind: "school", reason: "School day", school, level };
}

// ─── The day itself ──────────────────────────────────────────────────────────

export interface TimelineBlock {
  time: string;          // "HH:MM"
  end?: string | null;
  label: string;
  sub?: string | null;
  kind: "school" | "home" | "class" | "anchor";
}

export interface DayTask {
  key: string;           // what a tick is stored under
  title: string;
  tier: Exclude<RoutineTier, "anchor">;
  /** Where it came from, for the little tag: a weekly routine, a class's prep, a goal. */
  source: { kind: "routine" | "prep" | "goal"; label: string | null };
  doneAt: string | null; // ISO timestamp of the tick
}

export interface BuiltDay {
  info: DayInfo;
  routineType: Exclude<RoutineDayType, "any">;
  timeline: TimelineBlock[];
  must: DayTask[];
  practice: DayTask[];
  free: DayTask[];
  /** The first class after school (or of the day, on holidays): must-dos are due before it. */
  deadline: { label: string; time: string } | null;
  now: DayTask | null;
  next: DayTask | null;
  done: number;
  total: number;
  freeUnlocked: boolean;
}

type ScheduleWithActivity = Schedule & { activity?: Activity };

export interface BuildDayInput {
  child: ChildForDay;
  iso: string;
  calendarDays: CalendarDay[];
  hours: SchoolHours[];
  routine: RoutineItem[];
  schedules: ScheduleWithActivity[];
  goals: Goal[];
  ticks: TaskTick[];
}

export const activityLabel = (a: Pick<Activity, "activity_name" | "institution">) =>
  a.activity_name || a.institution || "Class";

/** Does a weekly class happen for this child on this date? Same rules as Home. */
function classesOn(iso: string, childId: string, schedules: ScheduleWithActivity[]) {
  const weekday = weekdayOf(iso);
  return schedules
    .filter(s => {
      const a = s.activity;
      if (!s.is_active || !a || a.child_id !== childId) return false;
      if (s.day_of_week !== weekday) return false;
      if (s.effective_from && iso < day(s.effective_from)) return false;
      if (s.effective_until && iso > day(s.effective_until)) return false;
      if (a.start_date && iso < day(a.start_date)) return false;
      if (a.end_date && iso > day(a.end_date)) return false;
      return true;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function buildDay(input: BuildDayInput): BuiltDay {
  const { child, iso, routine, goals, ticks } = input;
  const info = dayInfo(child, iso, input.calendarDays, input.hours);
  const routineType = info.kind === "holiday" ? "holiday" : "school";
  const weekday = weekdayOf(iso);
  const tickAt = new Map(
    ticks.filter(t => t.child_id === child.id && day(t.date) === iso).map(t => [t.item_key, t.done_at])
  );

  // Routine lines for this kind of day and weekday, in the parent's order.
  const lines = routine
    .filter(r => r.child_id === child.id)
    .filter(r => r.day_type === "any" || r.day_type === routineType)
    .filter(r => r.weekdays.length === 0 || r.weekdays.includes(weekday))
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  const task = (key: string, title: string, tier: DayTask["tier"], source: DayTask["source"]): DayTask =>
    ({ key, title, tier, source, doneAt: tickAt.get(key) ?? null });
  const fromRoutine = (tier: DayTask["tier"]) =>
    lines.filter(r => r.tier === tier).map(r => task(`routine:${r.id}`, r.title, tier, { kind: "routine", label: null }));

  const classes = classesOn(iso, child.id, input.schedules);
  const prep = classes
    .filter((s, i, all) => s.activity?.prep_task && all.findIndex(o => o.activity_id === s.activity_id) === i)
    .map(s => task(`prep:${s.activity_id}`, s.activity!.prep_task!, "must", { kind: "prep", label: `${activityLabel(s.activity!)} today` }));

  const practiceFromGoals = goals
    .filter(g => g.child_id === child.id && !g.achieved_date && g.practice_task)
    .filter(g => !g.practice_days || g.practice_days === "any" || g.practice_days === routineType)
    .map(g => task(`goal:${g.id}`, g.practice_task!, "practice", { kind: "goal", label: `Goal: ${g.title}` }));

  const must = [...fromRoutine("must"), ...prep];
  const practice = [...fromRoutine("practice"), ...practiceFromGoals];
  const free = fromRoutine("free");

  // Timetable: school, home time, classes and fixed times, in time order.
  const timeline: TimelineBlock[] = [];
  const s = info.school;
  if (s?.start) timeline.push({ time: s.start, end: s.end, label: "School", sub: info.kind === "half_day" ? info.reason : null, kind: "school" });
  if (s?.end) timeline.push({ time: s.end, label: "Home from school", sub: s.afterSchool, kind: "home" });
  for (const c of classes) {
    timeline.push({
      time: c.start_time, end: c.end_time, label: activityLabel(c.activity!),
      sub: c.location || c.activity!.institution || null, kind: "class",
    });
  }
  for (const r of lines.filter(l => l.tier === "anchor" && l.at_time)) {
    timeline.push({ time: r.at_time!, label: r.title, kind: "anchor" });
  }
  timeline.sort((a, b) => a.time.localeCompare(b.time));

  const afterSchool = s?.end ? toMinutes(s.end) : 0;
  const due = classes.find(c => toMinutes(c.start_time) >= afterSchool);
  const deadline = due ? { label: activityLabel(due.activity!), time: due.start_time } : null;

  const open = [...must, ...practice].filter(t => !t.doneAt);
  const total = must.length + practice.length;
  return {
    info, routineType, timeline, must, practice, free, deadline,
    now: open[0] ?? null,
    next: open[1] ?? null,
    done: total - open.length,
    total,
    freeUnlocked: must.every(t => t.doneAt),
  };
}
