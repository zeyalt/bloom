"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { ScheduleSlotModal } from "@/components/schedule/ScheduleSlotModal";
import { cn, formatTime } from "@/lib/utils";
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
  const [selectedChild, setSelectedChild] = useState(""); // "" = all
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const [slotEdit, setSlotEdit] = useState<ScheduleWithDetails | null>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);

  const range = getWeekRange(weekOffset);
  const week = getWeekDays(weekOffset);

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

  // On first load of the current week, jump to today so the user lands on the
  // current day (not Sunday). Earlier days remain above to scroll back to.
  useEffect(() => {
    if (loading || weekOffset !== 0 || hasScrolledToToday.current) return;
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: "start" });
      hasScrolledToToday.current = true;
    }
  }, [loading, weekOffset]);

  async function fetchData() {
    // Invalidate queries to refetch fresh data
    await queryClient.invalidateQueries({ queryKey: ["children"] });
    await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    await queryClient.invalidateQueries({ queryKey: ["activities"] });
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
  }

  // Index logs by occurrence key
  const logsByKey = new Map<string, LogWithDetails>();
  for (const log of logs) {
    logsByKey.set(occurrenceKey(log.activity_id, log.child_id, log.date.slice(0, 10), log.start_time), log);
  }

  const childMatch = (childId: string) => !selectedChild || childId === selectedChild;

  async function quickAttend(s: ScheduleWithDetails, day: WeekDay) {
    const a = s.activity!;
    try {
      const res = await fetch("/api/attendance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: a.id,
          child_id: a.child_id,
          date: day.iso,
          status: "attended",
          start_time: s.start_time,
          end_time: s.end_time,
          instructor_name: a.instructor_name,
          location: s.location,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      fetchData();
    } catch (e) {
      console.error("Failed to save attendance:", e);
    }
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

  function openConfirm(s: ScheduleWithDetails, day: WeekDay) {
    const a = s.activity!;
    setPrefill({
      activity_id: a.id,
      child_id: a.child_id,
      date: day.iso,
      status: "attended",
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
      instructor_name: log.instructor_name,
      lesson_type: log.lesson_type,
      location: log.location,
      absence_reason: log.absence_reason,
    });
    setModalOpen(true);
  }

  function openAdhoc() {
    setPrefill({ date: week.find(d => d.isToday)?.iso ?? week[0].iso, status: "attended" });
    setModalOpen(true);
  }

  // Build per-day items
  const scheduledKeys = new Set<string>();
  const dayBlocks = week.map(day => {
    const occ = schedules
      .filter(s => {
        if (!s.is_active || !s.activity) return false;
        if (!scheduleOccursOn(s, day)) return false;
        if (!childMatch(s.activity.child_id)) return false;
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
    if (!childMatch(log.child_id)) continue;
    const arr = adhocByDay.get(iso) ?? [];
    arr.push(log);
    adhocByDay.set(iso, arr);
  }

  return (
    <div className="max-w-[1000px] mx-auto w-full">
      <Header title="Home" subtitle="Track attendance & plan your week" sticky />

      <div className="px-5 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">
        {/* Week nav + add */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors" title="Previous week">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setWeekOffset(0)} className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors", weekOffset === 0 ? "border-[var(--accent-primary)] text-[var(--accent-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]")}>
              This week
            </button>
            <button onClick={() => setWeekOffset(o => o + 1)} className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors" title="Next week">
              <ChevronRight size={16} />
            </button>
          </div>
          <Button size="sm" onClick={openAdhoc}><Plus size={14} /> Add event</Button>
        </div>

        <p className="text-sm font-medium text-[var(--text-secondary)] mb-4">{range.label}</p>

        {/* Child toggle pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedChild("")}
            className={cn(
              "px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
              !selectedChild ? "bg-[var(--text-primary)] text-white border-transparent" : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
            )}
          >
            All
          </button>
          {children.map(child => {
            const active = selectedChild === child.id;
            return (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child.id)}
                style={active ? { backgroundColor: child.color_code } : undefined}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
                  active ? "text-white border-transparent" : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
                )}
              >
                <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={20} />
                {child.name}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {dayBlocks.map(({ day, occ }) => {
              const adhoc = adhocByDay.get(day.iso) ?? [];
              const hasItems = occ.length > 0 || adhoc.length > 0;
              return (
                <div key={day.iso} ref={day.isToday ? todayRef : undefined} className="scroll-mt-28 md:scroll-mt-32">
                  <div className="pb-3">
                    <div className="flex items-baseline gap-3">
                      <h2 className={cn("font-bold uppercase tracking-wider", day.isToday ? "text-lg text-[var(--accent-primary)]" : "text-base text-[var(--text-primary)]")}>
                        {day.fullLabel}
                      </h2>
                      <span className={cn("text-sm", day.isToday ? "text-[var(--accent-primary)] font-semibold" : "text-[var(--text-muted)]")}>
                        {day.date.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                      </span>
                      {day.isToday && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-primary)] text-white">
                          Today
                        </span>
                      )}
                    </div>
                  </div>

                  {!hasItems ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-[var(--text-muted)]">No activities scheduled</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {occ.map(({ key, schedule: s }) => {
                        const a = s.activity!;
                        const child = a.child;
                        const log = logsByKey.get(key);
                        const title = a.activity_name || a.institution;
                        return (
                          <div
                            key={s.id}
                            className="border border-[var(--border)] rounded-xl bg-white select-none overflow-hidden transition-shadow duration-200 hover:shadow-md"
                          >
                            {/* Main card content */}
                            <div className="p-4">
                              <div className="flex items-center gap-3 justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  <div className="text-sm font-bold text-[var(--text-primary)] font-mono tabular-nums shrink-0">
                                    {s.start_time ? formatTime(s.start_time) : "—"}
                                  </div>
                                  <span className="text-base font-semibold text-[var(--text-primary)]">
                                    {title}
                                    {(a.institution || a.instructor_name) && <span className="text-[var(--text-secondary)] font-normal"> · {a.institution || a.instructor_name}</span>}
                                  </span>
                                </div>
                                {log && (
                                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black text-white">
                                    <Check size={12} /> Updated
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            {!log && (
                              <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3 flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPrefill({ activity_id: a.id, child_id: a.child_id, date: day.iso, status: "attended", start_time: s.start_time, end_time: s.end_time, instructor_name: a.instructor_name, location: s.location }); setModalOpen(true); }}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-green-500 text-white active:scale-95 active:bg-green-600 hover:bg-green-600 transition-all duration-150"
                                  title="Mark as attended"
                                >
                                  <Check size={14} /> Attended
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAbsentModal(s, day); }}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500 text-white active:scale-95 active:bg-red-600 hover:bg-red-600 transition-all duration-150"
                                  title="Mark as absent"
                                >
                                  <X size={14} /> Absent
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {adhoc.map(log => {
                        const a = log.activity;
                        const title = a?.activity_name || a?.institution || "Activity";
                        return (
                          <div
                            key={log.id}
                            onClick={() => openEditLog(log)}
                            className="border border-[var(--border)] rounded-xl bg-white select-none overflow-hidden transition-shadow duration-200 hover:shadow-md cursor-pointer"
                          >
                            <div className="p-4">
                              <div className="flex items-center gap-3 justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  <div className="text-sm font-bold text-[var(--text-primary)] font-mono tabular-nums shrink-0">
                                    {log.start_time ? formatTime(log.start_time) : "—"}
                                  </div>
                                  <span className="text-base font-semibold text-[var(--text-primary)]">
                                    {title}
                                    {(a?.institution || a?.instructor_name) && <span className="text-[var(--text-secondary)] font-normal"> · {a?.institution || a?.instructor_name}</span>}
                                  </span>
                                </div>
                                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black text-white">
                                  <Check size={12} /> Updated
                                </span>
                              </div>
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
        onSaved={fetchData}
      />

      <ScheduleSlotModal
        open={!!slotEdit}
        onClose={() => setSlotEdit(null)}
        schedule={slotEdit}
        title={slotEdit?.activity ? [slotEdit.activity.activity_name, slotEdit.activity.institution].filter(Boolean).join(" · ") : undefined}
        onSaved={fetchData}
      />
    </div>
  );
}
