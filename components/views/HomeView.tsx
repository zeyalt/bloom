"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Check, X, NotebookPen, CalendarDays } from "lucide-react";
import { startOfWeek, differenceInCalendarDays, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
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

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const childrenInit = useRef(false);
  const toggleChild = (id: string) => setSelectedChildren(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const [modalOpen, setModalOpen] = useState(false);
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

    const scheduledKeys = new Set<string>();
    const dayBlocks = week.map(day => {
      const occ = schedules
        .filter(s => {
          if (!s.is_active || !s.activity) return false;
          if (!scheduleOccursOn(s, day)) return false;
          if (!inFilter(s.activity.child_id)) return false;
          // Check if the occurrence date is within the activity's date range
          const a = s.activity;
          if (a.start_date && day.iso < a.start_date.slice(0, 10)) return false;
          if (a.end_date && day.iso > a.end_date.slice(0, 10)) return false;
          return true;
        })
        .map(s => {
          const key = occurrenceKey(s.activity!.id, s.activity!.child_id, day.iso, s.start_time);
          scheduledKeys.add(key);
          return { key, schedule: s };
        })
        .sort((a, b) => (a.schedule.start_time || "").localeCompare(b.schedule.start_time || ""));
      return { day, occ };
    });

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

  return (
    <div className="max-w-[1000px] mx-auto w-full">
      <Header
        title="Home"
        subtitle={weekOffset === 0 ? "This week" : range.label}
        sticky
        action={<Button size="sm" onClick={openAdhoc}><Plus size={14} /> Add event</Button>}
      />

      <div className="px-5 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setWeekOffset(o => o - 1)} className="shrink-0 inline-flex items-center justify-center h-9 w-9 border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer" title="Previous week">
            <ChevronLeft size={16} />
          </button>
          <div className="relative flex-1">
            <div
              aria-hidden
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 h-9 border text-sm font-medium bg-[var(--sheet)]",
                weekOffset === 0
                  ? "border-[var(--stem)] text-[var(--stem)]"
                  : "border-[var(--rule)] text-[var(--ink)]"
              )}
            >
              <CalendarDays size={15} /> {weekOffset === 0 ? "This week" : range.label}
            </div>
            <input
              type="date"
              value={range.from}
              onChange={onPickWeek}
              aria-label="Pick a week"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="shrink-0 inline-flex items-center justify-center h-9 w-9 border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer" title="Next week">
            <ChevronRight size={16} />
          </button>
        </div>

        <ChildFilter className="mb-6" children={children} selected={selectedChildren} onToggle={toggleChild} />

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
                        return (
                          <div key={s.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-x-3 items-start py-3 px-1">
                            <time className="tabular-nums text-[0.9375rem] text-[var(--ink-soft)] pt-0.5">
                              {s.start_time ? formatTime(s.start_time) : "—"}
                            </time>
                            <div className="min-w-0">
                              <span className="block text-[0.975rem] font-semibold text-[var(--ink)] truncate leading-tight">{title}</span>
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
                              {log && hasReflection(log.learned, log.diary_notes) && (
                                <NotebookPen size={13} className="text-[var(--ink-faint)]" aria-label="Has reflection" />
                              )}
                            </div>
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
                              <span className="block text-[0.975rem] font-semibold text-[var(--ink)] truncate leading-tight">{title}</span>
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

      <AttendanceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        children={children}
        activities={activities}
        prefill={prefill}
        onSaved={refetchLogs}
      />
    </div>
  );
}
