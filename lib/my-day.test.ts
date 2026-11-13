import { describe, expect, it } from "vitest";
import { buildDay, cheer, dayInfo, latestLesson, levelFor, levelName } from "./my-day";
import { MOE_PRIMARY, PUBLIC_HOLIDAYS, publicHolidayId } from "./calendar-sources";
import type { Activity, CalendarDay, Child, Goal, OneOffTask, PlannedTask, RoutineItem, Schedule, SchoolHours, TaskTick } from "./types";

// ─── Fixtures: the real MOE and public-holiday data, plus a child set up like Zayyan ──

const MOE = "moe";
const calendarDays: CalendarDay[] = [
  ...Object.values(MOE_PRIMARY).flat().map(d => ({
    id: d.id, calendar_id: MOE, start_date: d.start, end_date: d.end, kind: d.kind, title: d.title,
    ends_at: null, levels: d.levels ?? null, source: "moe" as const, created_at: "",
  })),
  ...Object.values(PUBLIC_HOLIDAYS).flat().map(h => ({
    id: publicHolidayId(h.date, h.title), calendar_id: null, start_date: h.date, end_date: h.date,
    kind: "public_holiday" as const, title: h.title, ends_at: null, levels: null, source: "data.gov.sg" as const, created_at: "",
  })),
  {
    id: "half", calendar_id: MOE, start_date: "2026-11-20", end_date: "2026-11-20", kind: "half_day",
    title: "Last day of term", ends_at: "11:00", levels: null, source: "you", created_at: "",
  },
];

const child = (over: Partial<Child> = {}): Child => ({
  id: "z", name: "Zayyan", nickname: null, date_of_birth: null, school: null, color_code: "#000000",
  avatar_emoji: "", avatar_key: null, school_level: "P2", school_level_year: 2026, auto_promote: true,
  calendar_id: MOE, created_at: "", updated_at: "", ...over,
});

const hoursRow = (dow: number, start: string | null, end: string | null, after: string | null = null, until: string | null = null): SchoolHours => ({
  id: `h${dow}`, child_id: "z", day_of_week: dow, is_school_day: !!start, start_time: start, end_time: end,
  after_school: after, after_school_until: until,
});
const hours: SchoolHours[] = [
  hoursRow(0, null, null),
  hoursRow(1, "07:30", "13:30"),
  hoursRow(2, "07:30", "13:30"),
  hoursRow(3, "07:30", "13:30", "CCA – Badminton", "15:30"),
  hoursRow(4, "07:30", "13:30"),
  hoursRow(5, "07:30", "12:45"),
  hoursRow(6, null, null),
];

const kind = (iso: string, c: Child = child(), h: SchoolHours[] = hours) => dayInfo(c, iso, calendarDays, h);

// ─── Levels ─────────────────────────────────────────────────────────────────

describe("levels", () => {
  it("moves up a level each January when auto-promote is on", () => {
    expect(levelFor(child(), 2026)).toBe("P2");
    expect(levelFor(child(), 2027)).toBe("P3");
    expect(levelFor(child({ school_level: "K2" }), 2027)).toBe("P1");
    expect(levelFor(child({ school_level: "S5" }), 2030)).toBe("S5");
  });
  it("stays put when auto-promote is off, and never steps backwards", () => {
    expect(levelFor(child({ auto_promote: false }), 2027)).toBe("P2");
    expect(levelFor(child(), 2025)).toBe("P2");
  });
  it("reads codes as names", () => {
    expect(levelName("P2")).toBe("Primary 2");
    expect(levelName("K1")).toBe("Kindergarten 1");
    expect(levelName("Year 3")).toBe("Year 3");
  });
});

// ─── What kind of day ───────────────────────────────────────────────────────

describe("dayInfo", () => {
  it("a normal school day uses that weekday's hours", () => {
    const d = kind("2026-11-12"); // Thu
    expect(d.kind).toBe("school");
    expect(d.school).toEqual({ start: "07:30", end: "13:30", after: null, homeAt: "13:30" });
  });

  it("per-weekday hours: Wednesday CCA (home later), Friday's earlier finish", () => {
    expect(kind("2026-11-11").school).toMatchObject({ end: "13:30", after: { label: "CCA – Badminton", until: "15:30" }, homeAt: "15:30" });
    expect(kind("2026-11-13").school?.end).toBe("12:45");
  });

  it("an after-school activity without an end time leaves home time unknown", () => {
    const h = hours.map(r => r.day_of_week === 3 ? { ...r, after_school_until: null } : r);
    expect(kind("2026-11-11", child(), h).school?.homeAt).toBeNull();
  });

  it("a half day finishes at its own time", () => {
    const d = kind("2026-11-20");
    expect(d.kind).toBe("half_day");
    expect(d.school?.end).toBe("11:00");
    expect(d.reason).toBe("Last day of term");
  });

  it("public holidays win, including observed days", () => {
    expect(kind("2026-11-09")).toMatchObject({ kind: "holiday", reason: "Deepavali (Observed)" });
    expect(kind("2026-12-25")).toMatchObject({ kind: "holiday", reason: "Christmas Day" });
  });

  it("school holidays and MOE days off-in-lieu are holidays", () => {
    expect(kind("2026-11-23")).toMatchObject({ kind: "holiday", reason: "Year-end school holidays" });
    expect(kind("2026-03-23")).toMatchObject({ kind: "holiday", reason: "Day off-in-lieu for Hari Raya Puasa" });
    expect(kind("2026-10-02")).toMatchObject({ kind: "holiday", reason: "Children’s Day" });
  });

  it("weekends are holidays", () => {
    expect(kind("2026-11-14")).toMatchObject({ kind: "holiday", reason: "Weekend" });
  });

  it("2027's first day is P1 only: Zayyan (P3 by then) stays home, a P1 child goes", () => {
    expect(kind("2027-01-04").kind).toBe("holiday");
    expect(kind("2027-01-04", child({ school_level: "K2" })).kind).toBe("school"); // K2 in 2026 → P1 in 2027
    expect(kind("2027-01-05").kind).toBe("school");
  });

  it("with no hours entered, assumes school Monday to Friday", () => {
    expect(kind("2026-11-12", child(), []).kind).toBe("school");
    expect(kind("2026-11-12", child(), []).school).toEqual({ start: null, end: null, after: null, homeAt: null });
    expect(kind("2026-11-14", child(), []).reason).toBe("Weekend");
  });

  it("with no calendar chosen, only public holidays and the weekly hours apply", () => {
    const free = child({ calendar_id: null });
    expect(kind("2026-11-23", free).kind).toBe("school");
    expect(kind("2026-12-25", free).kind).toBe("holiday");
  });

  it("outside every term on a calendar with terms that year is a holiday", () => {
    const custom: CalendarDay[] = [{
      id: "c-t1", calendar_id: "own", start_date: "2026-01-05", end_date: "2026-06-26", kind: "term",
      title: "Semester 1", ends_at: null, levels: null, source: "you", created_at: "",
    }];
    const c = child({ calendar_id: "own" });
    expect(dayInfo(c, "2026-03-02", custom, hours).kind).toBe("school");
    expect(dayInfo(c, "2026-07-06", custom, hours)).toMatchObject({ kind: "holiday", reason: "Between terms" });
  });
});

// ─── The day itself ─────────────────────────────────────────────────────────

const activity = (id: string, name: string, over: Partial<Activity> = {}): Activity => ({
  id, child_id: "z", category_id: "c", activity_name: name, institution: `${name} school`, instructor_name: null,
  level: null, status: "active", start_date: null, end_date: null, notes: null, created_at: "", updated_at: "", ...over,
});
const schedule = (id: string, a: Activity, dow: number, start: string, end: string, over: Partial<Schedule> = {}) => ({
  id, activity_id: a.id, day_of_week: dow, start_time: start, end_time: end, duration_minutes: null,
  location: null, is_active: true, effective_from: null, effective_until: null, notes: null, created_at: "", activity: a, ...over,
});
const aqsa = activity("aqsa", "AQSA", { prep_task: "Pack AQSA bag" });
const soccer = activity("soccer", "Soccer");
const ended = activity("old", "Old class", { prep_task: "Should not show" });
const schedules = [
  schedule("s1", aqsa, 4, "16:00", "18:00"),
  schedule("s2", soccer, 1, "18:00", "19:30"),
  schedule("s3", ended, 4, "15:00", "16:00", { effective_until: "2026-10-01" }),
];

let order = 0;
const item = (id: string, tier: RoutineItem["tier"], title: string, weekdays: number[] = [], at_time: string | null = null, over: Partial<RoutineItem> = {}): RoutineItem =>
  ({ id, child_id: "z", weekdays, start_date: "2026-01-01", end_date: null, tier, title, at_time, sort_order: order++, created_at: "", updated_at: "", ...over });
const WEEKDAYS = [1, 2, 3, 4, 5];
const routine: RoutineItem[] = [
  item("lunch", "must", "Lunch and shower", WEEKDAYS),
  item("hw", "must", "School homework", WEEKDAYS),
  item("cca", "must", "Pack CCA kit", [3]),
  item("walk", "must", "Morning walk", [0, 6]),
  item("read", "practice", "Read a book · 20 min"),
  item("lego", "free", "Lego"),
  item("dinner", "anchor", "Dinner", [], "18:30"),
];

const goal = (id: string, over: Partial<Goal> = {}): Goal => ({
  id, child_id: "z", kind: "milestone", title: "Sub-10 on 3x3", target_date: "2026-12-31", achieved_date: null,
  unit: null, target_value: null, practice_task: "Cube practice · 15 min", practice_days: "school",
  created_at: "", updated_at: "", checkpoints: [], entries: [], ...over,
});
const goals = [goal("cube"), goal("done", { achieved_date: "2026-10-01", practice_task: "Already achieved" })];

const tick = (key: string, date: string, at = "2026-11-12T06:05:00.000Z", over: Partial<TaskTick> = {}): TaskTick =>
  ({ id: key, child_id: "z", date, item_key: key, title: "", tier: "must", done_at: at, skipped: false, by: "child", ...over });

const build = (iso: string, ticks: TaskTick[] = []) =>
  buildDay({ child: child(), iso, calendarDays, hours, routine, schedules, goals, ticks });

describe("buildDay on a school day (Thu 12 Nov 2026)", () => {
  const d = build("2026-11-12", [tick("routine:lunch", "2026-11-12"), tick("routine:hw", "2026-11-11")]);

  it("lists the right tasks in the right groups", () => {
    expect(d.must.map(t => t.title)).toEqual(["Lunch and shower", "School homework", "Pack AQSA bag"]);
    expect(d.practice.map(t => t.title)).toEqual(["Read a book · 20 min", "Cube practice · 15 min"]);
    expect(d.free.map(t => t.title)).toEqual(["Lego"]);
  });

  it("tags where automatic tasks came from", () => {
    expect(d.must[2].source).toEqual({ kind: "prep", label: "AQSA today" });
    expect(d.practice[1].source).toEqual({ kind: "goal", label: "Goal: Sub-10 on 3x3" });
  });

  it("only applies ticks from that date, with their time", () => {
    expect(d.must[0].doneAt).toBe("2026-11-12T06:05:00.000Z");
    expect(d.must[1].doneAt).toBeNull(); // ticked yesterday, not today
  });

  it("builds the timetable in time order, skipping ended classes", () => {
    expect(d.timeline.map(b => `${b.time} ${b.label}`)).toEqual([
      "07:30 School", "13:30 Home from school", "16:00 AQSA", "18:30 Dinner",
    ]);
  });

  it("must-dos are due before the first class after school", () => {
    expect(d.deadline).toEqual({ label: "AQSA", time: "16:00" });
  });

  it("once that class has started, there's no deadline left (or it moves to the next class)", () => {
    const late = buildDay({ child: child(), iso: "2026-11-12", now: "16:27", calendarDays, hours, routine, schedules, goals, ticks: [] });
    expect(late.deadline).toBeNull();
  });

  it("Now is the first open must-do; Free choice stays locked", () => {
    expect(d.now?.title).toBe("School homework");
    expect(d.next?.title).toBe("Pack AQSA bag");
    expect([d.done, d.total]).toEqual([1, 5]);
    expect(d.freeUnlocked).toBe(false);
  });

  it("unlocks Free choice once every must-do is ticked, and moves Now on to practice", () => {
    const all = build("2026-11-12", ["routine:lunch", "routine:hw", "prep:aqsa"].map(k => tick(k, "2026-11-12")));
    expect(all.freeUnlocked).toBe(true);
    expect(all.now?.title).toBe("Read a book · 20 min");
  });

  it("puts the CCA on the timetable and counts home time from its end", () => {
    const wed = build("2026-11-11");
    expect(wed.timeline.map(b => `${b.time} ${b.label}`)).toEqual([
      "07:30 School", "13:30 CCA – Badminton", "15:30 Home from school", "18:30 Dinner",
    ]);
  });

  it("weekday-only lines show only on their weekday", () => {
    expect(build("2026-11-11").must.map(t => t.title)).toContain("Pack CCA kit"); // Wed
  });
});

describe("buildDay on a holiday (Mon 23 Nov 2026)", () => {
  const d = build("2026-11-23");

  it("routines follow their weekdays, holiday or not", () => {
    expect(d.routineType).toBe("holiday");
    expect(d.must.map(t => t.title)).toEqual(["Lunch and shower", "School homework"]); // Mon lines, no weekend walk
    expect(d.practice.map(t => t.title)).toEqual(["Read a book · 20 min"]); // cube goal practice is school days only
  });

  it("a routine runs from its start date to its end date (none = goes on)", () => {
    const dated = [
      item("old", "must", "Old one", [], null, { start_date: "2026-01-01", end_date: "2026-11-22" }),
      item("soon", "must", "Starts later", [], null, { start_date: "2026-11-24" }),
      item("now", "must", "Runs today", [], null, { start_date: "2026-11-23", end_date: "2026-11-23" }),
      item("open", "must", "Goes on", [], null, { start_date: "2026-11-01" }),
    ];
    const t = buildDay({ child: child(), iso: "2026-11-23", calendarDays, hours, routine: dated, schedules: [], goals: [], ticks: [] });
    expect(t.must.map(x => x.title)).toEqual(["Runs today", "Goes on"]);
  });

  it("has no school on the timetable, but keeps that day's classes", () => {
    expect(d.timeline.map(b => b.label)).toEqual(["Soccer", "Dinner"]);
    expect(d.deadline).toEqual({ label: "Soccer", time: "18:00" });
  });
});

// ─── Homework that carries over ─────────────────────────────────────────────

describe("homework", () => {
  // Chinese tuition every Saturday 10:00–11:30, homework switched on from 1 Nov.
  const chinese = activity("cn", "Chinese Tuition", { homework_from: "2026-11-01", homework_note: "Worksheet" });
  const sat = schedule("cn-sat", chinese, 6, "10:00", "11:30");
  const hwTick = (lesson: string, doneAt: string, skipped = false): TaskTick =>
    ({ id: lesson, child_id: "z", date: lesson, item_key: `homework:cn:${lesson}`, title: "", tier: "homework", done_at: doneAt, skipped, by: "child" });
  const day = (iso: string, opts: { ticks?: TaskTick[]; now?: string; attendance?: BuildDayInputAttendance; slots?: ReturnType<typeof schedule>[] } = {}) =>
    buildDay({
      child: child(), iso, now: opts.now ?? null, calendarDays, hours, routine, goals,
      schedules: opts.slots ?? [sat], ticks: opts.ticks ?? [], attendance: opts.attendance ?? [],
    });
  const hw = (d: ReturnType<typeof day>) => [...d.must, ...d.homeworkLater].filter(t => t.tier === "homework");

  it("gives one piece per lesson since it was switched on, due the day before the next lesson", () => {
    const d = day("2026-11-12"); // Thu; lessons since 1 Nov: Sat 7 Nov
    expect(hw(d).map(t => t.key)).toEqual(["homework:cn:2026-11-07"]);
    expect(hw(d)[0].homework).toEqual({ lesson: "2026-11-07", due: "2026-11-13", overdue: false, note: "Worksheet" });
    expect(hw(d)[0].title).toBe("Chinese Tuition homework");
    expect(hw(d)[0].source.label).toBe("from the 7 Nov lesson · due Fri 13 Nov");
  });

  it("due within 3 days is a Do-first job that blocks Free Play; later is listed but doesn't block", () => {
    const thu = day("2026-11-12"); // due tomorrow
    expect(thu.must.some(t => t.tier === "homework")).toBe(true);
    const sun = day("2026-11-08"); // due in 5 days
    expect(sun.must.some(t => t.tier === "homework")).toBe(false);
    expect(sun.homeworkLater.map(t => t.key)).toEqual(["homework:cn:2026-11-07"]);
  });

  it("overdue homework stays in Do first, marked overdue", () => {
    const d = day("2026-11-14", { now: "09:00" }); // Sat morning, due yesterday, today's lesson not yet
    expect(hw(d).map(t => [t.key, t.homework!.overdue])).toEqual([["homework:cn:2026-11-07", true]]);
    expect(d.must.some(t => t.homework?.overdue)).toBe(true);
  });

  it("today's lesson gives homework once it's over", () => {
    expect(hw(day("2026-11-14", { now: "11:00" })).length).toBe(1);
    expect(hw(day("2026-11-14", { now: "11:30" })).map(t => t.homework!.lesson)).toEqual(["2026-11-07", "2026-11-14"]);
  });

  it("switching homework on counts from the latest lesson", () => {
    const chinese = activity("cn", "Chinese Tuition", {});
    const slots = [schedule("cn-sat", chinese, 6, "10:00", "11:30")];
    expect(latestLesson("cn", slots, "2026-11-12")).toBe("2026-11-07"); // Thu → last Sat
    expect(latestLesson("cn", slots, "2026-11-14")).toBe("2026-11-14"); // a lesson day counts
    expect(latestLesson("other", slots, "2026-11-12")).toBeNull();
  });

  it("a cancelled lesson gives none; an absent one still gives homework", () => {
    const absent = day("2026-11-12", { attendance: [{ activity_id: "cn", child_id: "z", date: "2026-11-07", status: "absent" }] });
    expect(hw(absent).map(h => h.homework!.lesson)).toContain("2026-11-07");
    const cancelled = day("2026-11-12", { attendance: [{ activity_id: "cn", child_id: "z", date: "2026-11-07", status: "cancelled_by_provider" }] });
    expect(hw(cancelled)).toEqual([]);
  });

  it("a tick closes it for good; finished today it stays, ticked", () => {
    expect(hw(day("2026-11-12", { ticks: [hwTick("2026-11-07", "2026-11-10T09:00:00.000Z")] }))).toEqual([]);
    const today = hw(day("2026-11-12", { ticks: [hwTick("2026-11-07", "2026-11-12T07:00:00.000Z")] }));
    expect(today.map(t => !!t.doneAt)).toEqual([true]);
    expect(hw(day("2026-11-12", { ticks: [hwTick("2026-11-07", "2026-11-12T07:00:00.000Z", true)] }))).toEqual([]);
  });

  it("with no next lesson scheduled, it's due 6 days after the lesson", () => {
    // Twice a week, Mon and Thu, ending after Mon 9 Nov.
    const tues = activity("cn", "Chinese Tuition", { homework_from: "2026-11-09" });
    const mon = schedule("m", tues, 1, "16:00", "17:00");
    const thu = schedule("t", tues, 4, "16:00", "17:00");
    const withNext = hw(day("2026-11-10", { slots: [mon, thu] }));
    expect(withNext.map(t => t.homework!.due)).toEqual(["2026-11-11"]); // day before Thu 12 Nov
    const ended = [mon, thu].map(s => ({ ...s, effective_until: "2026-11-09" }));
    expect(hw(day("2026-11-10", { slots: ended })).map(t => t.homework!.due)).toEqual(["2026-11-15"]);
  });

  it("ignores lessons before homework was switched on, and classes without it", () => {
    const off = activity("cn", "Chinese Tuition", { homework_from: null });
    expect(hw(day("2026-11-12", { slots: [schedule("x", off, 6, "10:00", "11:30")] }))).toEqual([]);
    const late = activity("cn", "Chinese Tuition", { homework_from: "2026-11-10" });
    expect(hw(day("2026-11-12", { slots: [schedule("x", late, 6, "10:00", "11:30")] }))).toEqual([]);
  });
});

type BuildDayInputAttendance = NonNullable<Parameters<typeof buildDay>[0]["attendance"]>;

// ─── Past days: the saved list, removed items, who ticked ────────────────────

describe("a past day", () => {
  const iso = "2026-11-12";
  const saved: PlannedTask[] = [
    { key: "routine:old", title: "Pray Zohor", tier: "must", source: { kind: "routine", label: null } },
    { key: "routine:read", title: "Read 20 min", tier: "practice", source: { kind: "routine", label: null } },
  ];

  it("uses the list saved that day instead of today's routine", () => {
    const d = buildDay({ child: child(), iso, calendarDays, hours, routine, schedules, goals, ticks: [], plan: saved });
    expect(d.must.map(t => t.title)).toEqual(["Pray Zohor"]);
    expect(d.practice.map(t => t.title)).toEqual(["Read 20 min"]);
    expect(d.free).toEqual([]);
  });

  it("returns the list it was built from, without homework, for saving", () => {
    const d = build(iso);
    expect(d.plan.map(p => p.key)).toEqual(d.plan.map(p => p.key).filter(k => !k.startsWith("homework:")));
    expect(d.plan.map(p => p.title)).toContain("Lunch and shower");
    expect(d.plan.find(p => p.title === "Pack AQSA bag")?.source.kind).toBe("prep");
  });

  it("still shows a ticked item that has since been removed, as done", () => {
    const gone = tick("routine:removed", iso, "2026-11-12T07:00:00.000Z", { title: "Feed the fish", tier: "practice" });
    const d = build(iso, [gone]);
    const t = d.practice.find(p => p.key === "routine:removed");
    expect(t?.title).toBe("Feed the fish");
    expect(t?.doneAt).toBe("2026-11-12T07:00:00.000Z");
    expect(d.plan.some(p => p.key === "routine:removed")).toBe(false);
  });

  it("knows who ticked each item", () => {
    const d = build(iso, [tick("routine:lunch", iso, undefined, { by: "parent" }), tick("routine:hw", iso)]);
    expect(d.must.find(t => t.key === "routine:lunch")?.doneBy).toBe("parent");
    expect(d.must.find(t => t.key === "routine:hw")?.doneBy).toBe("child");
    expect(d.must.find(t => t.key === "prep:aqsa")?.doneBy).toBeUndefined();
  });

  it("leaves homework out when asked (only today shows it)", () => {
    const chinese = activity("cn", "Chinese Tuition", { homework_from: "2026-11-01" });
    const slots = [schedule("cn-sat", chinese, 6, "10:00", "11:30")];
    const withHw = buildDay({ child: child(), iso: "2026-11-16", calendarDays, hours, routine, goals, schedules: slots, ticks: [] });
    const without = buildDay({ child: child(), iso: "2026-11-16", calendarDays, hours, routine, goals, schedules: slots, ticks: [], homework: false });
    expect([...withHw.must, ...withHw.homeworkLater].some(t => t.tier === "homework")).toBe(true);
    expect([...without.must, ...without.homeworkLater].some(t => t.tier === "homework")).toBe(false);
  });
});

// ─── The Home banner ─────────────────────────────────────────────────────────

describe("one-off tasks", () => {
  const iso = "2026-11-12";
  const oneOff = (id: string, title: string, tier: OneOffTask["tier"], over: Partial<OneOffTask> = {}): OneOffTask => ({
    id, child_id: "z", date: iso, title, tier, created_at: "", ...over,
  });
  const withOneOffs = (oneOffs: OneOffTask[], extra: Partial<Parameters<typeof buildDay>[0]> = {}) =>
    buildDay({ child: child(), iso, calendarDays, hours, routine, schedules, goals, ticks: [], oneOffs, ...extra });

  it("shows only this child's tasks for this date, in their tier, after the routine", () => {
    const d = withOneOffs([
      oneOff("bag", "Pack swimming bag", "must"),
      oneOff("card", "Card for Grandma", "practice"),
      oneOff("other", "Someone else's", "must", { child_id: "x" }),
      oneOff("tmrw", "Tomorrow's", "must", { date: "2026-11-13" }),
    ]);
    const bag = d.must.find(t => t.key === "oneoff:bag");
    expect(bag?.source.kind).toBe("oneoff");
    expect(d.must.findIndex(t => t.key === "oneoff:bag")).toBeGreaterThan(d.must.findIndex(t => t.key === "routine:lunch"));
    expect(d.practice.map(t => t.key)).toContain("oneoff:card");
    expect([...d.must, ...d.practice].some(t => t.key === "oneoff:other" || t.key === "oneoff:tmrw")).toBe(false);
  });

  it("counts towards the day: Free Play waits for a Do-first one-off", () => {
    const d = withOneOffs([oneOff("bag", "Pack swimming bag", "must")]);
    expect(d.total).toBe(build(iso).total + 1);
    const ticked = d.must.filter(t => t.key !== "oneoff:bag").map(t => tick(t.key, iso));
    expect(withOneOffs([oneOff("bag", "Pack swimming bag", "must")], { ticks: ticked }).freeUnlocked).toBe(false);
    expect(withOneOffs([oneOff("bag", "Pack swimming bag", "must")], { ticks: [...ticked, tick("oneoff:bag", iso)] }).freeUnlocked).toBe(true);
  });

  it("is saved with the day's list, and a saved list follows the current one-offs", () => {
    const d = withOneOffs([oneOff("bag", "Pack swimming bag", "must")]);
    expect(d.plan.find(p => p.key === "oneoff:bag")?.source.kind).toBe("oneoff");
    const saved: PlannedTask[] = [
      { key: "routine:old", title: "Pray Zohor", tier: "must", source: { kind: "routine", label: null } },
      { key: "oneoff:removed", title: "Removed since", tier: "must", source: { kind: "oneoff", label: null } },
    ];
    const past = withOneOffs([oneOff("added", "Added later", "free")], { plan: saved });
    expect(past.must.map(t => t.key)).toEqual(["routine:old"]);
    expect(past.free.map(t => t.key)).toEqual(["oneoff:added"]);
  });
});

describe("cheer", () => {
  const iso = "2026-11-12";
  const at = "2026-11-12T06:05:00.000Z";
  const all = ["routine:lunch", "routine:hw", "prep:aqsa", "routine:read", "goal:cube"];

  it("starts with the first job and the deadline", () => {
    const c = cheer(build(iso), "today", "Zayyan");
    expect(c.kicker).toBe("Let’s go · before AQSA at 4:00 PM");
    expect(c.headline).toBe("First up: Lunch and shower");
    expect(c.tone).toBe("go");
  });
  it("encourages once something's ticked", () => {
    const c = cheer(build(iso, [tick("routine:lunch", iso, at)]), "today", "Zayyan");
    expect(c.headline).toBe("Nice work! 2 more to go.");
    expect(c.detail).toBe("Next: School homework");
  });
  it("moves on to Hobby when Do first is done", () => {
    const c = cheer(build(iso, ["routine:lunch", "routine:hw", "prep:aqsa"].map(k => tick(k, iso, at))), "today", "Zayyan");
    expect(c.headline).toBe("Well done! Hobby time next.");
  });
  it("celebrates when everything's done", () => {
    const d = build(iso, all.map(k => tick(k, iso, at)));
    expect(d.done).toBe(d.total);
    const c = cheer(d, "today", "Zayyan");
    expect(c.tone).toBe("done");
    expect(c.headline).toMatch(/^Great work, Zayyan!/);
  });
  it("looks back kindly on past days, and ahead on future ones", () => {
    expect(cheer(build(iso, [tick("routine:lunch", iso, at)]), "past", "Zayyan").headline).toBe("Good effort, Zayyan!");
    expect(cheer(build(iso, all.map(k => tick(k, iso, at))), "past", "Zayyan").headline).toBe("Zayyan did it all. Well done!");
    expect(cheer(build(iso), "future", "Zayyan").kicker).toBe("Coming up");
  });
});
