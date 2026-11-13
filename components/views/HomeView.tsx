"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { DueCheckpoints } from "@/components/goals/DueCheckpoints";
import { startOfWeek, differenceInCalendarDays, parseISO, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Page, Utilities, PageBody } from "@/components/layout/Page";
import { Fab } from "@/components/ui/Fab";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { DateBar, type DayMarker } from "@/components/day/DateBar";
import { ClassRow } from "@/components/day/ClassRow";
import { EmptyRoutineCard, RoutineCard, RoutineCardSkeleton, hasRoutine } from "@/components/day/RoutineCard";
import { useSpaNav } from "@/components/layout/spa-nav";
import { useRoutineItems } from "@/lib/my-day-api";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { cn, formatTime, plural } from "@/lib/utils";
import { getReflectionText } from "@/lib/reflection";
import { usualPeople } from "@/lib/usual-people";
import { useMyDays, useNow } from "@/lib/use-my-day";
import { getWeekDays, scheduleOccursOn, occurrenceKey, WeekDay } from "@/lib/week";
import { useChildren, useSchedules, useActivities, useAttendanceLogs, useAllAttendanceLogs, useGoals } from "@/lib/api-hooks";
import type { Schedule, Activity, ActivityCategory, Child, AttendanceLog } from "@/lib/types";

interface ScheduleWithDetails extends Schedule {
  activity?: Activity & { child?: Child; category?: ActivityCategory };
}
interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

/** How far back the "not logged" summary looks, in weeks (this week included). */
const UNLOGGED_WEEKS = 12;

type Occurrence = { key: string; schedule: ScheduleWithDetails };

/** Scheduled occurrences for each day of `week`, for the children `inFilter` allows, sorted by time. */
function buildDayBlocks(schedules: ScheduleWithDetails[], week: WeekDay[], inFilter: (childId: string) => boolean) {
  return week.map(day => {
    const occ: Occurrence[] = schedules
      .filter(s => {
        if (!s.is_active || !s.activity) return false;
        if (!scheduleOccursOn(s, day)) return false;
        if (!inFilter(s.activity.child_id)) return false;
        // The occurrence must fall within the activity's own date range
        const a = s.activity;
        if (a.start_date && day.iso < a.start_date.slice(0, 10)) return false;
        if (a.end_date && day.iso > a.end_date.slice(0, 10)) return false;
        return true;
      })
      .map(s => ({ key: occurrenceKey(s.activity!.id, s.activity!.child_id, day.iso, s.start_time), schedule: s }))
      .sort((a, b) => (a.schedule.start_time || "").localeCompare(b.schedule.start_time || ""));
    return { day, occ };
  });
}

/** A session is "past" once its day is over, or today once its end (else start) time has passed. */
function isPastOccurrence(day: WeekDay, s: Schedule, todayIso: string, nowHHMM: string) {
  if (day.iso < todayIso) return true;
  if (day.iso > todayIso) return false;
  const t = (s.end_time || s.start_time || "").slice(0, 5);
  return !!t && t <= nowHHMM;
}

/**
 * Pair each scheduled session with its attendance record: the record at the same start
 * time first, else any unpaired record for the same class, child and day. The fallback
 * matters when a schedule's time is edited after sessions were logged (a 10am class moved
 * to 9am): the old records still count, instead of every past week showing "not logged"
 * and inviting duplicates. Returns the pairs plus the ids of every record used.
 */
function pairLogs<L extends AttendanceLog>(blocks: { day: WeekDay; occ: { key: string; schedule: ScheduleWithDetails }[] }[], logs: L[]) {
  const byKey = new Map<string, L>();
  for (const l of logs) byKey.set(occurrenceKey(l.activity_id, l.child_id, l.date.slice(0, 10), l.start_time), l);
  const paired = new Map<string, L>(), used = new Set<string>();
  for (const { occ } of blocks) for (const o of occ) {
    const l = byKey.get(o.key);
    if (l && !used.has(l.id)) { paired.set(o.key, l); used.add(l.id); }
  }
  for (const { day, occ } of blocks) for (const o of occ) {
    if (paired.has(o.key)) continue;
    const a = o.schedule.activity!;
    const l = logs.find(x => !used.has(x.id) && x.activity_id === a.id && x.child_id === a.child_id && x.date.slice(0, 10) === day.iso);
    if (l) { paired.set(o.key, l); used.add(l.id); }
  }
  return { paired, used };
}

// ─── Which day: remembered for this browser session, but only for the day it was picked ──

const DAY_KEY = "bloom-home-day";
const noSubscribe = () => () => {};
function readStoredDay(): string | null {
  try {
    const raw = sessionStorage.getItem(DAY_KEY);
    if (!raw) return null;
    const { date, on } = JSON.parse(raw) as { date: string; on: string };
    return on === format(new Date(), "yyyy-MM-dd") ? date : null;
  } catch {
    return null;
  }
}
function storeDay(date: string, today: string) {
  try { sessionStorage.setItem(DAY_KEY, JSON.stringify({ date, on: today })); } catch { /* private mode */ }
}

/** A non-class line on the timetable (school, home time, dinner), shared by the children it applies to. */
interface NoteLine { time: string; end?: string | null; label: string; sub?: string | null; kind: string; kids: Child[] }

export default function AgendaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openSettings } = useSpaNav();
  const now = useNow();
  const todayIso = format(now, "yyyy-MM-dd");
  const nowHHMM = format(now, "HH:mm");

  // A picked day lasts only the day it was picked on: left open past midnight, Home moves to the new today.
  const [picked, setPicked] = useState<{ date: string; on: string } | null>(null);
  const restored = useSyncExternalStore(noSubscribe, readStoredDay, () => null);
  const date = (picked && picked.on === todayIso ? picked.date : null) ?? restored ?? todayIso;
  const chooseDay = (iso: string) => {
    const on = format(new Date(), "yyyy-MM-dd");
    setPicked({ date: iso, on });
    storeDay(iso, on);
  };

  const [selected, setSelected] = useState<string[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);

  // The Sun–Sat week holding the chosen day.
  const weekOffset = Math.round(differenceInCalendarDays(
    startOfWeek(parseISO(date), { weekStartsOn: 0 }), startOfWeek(now, { weekStartsOn: 0 })) / 7);
  const week = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const { data: children = [] } = useChildren();
  const { data: schedulesData = [] } = useSchedules();
  const { data: activities = [] } = useActivities();
  const { data: allLogs = [] } = useAllAttendanceLogs();
  const { data: logs = [], isLoading: loading } = useAttendanceLogs({ from: week[0].iso, to: week[6].iso, limit: 500 });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed when the date rolls over
  const summaryFrom = useMemo(() => getWeekDays(-(UNLOGGED_WEEKS - 1))[0].iso, [todayIso]);
  const { data: windowLogs = [] } = useAttendanceLogs({ from: summaryFrom, to: getWeekDays(0)[6].iso, limit: "all" });
  const schedules = schedulesData as ScheduleWithDetails[];
  const { data: routineItems = [] } = useRoutineItems();
  const { data: goals = [] } = useGoals();
  const my = useMyDays(now, { date, by: "parent" });

  // Every child is shown until a pill is switched off.
  const selectedChildren = useMemo(() => selected ?? children.map(c => c.id), [selected, children]);
  const toggleChild = (id: string) =>
    setSelected(prev => {
      const cur = prev ?? children.map(c => c.id);
      return cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    });

  async function refetchLogs() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
  }

  function openEditLog(log: LogWithDetails) {
    setPrefill({
      id: log.id, activity_id: log.activity_id, child_id: log.child_id, date: log.date.slice(0, 10),
      status: log.status, start_time: log.start_time, end_time: log.end_time, sent_by: log.sent_by,
      fetcher: log.fetcher, instructor_name: log.instructor_name, lesson_type: log.lesson_type,
      location: log.location, absence_reason: log.absence_reason,
      diary_notes: getReflectionText(log.learned, log.diary_notes),
    });
    setModalOpen(true);
  }

  function openAdhoc() {
    setPrefill({ date, status: "attended" });
    setModalOpen(true);
  }

  // The week's sessions, each paired with its record, plus records that match no session.
  const { logsByKey, dayBlocks, adhocByDay } = useMemo(() => {
    const inFilter = (childId: string) => selectedChildren.includes(childId);
    const dayBlocks = buildDayBlocks(schedules, week, inFilter);
    const { paired: logsByKey, used } = pairLogs(dayBlocks, logs);
    const adhocByDay = new Map<string, LogWithDetails[]>();
    for (const log of logs) {
      if (used.has(log.id) || !inFilter(log.child_id)) continue;
      const iso = log.date.slice(0, 10);
      adhocByDay.set(iso, [...(adhocByDay.get(iso) ?? []), log]);
    }
    return { logsByKey, dayBlocks, adhocByDay };
  }, [logs, schedules, week, selectedChildren]);

  // Past sessions with no record, per day, over the last UNLOGGED_WEEKS weeks (oldest first).
  const unlogged = useMemo(() => {
    const inFilter = (childId: string) => selectedChildren.includes(childId);
    const byDay = new Map<string, number>();
    let total = 0;
    for (let offset = -(UNLOGGED_WEEKS - 1); offset <= 0; offset++) {
      const blocks = buildDayBlocks(schedules, getWeekDays(offset), inFilter);
      const { paired } = pairLogs(blocks, windowLogs);
      for (const { day, occ } of blocks) {
        const missing = occ.filter(o => isPastOccurrence(day, o.schedule, todayIso, nowHHMM) && !paired.has(o.key)).length;
        if (missing) { byDay.set(day.iso, missing); total += missing; }
      }
    }
    return { byDay, total };
  }, [windowLogs, schedules, selectedChildren, todayIso, nowHHMM]);

  // The date bar's marks, from the shown week's own records (so older weeks work too).
  const markers = useMemo(() => {
    const m = new Map<string, DayMarker>();
    for (const { day, occ } of dayBlocks) {
      const past = occ.filter(o => isPastOccurrence(day, o.schedule, todayIso, nowHHMM));
      const missing = past.filter(o => !logsByKey.has(o.key)).length;
      const adhoc = adhocByDay.get(day.iso)?.length ?? 0;
      m.set(day.iso, { planned: occ.length + adhoc > 0, unlogged: missing, logged: past.length - missing + adhoc });
    }
    return m;
  }, [dayBlocks, adhocByDay, logsByKey, todayIso, nowHHMM]);

  // ─── The chosen day ──
  const block = dayBlocks.find(b => b.day.iso === date);
  const occ = block?.occ ?? [];
  const adhoc = adhocByDay.get(date) ?? [];
  const isToday = date === todayIso;
  const kids = children.filter(c => selectedChildren.includes(c.id));
  const upNext = isToday && block ? occ.find(o => !logsByKey.has(o.key) && !isPastOccurrence(block.day, o.schedule, todayIso, nowHHMM)) : undefined;

  // School, home time and fixed times from each child's day; the same line for two children is shown once.
  const notes = useMemo(() => {
    const byKey = new Map<string, NoteLine>();
    for (const kid of kids) {
      for (const b of my.days.get(kid.id)?.timeline ?? []) {
        if (b.kind === "class") continue;
        const key = `${b.time}|${b.end ?? ""}|${b.label}|${b.kind}`;
        const line = byKey.get(key);
        if (line) line.kids.push(kid);
        else byKey.set(key, { ...b, kids: [kid] });
      }
    }
    return [...byKey.values()];
  }, [kids, my.days]);

  const rows: { time: string; order: number; node: ReactNode }[] = [];
  for (const n of notes) {
    rows.push({ time: n.time, order: 0, node: <NoteRow key={`n-${n.time}-${n.label}-${n.kind}`} line={n} /> });
  }
  for (const { key, schedule: s } of occ) {
    const a = s.activity!;
    const log = logsByKey.get(key);
    const missing = !log && block && isPastOccurrence(block.day, s, todayIso, nowHHMM);
    const isNext = upNext?.key === key;
    const underway = isNext && !!s.start_time && s.start_time.slice(0, 5) <= nowHHMM;
    rows.push({
      time: (s.start_time ?? "").slice(0, 5), order: 1,
      node: (
        <ClassRow key={key}
          time={s.start_time} title={a.activity_name || a.institution} child={a.child}
          sub={a.activity_name ? a.institution : a.instructor_name} log={log} highlight={isNext}
          session={{
            activity_id: a.id, child_id: a.child_id, date, start_time: s.start_time, end_time: s.end_time,
            instructor_name: a.instructor_name, location: s.location,
          }}
          badge={isNext ? (
            <span className="h-5 px-2 inline-flex items-center rounded-full bg-[var(--stem)] text-[var(--sheet)] text-xs leading-4 font-semibold whitespace-nowrap">
              {underway ? "Now" : "Up next"}
            </span>
          ) : missing ? <span className="text-xs leading-4 font-semibold text-[#8a3f06] whitespace-nowrap">Not logged</span> : null}
          guessPeople={() => usualPeople(allLogs, { activityId: a.id, childId: a.child_id, startTime: s.start_time })}
          onOpenActivity={() => router.push(`/activity/${a.id}`)}
          onOpenForm={() => log && openEditLog(log)}
          onChanged={refetchLogs}
        />
      ),
    });
  }
  for (const log of adhoc) {
    const a = log.activity;
    rows.push({
      time: (log.start_time ?? "").slice(0, 5), order: 1,
      node: (
        <ClassRow key={log.id}
          time={log.start_time} title={a?.activity_name || a?.institution || "Activity"} child={log.child}
          sub={a?.activity_name ? a.institution : a?.instructor_name} log={log}
          guessPeople={() => ({ sentBy: [], fetcher: [] })}
          onOpenActivity={a ? () => router.push(`/activity/${a.id}`) : undefined}
          onOpenForm={() => openEditLog(log)}
          onChanged={refetchLogs}
        />
      ),
    });
  }
  rows.sort((x, y) => (x.time || "99").localeCompare(y.time || "99") || x.order - y.order);

  const routineKids = kids.filter(k => hasRoutine(my.days.get(k.id)));
  // Has anything ever been set up for this child: routine items, goal practice, class prep or homework?
  const isSetUp = (id: string) =>
    routineItems.some(r => r.child_id === id && r.tier !== "anchor") ||
    goals.some(g => g.child_id === id && !g.achieved_date && !!g.practice_task) ||
    activities.some(a => a.child_id === id && a.status === "active" && (!!a.prep_task || !!a.homework_from));

  const reminderDays = [...unlogged.byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <Page>
      <Header title="Home" subtitle={null} />

      {/* Which day: its name, the date bar, then whose day. */}
      <Utilities>
        <div className="flex items-center gap-2">
          <h2 id="day-heading" className={cn("text-xl leading-7 font-extrabold tracking-tight", isToday ? "text-[var(--stem)]" : "text-[var(--ink)]")}>
            {format(parseISO(date), "EEEE")}
          </h2>
          <span className="text-sm leading-5 text-[var(--ink-soft)]">{format(parseISO(date), "d MMM yyyy")}</span>
          {isToday && <span className="ml-auto h-6 px-2 inline-flex items-center rounded-full bg-[var(--stem)] text-[var(--sheet)] text-xs leading-4 font-bold uppercase tracking-wide">Today</span>}
        </div>
        <DateBar date={date} today={todayIso} markers={markers} onChange={chooseDay} />
        <ChildFilter childList={children} selected={selectedChildren} onToggle={toggleChild} />
      </Utilities>

      <PageBody>
        {/* Sessions not logged, per day: tap one to go there. */}
        {!loading && unlogged.total > 0 && (
          <section aria-labelledby="unlogged-heading" className="border border-[#e9c79c] bg-[#fdf6ec] p-4 flex flex-col gap-3">
            <div>
              <h2 id="unlogged-heading" className="flex items-center gap-2 font-semibold text-[#8a3f06]">
                <AlertCircle size={16} aria-hidden="true" /> {plural(unlogged.total, "past session")} not logged
              </h2>
              <p className="text-sm leading-5 text-[var(--ink-soft)]">In the last {UNLOGGED_WEEKS} weeks. Tap a day to fill them in.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reminderDays.map(([iso, n]) => (
                <button key={iso} type="button" onClick={() => chooseDay(iso)} aria-pressed={iso === date}
                  className={cn(
                    "relative inline-flex items-center gap-2 h-10 px-3 text-sm border cursor-pointer",
                    "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
                    iso === date ? "bg-[#8a3f06] border-[#8a3f06] text-white" : "bg-[var(--sheet)] border-[#e9c79c] text-[var(--ink)] hover:border-[#8a3f06]"
                  )}>
                  {iso === todayIso ? "Today" : format(parseISO(iso), "EEE d MMM")}
                  <span className={cn("text-xs font-bold tabular-nums", iso === date ? "text-white" : "text-[#8a3f06]")}>{n}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {isToday && <DueCheckpoints childIds={selectedChildren} />}

        {/* Each child's routine: tick for them, see when they ticked. Everyone selected gets a card. */}
        {kids.length > 0 && (
          <section aria-labelledby="routines-heading" className="flex flex-col gap-2">
            <h3 id="routines-heading" className="font-semibold text-[var(--ink)]">
              Routines{my.tense === "future" ? " · planned" : ""}
            </h3>
            {my.saveError && (
              <p role="alert" className="flex items-start gap-2 p-3 text-sm leading-5 border border-[var(--margin)] bg-[var(--sheet)] text-[var(--margin)]">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{my.saveError}</span>
                <button type="button" onClick={my.clearSaveError} className="relative font-semibold underline cursor-pointer before:absolute before:-inset-3 before:content-['']">OK</button>
              </p>
            )}
            <ul className="flex flex-col gap-3" aria-busy={!my.ready}>
              {!my.ready ? kids.map(kid => <RoutineCardSkeleton key={kid.id} />) : kids.map(kid => routineKids.includes(kid) ? (
                <RoutineCard key={kid.id} child={kid} day={my.days.get(kid.id)!} date={date} tense={my.tense}
                  onTick={t => my.toggle(kid, t)} onSkip={t => my.skip(kid, t)}
                  onAdd={(title, tier) => my.addOneOff(kid, title, tier)} onRemove={my.removeOneOff} />
              ) : (
                <EmptyRoutineCard key={kid.id} child={kid} setUp={isSetUp(kid.id)} tense={my.tense}
                  onSetUp={() => openSettings("routines")} onAdd={(title, tier) => my.addOneOff(kid, title, tier)} />
              ))}
            </ul>
          </section>
        )}

        {/* At the bottom: the day's timetable — school, classes (log them here) and fixed times. */}
        <section aria-labelledby="timetable-heading" className="flex flex-col gap-2">
          <h3 id="timetable-heading" className="font-semibold text-[var(--ink)]">Timetable</h3>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--bg-secondary)] animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm leading-5 text-[var(--ink-soft)] py-4">Nothing planned this day.</p>
          ) : (
            <div className="divide-y divide-[var(--rule)] border border-[var(--rule)] bg-[var(--sheet)]">
              {rows.map(r => r.node)}
            </div>
          )}
        </section>
      </PageBody>

      <Fab label="Add event" onClick={openAdhoc} />

      <AttendanceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        children={children}
        activities={activities}
        prefill={prefill}
        onSaved={refetchLogs}
      />
    </Page>
  );
}

/** School, home time or a fixed time like dinner: a quiet line on the timetable. */
function NoteRow({ line }: { line: NoteLine }) {
  const span = line.end ? `${formatTime(line.time)} – ${formatTime(line.end)}` : null;
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 items-start px-3 py-2.5 bg-[var(--bg-secondary)]/50">
      <time className="tabular-nums text-sm leading-6 text-[var(--ink-soft)]">{formatTime(line.time)}</time>
      <div className="min-w-0">
        <span className="block text-sm leading-6 font-medium text-[var(--ink)] break-words">
          {line.label}{span && <span className="font-normal text-[var(--ink-soft)]"> · {span}</span>}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 text-xs leading-4 text-[var(--ink-soft)]">
          {line.kids.map(k => (
            <span key={k.id} className="inline-flex items-center gap-1 font-semibold" style={{ color: k.color_code }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: k.color_code }} aria-hidden="true" />
              {k.name}
            </span>
          ))}
          {line.sub && <span>· {line.sub}</span>}
        </div>
      </div>
    </div>
  );
}
