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
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  Activity, AttendanceLog, CalendarDay, Child, Goal, OneOffTask, PlannedTask, RoutineDayType, RoutineItem, RoutineTier,
  Schedule, SchoolHours, TaskTick, TickedBy,
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
  /**
   * Today's school hours; null on holidays. `after` is an after-school activity (e.g. CCA)
   * and `homeAt` when they're actually home: the activity's end, else school's end.
   */
  school: {
    start: string | null;
    end: string | null;
    after: { label: string; until: string | null } | null;
    homeAt: string | null;
  } | null;
  /** The level the child is at on this date (after any January promotion). */
  level: string | null;
}

type ChildForDay = Pick<Child, "id" | "calendar_id" | "school_level" | "school_level_year" | "auto_promote">;

/** No hours entered yet: assume school Monday to Friday, without times. */
function hoursFor(childId: string, weekday: number, hours: SchoolHours[]) {
  const mine = hours.filter(h => h.child_id === childId);
  if (mine.length === 0) {
    const weekdayOn = weekday >= 1 && weekday <= 5;
    return { is_school_day: weekdayOn, start_time: null, end_time: null, after_school: null, after_school_until: null };
  }
  return mine.find(h => h.day_of_week === weekday) ?? { is_school_day: false, start_time: null, end_time: null, after_school: null, after_school_until: null };
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

  const after = h.after_school ? { label: h.after_school, until: h.after_school_until } : null;
  // With an activity but no end time, when they get home isn't known.
  const homeAt = (end: string | null) => (after ? after.until : end);
  const school = { start: h.start_time, end: h.end_time, after, homeAt: homeAt(h.end_time) };
  const halfDay = today.find(d => d.kind === "half_day");
  if (halfDay) {
    // A half day sends everyone home early; after-school activities don't run.
    const end = halfDay.ends_at ?? school.end;
    return { kind: "half_day", reason: halfDay.title, school: { start: school.start, end, after: null, homeAt: end }, level };
  }

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
  tier: Exclude<RoutineTier, "anchor"> | "homework";
  /** Where it came from, for the little tag: a weekly routine, a class's prep, a goal, homework. */
  source: { kind: "routine" | "prep" | "goal" | "homework" | "oneoff"; label: string | null };
  doneAt: string | null; // ISO timestamp of the tick
  /** Who ticked it: the child on the tablet, or a parent on Home. */
  doneBy?: TickedBy;
  /** Homework only: the lesson it's from (the date its tick is stored under), when it's due. */
  homework?: { lesson: string; due: string; overdue: boolean; note: string | null };
}

export interface BuiltDay {
  info: DayInfo;
  routineType: Exclude<RoutineDayType, "any">;
  timeline: TimelineBlock[];
  must: DayTask[];        // Do first: routine, homework due within 3 days, class prep
  practice: DayTask[];    // Hobby
  free: DayTask[];        // Free Play
  /** Homework due later than 3 days: shown, can be started, doesn't block Free Play. */
  homeworkLater: DayTask[];
  /** The first class after school (or of the day, on holidays): must-dos are due before it. */
  deadline: { label: string; time: string } | null;
  now: DayTask | null;
  next: DayTask | null;
  done: number;
  total: number;
  freeUnlocked: boolean;
  /** The day's list without homework, as saved in a DayPlan (only what the routine asked for). */
  plan: PlannedTask[];
}

type ScheduleWithActivity = Schedule & { activity?: Activity };

export interface BuildDayInput {
  child: ChildForDay;
  iso: string;
  /** The time now ("HH:MM"), when building today: lets today's finished lessons give homework. */
  now?: string | null;
  calendarDays: CalendarDay[];
  hours: SchoolHours[];
  routine: RoutineItem[];
  schedules: ScheduleWithActivity[];
  goals: Goal[];
  /** Ticks for today, plus homework ticks for the lessons still in range (they're dated by lesson). */
  ticks: TaskTick[];
  /** To leave out homework from lessons logged as absent or cancelled. */
  attendance?: Pick<AttendanceLog, "activity_id" | "child_id" | "date" | "status">[];
  /** The list saved for this day: used instead of today's routine, so a past day shows what it was. */
  plan?: PlannedTask[] | null;
  /** Include open homework (default true). Homework is about what's due now, so only today has it. */
  homework?: boolean;
  /** One-off tasks added for a single date (any children, any dates: only this child's on `iso` count). */
  oneOffs?: OneOffTask[];
}

/** Homework due within this many days (or overdue) is a Do-first job. */
export const HOMEWORK_SOON_DAYS = 3;
/** How far back homework is looked for — older open homework is dropped, not nagged about forever. */
export const HOMEWORK_LOOKBACK_DAYS = 42;
const NO_HOMEWORK: AttendanceLog["status"][] = ["absent", "cancelled_by_provider"];

export const activityLabel = (a: Pick<Activity, "activity_name" | "institution">) =>
  a.activity_name || a.institution || "Class";

/** Does this weekly slot happen on this date? Same rules as Home. */
function slotOn(s: ScheduleWithActivity, iso: string): boolean {
  const a = s.activity;
  if (!s.is_active || !a) return false;
  if (s.day_of_week !== weekdayOf(iso)) return false;
  if (s.effective_from && iso < day(s.effective_from)) return false;
  if (s.effective_until && iso > day(s.effective_until)) return false;
  if (a.start_date && iso < day(a.start_date)) return false;
  if (a.end_date && iso > day(a.end_date)) return false;
  return true;
}

function classesOn(iso: string, childId: string, schedules: ScheduleWithActivity[]) {
  return schedules
    .filter(s => s.activity?.child_id === childId && slotOn(s, iso))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

const isoOf = (d: Date) => format(d, "yyyy-MM-dd");
const shift = (iso: string, days: number) => isoOf(addDays(parseISO(iso), days));
/** The family's own calendar date of a timestamp (ticks are stored as instants). */
const localDayOf = (timestamp: string) => isoOf(new Date(timestamp));

/**
 * Open homework for a child on `iso`: one piece per lesson of each class that gives
 * homework, from the day it was switched on (and at most HOMEWORK_LOOKBACK_DAYS back).
 * A lesson logged absent or cancelled gives none; today's lesson counts once it's over.
 * Due the day before the next lesson, or 6 days after when no next lesson is scheduled.
 * A tick (done, or a parent's "no homework this time") closes it for good — except that
 * homework finished today stays in the list, ticked, so today's progress shows it.
 */
function homeworkFor(input: BuildDayInput): DayTask[] {
  const { child, iso, schedules, ticks, attendance = [], now } = input;
  const tickFor = new Map(ticks.filter(t => t.child_id === child.id && t.tier === "homework").map(t => [t.item_key, t]));
  const skipLesson = new Set(
    attendance.filter(l => l.child_id === child.id && NO_HOMEWORK.includes(l.status)).map(l => `${l.activity_id}|${day(l.date)}`)
  );

  const byActivity = new Map<string, ScheduleWithActivity[]>();
  for (const s of schedules) {
    if (s.activity?.child_id !== child.id || !s.activity.homework_from) continue;
    byActivity.set(s.activity_id, [...(byActivity.get(s.activity_id) ?? []), s]);
  }

  const items: DayTask[] = [];
  for (const [activityId, slots] of byActivity) {
    const a = slots[0].activity!;
    const lessonOn = (d: string) => slots.some(s => slotOn(s, d));
    const lessonOver = (d: string) =>
      d < iso || (d === iso && !!now && slots.some(s => slotOn(s, d) && (s.end_time ?? s.start_time) <= now));
    const from = [day(a.homework_from!), shift(iso, -HOMEWORK_LOOKBACK_DAYS)].sort()[1];

    for (let d = from; d <= iso; d = shift(d, 1)) {
      if (!lessonOn(d) || !lessonOver(d) || skipLesson.has(`${activityId}|${d}`)) continue;
      const key = `homework:${activityId}:${d}`;
      const tick = tickFor.get(key);
      if (tick && (tick.skipped || localDayOf(tick.done_at) !== iso)) continue; // closed earlier
      let next: string | null = null;
      for (let n = shift(d, 1), i = 0; i < 60 && !next; n = shift(n, 1), i++) if (lessonOn(n)) next = n;
      const due = next ? shift(next, -1) : shift(d, 6);
      items.push({
        key,
        title: `${activityLabel(a)} homework`,
        tier: "homework",
        source: { kind: "homework", label: `from the ${format(parseISO(d), "d MMM")} lesson · due ${format(parseISO(due), "EEE d MMM")}` },
        doneAt: tick ? tick.done_at : null,
        homework: { lesson: d, due, overdue: due < iso && !tick, note: a.homework_note ?? null },
      });
    }
  }
  return items.sort((x, y) => x.homework!.due.localeCompare(y.homework!.due));
}

export function buildDay(input: BuildDayInput): BuiltDay {
  const { child, iso, routine, goals, ticks } = input;
  const info = dayInfo(child, iso, input.calendarDays, input.hours);
  const routineType = info.kind === "holiday" ? "holiday" : "school";
  const weekday = weekdayOf(iso);
  const dayTicks = ticks.filter(t => t.child_id === child.id && day(t.date) === iso);
  const tickOf = new Map(dayTicks.map(t => [t.item_key, t]));

  // Routine lines for this kind of day and weekday, in the parent's order.
  const lines = routine
    .filter(r => r.child_id === child.id)
    .filter(r => r.day_type === "any" || r.day_type === routineType)
    .filter(r => r.weekdays.length === 0 || r.weekdays.includes(weekday))
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  const task = (key: string, title: string, tier: DayTask["tier"], source: DayTask["source"]): DayTask => {
    const t = tickOf.get(key);
    return { key, title, tier, source, doneAt: t?.done_at ?? null, ...(t ? { doneBy: t.by ?? "child" } : {}) };
  };
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

  // One-off tasks are always current (they can be added to or removed from any day), so
  // they replace whatever one-offs a saved list holds.
  const oneOffs = (input.oneOffs ?? [])
    .filter(o => o.child_id === child.id && day(o.date) === iso)
    .map(o => task(`oneoff:${o.id}`, o.title, o.tier, { kind: "oneoff", label: null }));

  // The list: the saved one when given, else built from the routine, classes and goals.
  const planned: DayTask[] = [
    ...(input.plan
      ? input.plan.filter(p => p.source.kind !== "oneoff").map(p => task(p.key, p.title, p.tier, p.source))
      : [...fromRoutine("must"), ...prep, ...fromRoutine("practice"), ...practiceFromGoals, ...fromRoutine("free")]),
    ...oneOffs,
  ];
  const plan: PlannedTask[] = planned.map(t => ({
    key: t.key, title: t.title, tier: t.tier as PlannedTask["tier"], source: t.source as PlannedTask["source"],
  }));
  // Ticked, but no longer on the list (the item was removed since): still shown, as done.
  const listed = new Set(planned.map(t => t.key));
  const extra = dayTicks
    .filter(t => !listed.has(t.item_key) && !t.skipped && (t.tier === "must" || t.tier === "practice" || t.tier === "free"))
    .map(t => task(t.item_key, t.title, t.tier as DayTask["tier"], { kind: "routine", label: null }));
  const byTier = (tier: DayTask["tier"]) => [...planned, ...extra].filter(t => t.tier === tier);

  const homework = input.homework === false ? [] : homeworkFor(input);
  const soon = homework.filter(h => differenceInCalendarDays(parseISO(h.homework!.due), parseISO(iso)) <= HOMEWORK_SOON_DAYS);
  const homeworkLater = homework.filter(h => !soon.includes(h));
  // Do first: routine must-dos, then homework due soon, then class prep — as before.
  const mustList = byTier("must");
  const must = [...mustList.filter(t => t.source.kind !== "prep"), ...soon, ...mustList.filter(t => t.source.kind === "prep")];
  const practice = byTier("practice");
  const free = byTier("free");

  // Timetable: school, home time, classes and fixed times, in time order.
  const timeline: TimelineBlock[] = [];
  const s = info.school;
  if (s?.start) timeline.push({ time: s.start, end: s.end, label: "School", sub: info.kind === "half_day" ? info.reason : null, kind: "school" });
  if (s?.end && s.after) timeline.push({ time: s.end, end: s.after.until, label: s.after.label, sub: "After school", kind: "school" });
  if (s?.homeAt) timeline.push({ time: s.homeAt, label: "Home from school", kind: "home" });
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

  // Due before the first class after they're home — and once that class has started,
  // before the next one (or no deadline at all).
  const home = s?.homeAt ?? s?.end;
  const after = Math.max(home ? toMinutes(home) : 0, input.now ? toMinutes(input.now) : 0);
  const due = classes.find(c => toMinutes(c.start_time) >= after);
  const deadline = due ? { label: activityLabel(due.activity!), time: due.start_time } : null;

  const open = [...must, ...practice].filter(t => !t.doneAt);
  const total = must.length + practice.length;
  return {
    info, routineType, timeline, must, practice, free, homeworkLater, deadline,
    now: open[0] ?? null,
    next: open[1] ?? null,
    done: total - open.length,
    total,
    freeUnlocked: must.every(t => t.doneAt),
    plan,
  };
}

// ─── The banner on Home: a short, encouraging line about a child's day ─────────

export interface Cheer {
  /** Small line above: where they are ("Keep going · before AQSA at 4:00 PM"). */
  kicker: string;
  /** The big line: short and kind. */
  headline: string;
  /** Optional line below: what's next. */
  detail: string | null;
  /** done = all ticked (green), go = under way today, plain = past or future. */
  tone: "done" | "go" | "plain";
}

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export function cheer(day: BuiltDay, tense: "past" | "today" | "future", name: string): Cheer {
  const { done, total } = day;
  if (tense === "future") {
    return { kicker: "Coming up", headline: total ? `${total} thing${total === 1 ? "" : "s"} planned` : "Free Play day", detail: null, tone: "plain" };
  }
  if (tense === "past") {
    if (total === 0) return { kicker: "That day", headline: "A free day", detail: null, tone: "plain" };
    if (done === total) return { kicker: "All done", headline: `${name} did it all. Well done!`, detail: null, tone: "done" };
    if (done === 0) return { kicker: "That day", headline: "Nothing ticked that day", detail: null, tone: "plain" };
    return { kicker: "That day", headline: `Good effort, ${name}!`, detail: null, tone: "plain" };
  }
  if (total === 0) return { kicker: "Today", headline: `Free Play day, ${name}!`, detail: null, tone: "go" };
  if (done === total) {
    return { kicker: "All done", headline: day.free.length ? `Great work, ${name}! Free Play is yours.` : `Great work, ${name}! All done.`, detail: null, tone: "done" };
  }
  const mustLeft = day.must.filter(t => !t.doneAt).length;
  const next = day.now ? `Next: ${day.now.title}` : null;
  const by = day.deadline ? ` · before ${day.deadline.label} at ${clock(day.deadline.time)}` : "";
  if (mustLeft > 0 && done === 0) return { kicker: `Let’s go${by}`, headline: `First up: ${day.now!.title}`, detail: null, tone: "go" };
  if (mustLeft > 0) return { kicker: `Keep going${by}`, headline: `Nice work! ${mustLeft} more to go.`, detail: next, tone: "go" };
  return { kicker: "Do first done", headline: "Well done! Hobby time next.", detail: next, tone: "go" };
}
