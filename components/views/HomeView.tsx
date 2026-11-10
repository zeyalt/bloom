"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronLeft, ChevronRight, Check, X, NotebookPen, CalendarDays, Pencil, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { DueCheckpoints } from "@/components/goals/DueCheckpoints";
import { startOfWeek, differenceInCalendarDays, parseISO, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { cn, formatTime } from "@/lib/utils";
import { getReflectionText, hasReflection } from "@/lib/reflection";
import { getWeekDays, getWeekRange, scheduleOccursOn, occurrenceKey, WeekDay } from "@/lib/week";
import { useChildren, useSchedules, useActivities, useAttendanceLogs } from "@/lib/api-hooks";
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

/** "This week", "Last week", "Next week", else a short range like "27 Sep – 3 Oct". */
function weekName(offset: number) {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";
  const days = getWeekDays(offset);
  return `${format(days[0].date, "d MMM")} – ${format(days[6].date, "d MMM")}`;
}

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

  // Editing/deleting the underlying recurring schedule slot behind an occurrence card.
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ day_of_week: 1, start_time: "", end_time: "", location: "" });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [confirmDeleteSchedule, setConfirmDeleteSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);

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

  function openAbsentModal(s: ScheduleWithDetails, day: WeekDay) {
    const a = s.activity!;
    setPrefill({
      activity_id: a.id,
      child_id: a.child_id,
      date: day.iso,
      status: "absent",
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

  function openEditSchedule(s: Schedule) {
    setScheduleForm({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time ?? "",
      location: s.location ?? "",
    });
    setScheduleError("");
    setEditingSchedule(s);
  }

  async function saveSchedule() {
    if (!editingSchedule || !scheduleForm.start_time) { setScheduleError("Start time is required."); return; }
    setSavingSchedule(true); setScheduleError("");
    try {
      const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: scheduleForm.day_of_week,
          start_time: scheduleForm.start_time,
          end_time: scheduleForm.end_time.trim() || null,
          location: scheduleForm.location.trim() || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
      setEditingSchedule(null);
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e) { setScheduleError((e as Error).message); }
    finally { setSavingSchedule(false); }
  }

  async function deleteSchedule() {
    if (!confirmDeleteSchedule) return;
    setDeletingSchedule(true);
    try {
      await fetch(`/api/schedules/${confirmDeleteSchedule.id}`, { method: "DELETE" });
      setConfirmDeleteSchedule(null);
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    } finally { setDeletingSchedule(false); }
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

  return (
    <div className="max-w-[1000px] mx-auto w-full">
      <Header
        title="Home"
        subtitle={weekOffset === 0 ? "This week" : range.label}
        sticky
      />

      <div className="px-5 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">
        <ChildFilter className="mb-4" children={children} selected={selectedChildren} onToggle={toggleChild} />

        {!loading && selectedChildren.length > 0 && (
          unlogged.total > 0 ? (
            <section aria-labelledby="unlogged-heading" className="mb-5 border border-[#e9c79c] bg-[#fdf6ec] px-4 py-3">
              <h2 id="unlogged-heading" className="flex items-center gap-1.5 text-sm font-semibold text-[#8a3f06]">
                <AlertCircle size={15} /> {unlogged.total} past session{unlogged.total === 1 ? "" : "s"} not logged
              </h2>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">In the last {UNLOGGED_WEEKS} weeks. Tap a week to fill them in.</p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {[...unlogged.byOffset.entries()].filter(([, v]) => v.missing > 0).map(([offset, v]) => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setWeekOffset(offset)}
                    aria-pressed={offset === weekOffset}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-9 px-3 text-sm border cursor-pointer",
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
            <p className="mb-5 flex items-center gap-1.5 text-sm text-[var(--stem)]">
              <CheckCircle2 size={15} /> Every past session in the last {UNLOGGED_WEEKS} weeks is logged.
            </p>
          )
        )}

        {weekOffset === 0 && <DueCheckpoints childIds={selectedChildren} />}

        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setWeekOffset(o => o - 1)} className="shrink-0 inline-flex items-center justify-center h-9 w-9 border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer" title="Previous week">
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setWeekPickerOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 h-9 border text-sm font-medium bg-[var(--sheet)] cursor-pointer",
              weekOffset === 0
                ? "border-[var(--stem)] text-[var(--stem)]"
                : "border-[var(--rule)] text-[var(--ink)] hover:border-[var(--ink-faint)]"
            )}
          >
            <CalendarDays size={15} /> {weekOffset === 0 ? "This week" : range.label}
          </button>
          <button onClick={() => setWeekOffset(o => o + 1)} className="shrink-0 inline-flex items-center justify-center h-9 w-9 border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer" title="Next week">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={openAdhoc}><Plus size={14} /> Add event</Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-[var(--bg-secondary)] animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-8">
            {dayBlocks.map(({ day, occ }) => {
              const adhoc = adhocByDay.get(day.iso) ?? [];
              const hasItems = occ.length > 0 || adhoc.length > 0;
              return (
                <div key={day.iso} ref={day.isToday ? todayRef : undefined} className="scroll-mt-28 md:scroll-mt-32">
                  <div className={cn("flex items-baseline gap-2.5 pb-2", day.isToday && "pl-2.5 border-l-[3px] border-[var(--stem)]")}>
                    <h2 className={cn("text-xl font-extrabold tracking-tight leading-none", day.isToday ? "text-[var(--stem)]" : "text-[var(--ink)]")}>
                      {day.fullLabel}
                    </h2>
                    <span className="text-sm text-[var(--ink-faint)]">
                      {day.date.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                    </span>
                    {day.isToday && (
                      <span className="text-sm font-medium text-[var(--stem)]">Today</span>
                    )}
                  </div>

                  {!hasItems ? (
                    <p className="text-sm text-[var(--ink-faint)] py-4">No classes this day.</p>
                  ) : (
                    <div className="divide-y divide-[var(--rule)] border-y border-[var(--rule)] bg-[var(--sheet)]">
                      {occ.map(({ key, schedule: s }) => {
                        const a = s.activity!;
                        const child = a.child;
                        const log = logsByKey.get(key);
                        const title = a.activity_name || a.institution;
                        const missing = !log && isPastOccurrence(day, s, todayIso, nowHHMM);
                        return (
                          <div
                            key={s.id}
                            onClick={log ? () => openEditLog(log) : undefined}
                            className={cn("grid grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] gap-x-3 items-start py-3 px-1", log && "cursor-pointer")}
                          >
                            <time className="tabular-nums text-[0.9375rem] text-[var(--ink-soft)] pt-0.5">
                              {s.start_time ? formatTime(s.start_time) : "—"}
                            </time>
                            <div className="min-w-0">
                              <button
                                onClick={e => { e.stopPropagation(); router.push(`/activity/${a.id}`); }}
                                className="block text-[0.975rem] font-semibold text-[var(--stem)] truncate leading-tight hover:underline cursor-pointer text-left"
                              >
                                {title}
                              </button>
                              {(a.institution || a.instructor_name) && (
                                <div className="text-sm text-[var(--ink-faint)] truncate mt-0.5">{a.institution || a.instructor_name}</div>
                              )}
                              {!log && (
                                <div className="mt-2 flex gap-4">
                                  <button
                                    onClick={() => openAbsentModal(s, day)}
                                    className="inline-flex items-center gap-1 text-sm font-medium text-[var(--margin)] active:scale-95 cursor-pointer"
                                    title="Mark as absent"
                                  >
                                    <X size={14} /> Absent
                                  </button>
                                  <button
                                    onClick={() => { setPrefill({ activity_id: a.id, child_id: a.child_id, date: day.iso, status: "attended", start_time: s.start_time, end_time: s.end_time, instructor_name: a.instructor_name, location: s.location }); setModalOpen(true); }}
                                    className="inline-flex items-center gap-1 text-sm font-medium text-[var(--stem)] active:scale-95 cursor-pointer"
                                    title="Mark as attended"
                                  >
                                    <Check size={14} /> Attended
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                              {child && (
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: child.color_code }}>
                                  <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: child.color_code }} />
                                  {child.name}
                                </span>
                              )}
                              {log && (
                                <span className="text-xs text-[var(--ink-faint)]">
                                  {log.status === "absent" || log.status === "cancelled_by_provider" ? "Absent" : "Logged"}
                                </span>
                              )}
                              {missing && (
                                <span className="text-xs font-semibold text-[#8a3f06]">Not logged</span>
                              )}
                              {log && hasReflection(log.learned, log.diary_notes) && (
                                <NotebookPen size={13} className="text-[var(--ink-faint)]" aria-label="Has reflection" />
                              )}
                            </div>
                            {log ? (
                              // A logged session edits its attendance record in the full dialog.
                              <div className="shrink-0 flex items-center pt-0.5">
                                <button
                                  onClick={e => { e.stopPropagation(); openEditLog(log); }}
                                  className="p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer"
                                  title="Edit attendance"
                                  aria-label={`Edit attendance for ${title}`}
                                ><Pencil size={13} /></button>
                              </div>
                            ) : (
                              <div className="shrink-0 flex items-center gap-0.5 pt-0.5">
                                <button
                                  onClick={() => openEditSchedule(s)}
                                  className="p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer"
                                  title="Edit schedule"
                                  aria-label={`Edit the recurring schedule for ${title}`}
                                ><Pencil size={13} /></button>
                                <button
                                  onClick={() => setConfirmDeleteSchedule(s)}
                                  className="p-1.5 text-[var(--ink-faint)] hover:text-[var(--margin)] cursor-pointer"
                                  title="Delete schedule"
                                  aria-label={`Delete the recurring schedule for ${title}`}
                                ><Trash2 size={13} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {adhoc.map(log => {
                        const a = log.activity;
                        const child = log.child;
                        const title = a?.activity_name || a?.institution || "Activity";
                        return (
                          <div
                            key={log.id}
                            onClick={() => openEditLog(log)}
                            className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-x-3 items-start py-3 px-1 cursor-pointer"
                          >
                            <time className="tabular-nums text-[0.9375rem] text-[var(--ink-soft)] pt-0.5">
                              {log.start_time ? formatTime(log.start_time) : "—"}
                            </time>
                            <div className="min-w-0">
                              {a ? (
                                <button
                                  onClick={e => { e.stopPropagation(); router.push(`/activity/${a.id}`); }}
                                  className="block text-[0.975rem] font-semibold text-[var(--stem)] truncate leading-tight hover:underline cursor-pointer text-left"
                                >
                                  {title}
                                </button>
                              ) : (
                                <span className="block text-[0.975rem] font-semibold text-[var(--ink)] truncate leading-tight">{title}</span>
                              )}
                              {(a?.institution || a?.instructor_name) && (
                                <div className="text-sm text-[var(--ink-faint)] truncate mt-0.5">{a?.institution || a?.instructor_name}</div>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                              {child && (
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: child.color_code }}>
                                  <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: child.color_code }} />
                                  {child.name}
                                </span>
                              )}
                              <span className="text-xs text-[var(--ink-faint)]">
                                {log.status === "absent" || log.status === "cancelled_by_provider" ? "Absent" : "Logged"}
                              </span>
                              {hasReflection(log.learned, log.diary_notes) && (
                                <NotebookPen size={13} className="text-[var(--ink-faint)]" aria-label="Has reflection" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
          <label htmlFor="week-jump" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Further back? Pick any date</label>
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

      <Modal open={!!editingSchedule} onClose={() => setEditingSchedule(null)} title="Edit Schedule" size="sm">
        <div className="space-y-4">
          {scheduleError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{scheduleError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Day *</label>
              <select
                value={scheduleForm.day_of_week}
                onChange={e => setScheduleForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              >
                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.fullLabel}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Location</label>
              <input
                type="text"
                value={scheduleForm.location}
                onChange={e => setScheduleForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Time *</label>
              <input
                type="time"
                value={scheduleForm.start_time}
                onChange={e => setScheduleForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Time</label>
              <input
                type="time"
                value={scheduleForm.end_time}
                onChange={e => setScheduleForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditingSchedule(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveSchedule} loading={savingSchedule}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteSchedule} onClose={() => setConfirmDeleteSchedule(null)} title="Delete schedule?" size="sm">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          This removes the recurring slot entirely — every future and past week showing{" "}
          <strong>{confirmDeleteSchedule ? DAYS_OF_WEEK.find(d => d.value === confirmDeleteSchedule.day_of_week)?.label : ""}</strong>{" "}
          at <strong>{confirmDeleteSchedule ? formatTime(confirmDeleteSchedule.start_time) : ""}</strong> for this activity will lose it. Attendance already logged is unaffected.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDeleteSchedule(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={deleteSchedule} loading={deletingSchedule}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
