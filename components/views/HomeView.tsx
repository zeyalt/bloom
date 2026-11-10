"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, X, NotebookPen, CalendarDays, Pencil, AlertCircle, CheckCircle2, Ban } from "lucide-react";
import { DueCheckpoints } from "@/components/goals/DueCheckpoints";
import { startOfWeek, differenceInCalendarDays, parseISO, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Page, Utilities, PageBody } from "@/components/layout/Page";
import { IconButton } from "@/components/ui/IconButton";
import { Fab } from "@/components/ui/Fab";
import { Modal } from "@/components/ui/Modal";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { cn, formatTime, plural } from "@/lib/utils";
import { getReflectionText, hasReflection } from "@/lib/reflection";
import { getWeekDays, getWeekRange, scheduleOccursOn, occurrenceKey, WeekDay } from "@/lib/week";
import { useChildren, useSchedules, useActivities, useAttendanceLogs } from "@/lib/api-hooks";
import type { Schedule, Activity, ActivityCategory, Child, AttendanceLog, AttendanceStatus } from "@/lib/types";

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

/** "This week", "Last week", "Next week", else a short range like "27 Sep – 3 Oct". */
function weekName(offset: number) {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";
  const days = getWeekDays(offset);
  return `${format(days[0].date, "d MMM")} – ${format(days[6].date, "d MMM")}`;
}

/** The three outcomes a scheduled session can have; each opens the attendance dialog pre-filled. */
const QUICK_LOG: { status: AttendanceStatus; label: string; icon: typeof Check; cls: string }[] = [
  { status: "attended", label: "Attended", icon: Check, cls: "text-[var(--stem)]" },
  { status: "absent", label: "Absent", icon: X, cls: "text-[var(--margin)]" },
  { status: "cancelled_by_provider", label: "Cancelled", icon: Ban, cls: "text-[var(--ink-soft)]" },
];

export default function AgendaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const childrenInit = useRef(false);
  const toggleChild = (id: string) => setSelectedChildren(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const [modalOpen, setModalOpen] = useState(false);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const todayRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);

  // Rebuilt only when the user moves weeks — these feed the memoised derivations
  // below, which would otherwise miss on every render.
  const range = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const week = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // Fetch data using React Query hooks
  const { data: childrenData = [] } = useChildren();
  const { data: schedulesData = [] } = useSchedules();
  const { data: activitiesData = [] } = useActivities();
  const { data: logsData = [], isLoading } = useAttendanceLogs({
    from: range.from,
    to: range.to,
    limit: 500,
  });

  // Every log in the "not logged" window — same shared cache, filtered client-side.
  const summaryFrom = useMemo(() => getWeekRange(-(UNLOGGED_WEEKS - 1)).from, []);
  const { data: windowLogs = [] } = useAttendanceLogs({ from: summaryFrom, to: getWeekRange(0).to, limit: "all" });

  const children = childrenData;
  const schedules = schedulesData;
  const activities = activitiesData;
  const logs = logsData;
  const loading = isLoading;

  // Select all children by default once they load; toggling a pill off hides that child.
  useEffect(() => {
    if (!childrenInit.current && children.length) {
      setSelectedChildren(children.map(c => c.id));
      childrenInit.current = true;
    }
  }, [children]);

  // On first load of the current week, jump to today so the user lands on the
  // current day (not Sunday). Earlier days remain above to scroll back to.
  useEffect(() => {
    if (loading || weekOffset !== 0 || hasScrolledToToday.current) return;
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: "start" });
      hasScrolledToToday.current = true;
    }
  }, [loading, weekOffset]);

  // Refetch only what the save actually changed — invalidating everything
  // pulled the whole attendance history back down after each edit.
  async function refetchLogs() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
  }

  function openLog(s: ScheduleWithDetails, day: WeekDay, status: AttendanceStatus) {
    const a = s.activity!;
    setPrefill({
      activity_id: a.id,
      child_id: a.child_id,
      date: day.iso,
      status,
      start_time: s.start_time,
      end_time: s.end_time,
      instructor_name: a.instructor_name,
      location: s.location,
    });
    setModalOpen(true);
  }


  function openEditLog(log: LogWithDetails) {
    setPrefill({
      id: log.id,
      activity_id: log.activity_id,
      child_id: log.child_id,
      date: log.date.slice(0, 10),
      status: log.status,
      start_time: log.start_time,
      end_time: log.end_time,
      sent_by: log.sent_by,
      fetcher: log.fetcher,
      instructor_name: log.instructor_name,
      lesson_type: log.lesson_type,
      location: log.location,
      absence_reason: log.absence_reason,
      diary_notes: getReflectionText(log.learned, log.diary_notes),
    });
    setModalOpen(true);
  }

  function openAdhoc() {
    setPrefill({ date: week.find(d => d.isToday)?.iso ?? week[0].iso, status: "attended" });
    setModalOpen(true);
  }

  // Jump to the week containing a date picked from the calendar
  function onPickWeek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const pickedStart = startOfWeek(parseISO(e.target.value), { weekStartsOn: 0 });
    const currentStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    setWeekOffset(Math.round(differenceInCalendarDays(pickedStart, currentStart) / 7));
    setWeekPickerOpen(false);
  }

  // The week's agenda: which scheduled occurrences fall on each day, the log
  // recorded against each one, and any ad-hoc logs that match no occurrence.
  // Rebuilt only when the week, the data, or the child filter changes — opening
  // a modal or scrolling no longer re-walks every schedule.
  const { logsByKey, dayBlocks, adhocByDay } = useMemo(() => {
    const logsByKey = new Map<string, LogWithDetails>();
    for (const log of logs) {
      logsByKey.set(occurrenceKey(log.activity_id, log.child_id, log.date.slice(0, 10), log.start_time), log);
    }

    const inFilter = (childId: string) => selectedChildren.includes(childId);
    const dayBlocks = buildDayBlocks(schedules as ScheduleWithDetails[], week, inFilter);
    const scheduledKeys = new Set(dayBlocks.flatMap(b => b.occ.map(o => o.key)));

    // Ad-hoc logs = logs in the week not tied to a scheduled occurrence
    const adhocByDay = new Map<string, LogWithDetails[]>();
    for (const log of logs) {
      const iso = log.date.slice(0, 10);
      const key = occurrenceKey(log.activity_id, log.child_id, iso, log.start_time);
      if (scheduledKeys.has(key)) continue;
      if (!inFilter(log.child_id)) continue;
      const arr = adhocByDay.get(iso) ?? [];
      arr.push(log);
      adhocByDay.set(iso, arr);
    }

    return { logsByKey, dayBlocks, adhocByDay };
  }, [logs, schedules, week, selectedChildren]);

  // Past scheduled sessions with no attendance record, per week, over the last
  // UNLOGGED_WEEKS weeks — for the Home summary and the week picker.
  const now = new Date();
  const todayIso = format(now, "yyyy-MM-dd");
  const nowHHMM = format(now, "HH:mm");
  const unlogged = useMemo(() => {
    const logged = new Set(windowLogs.map(l => occurrenceKey(l.activity_id, l.child_id, l.date.slice(0, 10), l.start_time)));
    const inFilter = (childId: string) => selectedChildren.includes(childId);
    const byOffset = new Map<number, { missing: number; past: number }>();
    let total = 0;
    for (let offset = 0; offset > -UNLOGGED_WEEKS; offset--) {
      let missing = 0, past = 0;
      for (const { day, occ } of buildDayBlocks(schedules as ScheduleWithDetails[], getWeekDays(offset), inFilter)) {
        for (const o of occ) {
          if (!isPastOccurrence(day, o.schedule, todayIso, nowHHMM)) continue;
          past++;
          if (!logged.has(o.key)) missing++;
        }
      }
      byOffset.set(offset, { missing, past });
      total += missing;
    }
    return { byOffset, total };
    // nowHHMM is minute-grained, so this re-derives at most once a minute of re-renders.
  }, [windowLogs, schedules, selectedChildren, todayIso, nowHHMM]);

  // Header line: what this week holds, so the page answers "what's on?" before scrolling.
  const weekLine = useMemo(() => {
    const days = dayBlocks.map(({ day, occ }) => ({
      day,
      planned: occ.length + (adhocByDay.get(day.iso)?.length ?? 0),
      upcoming: occ.filter(o => !logsByKey.has(o.key) && !isPastOccurrence(day, o.schedule, todayIso, nowHHMM)).length,
    }));
    const planned = days.reduce((n, d) => n + d.planned, 0);
    if (weekOffset === 0) {
      const today = days.find(d => d.day.isToday)?.upcoming ?? 0;
      const later = days.filter(d => d.day.iso > todayIso).reduce((n, d) => n + d.upcoming, 0);
      const date = format(parseISO(todayIso), "EEE d MMM");
      if (!today && !later) return `${date} · all done this week`;
      if (!today) return `${date} · ${later} more this week`;
      return `${date} · ${today} today${later ? `, ${later} more this week` : ""}`;
    }
    const span = `${format(week[0].date, "d MMM")} – ${format(week[6].date, "d MMM")}`;
    if (weekOffset > 0) return `${span} · ${planned ? `${plural(planned, "session")} planned` : "nothing planned"}`;
    const missing = unlogged.byOffset.get(weekOffset)?.missing ?? 0;
    if (!planned) return `${span} · no sessions`;
    return `${span} · ${missing ? `${missing} of ${planned} not logged` : `all ${planned} logged`}`;
  }, [dayBlocks, adhocByDay, logsByKey, week, weekOffset, unlogged, todayIso, nowHHMM]);

  // One row per session: time · title (+ quick log buttons) · child/status · one 48px action.
  const rowCls = "grid grid-cols-[4.5rem_minmax(0,1fr)_auto_3rem] gap-x-3 items-start py-3";
  const childTag = (child?: Child) => child && (
    <span className="inline-flex items-center gap-2 text-sm leading-5 font-medium" style={{ color: child.color_code }}>
      <span className="w-2 h-2 shrink-0" style={{ backgroundColor: child.color_code }} />
      {child.name}
    </span>
  );
  const titleLink = (title: string, activityId?: string) => activityId ? (
    <button
      onClick={e => { e.stopPropagation(); router.push(`/activity/${activityId}`); }}
      className="relative block max-w-full text-base leading-6 font-semibold text-[var(--stem)] hover:underline cursor-pointer text-left before:absolute before:left-0 before:w-full before:min-w-12 before:-inset-y-3 before:content-['']"
    >
      <span className="block truncate">{title}</span>
    </button>
  ) : (
    <span className="block text-base leading-6 font-semibold text-[var(--ink)] truncate">{title}</span>
  );

  return (
    <Page>
      <Header title="Home" subtitle={loading ? " " : weekLine} />

      <Utilities>
        <ChildFilter childList={children} selected={selectedChildren} onToggle={toggleChild} />
      </Utilities>

      <PageBody>
        {/* 3 · Summary */}
        {!loading && selectedChildren.length > 0 && (
          unlogged.total > 0 ? (
            <section aria-labelledby="unlogged-heading" className="border border-[#e9c79c] bg-[#fdf6ec] p-4 flex flex-col gap-3">
              <div>
                <h2 id="unlogged-heading" className="flex items-center gap-2 font-semibold text-[#8a3f06]">
                  <AlertCircle size={16} aria-hidden="true" /> {unlogged.total} past session{unlogged.total === 1 ? "" : "s"} not logged
                </h2>
                <p className="text-sm leading-5 text-[var(--ink-soft)]">In the last {UNLOGGED_WEEKS} weeks. Tap a week to fill them in.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...unlogged.byOffset.entries()].filter(([, v]) => v.missing > 0).map(([offset, v]) => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setWeekOffset(offset)}
                    aria-pressed={offset === weekOffset}
                    className={cn(
                      "relative inline-flex items-center gap-2 h-10 px-3 text-sm border cursor-pointer",
                      "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
                      offset === weekOffset ? "bg-[#8a3f06] border-[#8a3f06] text-white" : "bg-[var(--sheet)] border-[#e9c79c] text-[var(--ink)] hover:border-[#8a3f06]"
                    )}
                  >
                    {weekName(offset)}
                    <span className={cn("text-xs font-bold tabular-nums", offset === weekOffset ? "text-white" : "text-[#8a3f06]")}>{v.missing}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <p className="flex items-center gap-2 text-sm leading-5 text-[var(--stem)]">
              <CheckCircle2 size={16} aria-hidden="true" /> Every past session in the last {UNLOGGED_WEEKS} weeks is logged.
            </p>
          )
        )}

        {weekOffset === 0 && <DueCheckpoints childIds={selectedChildren} />}

        {/* 4 · Primary: which week */}
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} label="Previous week" onClick={() => setWeekOffset(o => o - 1)} className="border border-[var(--rule)] bg-[var(--sheet)]" />
          <button
            type="button"
            onClick={() => setWeekPickerOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "flex-1 min-w-0 inline-flex items-center justify-center gap-2 h-12 border text-sm font-medium bg-[var(--sheet)] rounded-[var(--radius-md)] cursor-pointer",
              weekOffset === 0
                ? "border-[var(--stem)] text-[var(--stem)]"
                : "border-[var(--rule)] text-[var(--ink)] hover:border-[var(--ink-faint)]"
            )}
          >
            <CalendarDays size={16} aria-hidden="true" /> <span className="truncate">{weekOffset === 0 ? "This week" : range.label}</span>
          </button>
          <IconButton icon={ChevronRight} label="Next week" onClick={() => setWeekOffset(o => o + 1)} className="border border-[var(--rule)] bg-[var(--sheet)]" />
        </div>

        {/* 5 · Feed: the week, day by day */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-[var(--bg-secondary)] animate-pulse" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {dayBlocks.map(({ day, occ }) => {
              const adhoc = adhocByDay.get(day.iso) ?? [];
              const hasItems = occ.length > 0 || adhoc.length > 0;
              // Today: the first session still to come (or under way) gets a marker.
              const upNext = day.isToday ? occ.find(o => !logsByKey.has(o.key) && !isPastOccurrence(day, o.schedule, todayIso, nowHHMM)) : undefined;
              return (
                <section key={day.iso} ref={day.isToday ? todayRef : undefined} className="scroll-mt-4" aria-label={`${day.fullLabel} ${day.iso}`}>
                  <div className="flex items-center gap-2 pb-2">
                    <h2 className={cn("text-xl leading-7 font-extrabold tracking-tight", day.isToday ? "text-[var(--stem)]" : "text-[var(--ink)]")}>
                      {day.fullLabel}
                    </h2>
                    <span className="text-sm leading-5 text-[var(--ink-soft)]">
                      {day.date.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                    </span>
                    {day.isToday && <span className="ml-auto h-6 px-2 inline-flex items-center rounded-full bg-[var(--stem)] text-[var(--sheet)] text-xs leading-4 font-bold uppercase tracking-wide">Today</span>}
                  </div>

                  {!hasItems ? (
                    <p className="text-sm leading-5 text-[var(--ink-soft)] py-4">No classes this day.</p>
                  ) : (
                    <div className={cn(
                      "divide-y bg-[var(--sheet)]",
                      day.isToday
                        ? "border-2 border-[var(--stem)] divide-[#cfe0d4] rounded-[var(--radius-lg)] overflow-hidden shadow-[0_2px_12px_rgba(47,111,78,0.14)]"
                        : "border-y border-[var(--rule)] divide-[var(--rule)]"
                    )}>
                      {occ.map(({ key, schedule: s }) => {
                        const a = s.activity!;
                        const log = logsByKey.get(key);
                        const title = a.activity_name || a.institution;
                        const missing = !log && isPastOccurrence(day, s, todayIso, nowHHMM);
                        const isNext = upNext?.key === key;
                        const underway = isNext && !!s.start_time && s.start_time.slice(0, 5) <= nowHHMM;
                        return (
                          <div key={s.id} onClick={log ? () => openEditLog(log) : undefined} className={cn(rowCls, "px-3", log && "cursor-pointer", isNext && "bg-[#e8f2eb]")}>
                            <div className="flex flex-col items-start gap-1">
                              <time className={cn("tabular-nums text-sm leading-6", isNext ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]")}>
                                {s.start_time ? formatTime(s.start_time) : "—"}
                              </time>
                              {isNext && (
                                <span className="h-5 px-2 inline-flex items-center rounded-full bg-[var(--stem)] text-[var(--sheet)] text-xs leading-4 font-semibold whitespace-nowrap">
                                  {underway ? "Now" : "Up next"}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              {titleLink(title, a.id)}
                              {(a.institution || a.instructor_name) && (
                                <div className="text-sm leading-5 text-[var(--ink-soft)] truncate">{a.institution || a.instructor_name}</div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {childTag(a.child)}
                              {log && (
                                <span className="text-xs leading-4 text-[var(--ink-soft)]">
                                  {ATTENDANCE_STATUS_LABELS[log.status] ?? "Logged"}
                                </span>
                              )}
                              {missing && <span className="text-xs leading-4 font-semibold text-[#8a3f06]">Not logged</span>}
                              {log && hasReflection(log.learned, log.diary_notes) && (
                                <NotebookPen size={16} className="text-[var(--ink-soft)]" aria-label="Has reflection" />
                              )}
                            </div>
                            {log && (
                              <IconButton icon={Pencil} label={`Edit attendance for ${title}`} className="-mt-3 -mr-3"
                                onClick={e => { e.stopPropagation(); openEditLog(log); }} />
                            )}
                            {!log && (
                              <div role="group" aria-label={`Log ${title}`} className="col-span-4 md:col-start-2 md:col-span-3 md:max-w-md grid grid-cols-3 gap-2 mt-3">
                                {QUICK_LOG.map(q => (
                                  <button key={q.status} type="button" onClick={() => openLog(s, day, q.status)}
                                    className={cn(
                                      "relative inline-flex items-center justify-center gap-1 h-10 px-2 text-sm font-medium border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] active:scale-95 cursor-pointer",
                                      "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
                                      q.cls
                                    )}>
                                    <q.icon size={16} aria-hidden="true" /> {q.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {adhoc.map(log => {
                        const a = log.activity;
                        const title = a?.activity_name || a?.institution || "Activity";
                        return (
                          <div key={log.id} onClick={() => openEditLog(log)} className={cn(rowCls, "px-3 cursor-pointer")}>
                            <time className="tabular-nums text-sm leading-6 text-[var(--ink-soft)]">
                              {log.start_time ? formatTime(log.start_time) : "—"}
                            </time>
                            <div className="min-w-0">
                              {titleLink(title, a?.id)}
                              {(a?.institution || a?.instructor_name) && (
                                <div className="text-sm leading-5 text-[var(--ink-soft)] truncate">{a?.institution || a?.instructor_name}</div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {childTag(log.child)}
                              <span className="text-xs leading-4 text-[var(--ink-soft)]">
                                {ATTENDANCE_STATUS_LABELS[log.status] ?? "Logged"}
                              </span>
                              {hasReflection(log.learned, log.diary_notes) && (
                                <NotebookPen size={16} className="text-[var(--ink-soft)]" aria-label="Has reflection" />
                              )}
                            </div>
                            <IconButton icon={Pencil} label={`Edit attendance for ${title}`} className="-mt-3 -mr-3"
                              onClick={e => { e.stopPropagation(); openEditLog(log); }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </PageBody>

      {/* 6 · Create */}
      <Fab label="Add event" onClick={openAdhoc} />

      <Modal open={weekPickerOpen} onClose={() => setWeekPickerOpen(false)} title="Choose a week" size="sm">
        <ul className="-mx-2 divide-y divide-[var(--rule)]">
          {Array.from({ length: UNLOGGED_WEEKS + 2 }, (_, i) => 2 - i).map(offset => {
            const info = unlogged.byOffset.get(offset);
            const active = offset === weekOffset;
            return (
              <li key={offset}>
                <button
                  type="button"
                  onClick={() => { setWeekOffset(offset); setWeekPickerOpen(false); }}
                  aria-current={active ? "true" : undefined}
                  className={cn("w-full flex items-center gap-3 px-2 min-h-12 text-left cursor-pointer hover:bg-[var(--bg-secondary)]", active && "bg-[var(--bg-secondary)]")}
                >
                  <span className="flex-1 min-w-0">
                    <span className={cn("block text-sm", active ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]")}>{getWeekRange(offset).label}</span>
                    {Math.abs(offset) <= 1 && <span className="block text-xs text-[var(--ink-soft)]">{weekName(offset)}</span>}
                  </span>
                  {info && info.missing > 0 ? (
                    <span className="text-xs font-semibold text-[#8a3f06]">{info.missing} not logged</span>
                  ) : info && info.past > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--stem)]"><Check size={12} /> All logged</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 pt-4 border-t border-[var(--rule)]">
          <label htmlFor="week-jump" className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Further back? Pick any date</label>
          <input
            id="week-jump"
            type="date"
            max={todayIso}
            onChange={onPickWeek}
            className="w-full px-3 py-2 text-base md:text-sm border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] focus:outline-none focus:border-[var(--stem)]"
          />
        </div>
      </Modal>

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
