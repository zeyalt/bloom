"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Check, Pencil, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { ScheduleSlotModal } from "@/components/schedule/ScheduleSlotModal";
import { cn, formatTime } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { getWeekDays, getWeekRange, scheduleOccursOn, occurrenceKey, WeekDay } from "@/lib/week";
import type { Schedule, Activity, ActivityCategory, Child, AttendanceLog } from "@/lib/types";

interface ScheduleWithDetails extends Schedule {
  activity?: Activity & { child?: Child; category?: ActivityCategory };
}
interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

function statusVariant(status: string): "success" | "danger" | "default" {
  return status === "attended" ? "success" : status === "absent" ? "danger" : "default";
}

export default function AgendaPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<LogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedChild, setSelectedChild] = useState(""); // "" = all
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const [slotEdit, setSlotEdit] = useState<ScheduleWithDetails | null>(null);
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null);
  const [swipeTouchStartX, setSwipeTouchStartX] = useState(0);

  const range = getWeekRange(weekOffset);
  const week = getWeekDays(weekOffset);

  async function fetchData() {
    setLoading(true);
    try {
      const [childRes, schedRes, actRes, logRes] = await Promise.all([
        fetch("/api/children").then(r => r.json()),
        fetch("/api/schedules").then(r => r.json()),
        fetch("/api/activities").then(r => r.json()),
        fetch(`/api/attendance-logs?from=${range.from}&to=${range.to}&limit=500`).then(r => r.json()),
      ]);
      setChildren(Array.isArray(childRes) ? childRes : []);
      setSchedules(Array.isArray(schedRes) ? schedRes : []);
      setActivities(Array.isArray(actRes) ? actRes : []);
      setLogs(logRes.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [weekOffset]);

  // Index logs by occurrence key
  const logsByKey = new Map<string, LogWithDetails>();
  for (const log of logs) {
    logsByKey.set(occurrenceKey(log.activity_id, log.child_id, log.date.slice(0, 10)), log);
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

  function handleCardTouchStart(e: React.TouchEvent, cardId: string) {
    setSwipeTouchStartX(e.touches[0].clientX);
  }

  function handleCardTouchMove(e: React.TouchEvent, cardId: string) {
    if (swipeTouchStartX === 0) return;
    const currentX = e.touches[0].clientX;
    const diff = swipeTouchStartX - currentX;
    // Swipe left detected (drag left ~50px)
    if (diff > 50 && swipedCardId !== cardId) {
      setSwipedCardId(cardId);
    }
  }

  function handleCardTouchEnd() {
    setSwipeTouchStartX(0);
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
        const key = occurrenceKey(s.activity!.id, s.activity!.child_id, day.iso);
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
    const key = occurrenceKey(log.activity_id, log.child_id, iso);
    if (scheduledKeys.has(key)) continue;
    if (!childMatch(log.child_id)) continue;
    const arr = adhocByDay.get(iso) ?? [];
    arr.push(log);
    adhocByDay.set(iso, arr);
  }

  return (
    <div className="max-w-[1000px] mx-auto w-full">
      <Header title="Schedule" subtitle="Weekly agenda & attendance" />

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
          <div className="space-y-5">
            {dayBlocks.map(({ day, occ }) => {
              const adhoc = adhocByDay.get(day.iso) ?? [];
              const hasItems = occ.length > 0 || adhoc.length > 0;
              return (
                <div key={day.iso}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className={cn("text-sm font-bold uppercase tracking-wide", day.isToday ? "text-[var(--accent-primary)]" : "text-[var(--text-primary)]")}>
                      {day.fullLabel}
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">
                      {day.date.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                      {day.isToday && " · Today"}
                    </span>
                  </div>

                  {!hasItems ? (
                    <p className="text-xs text-[var(--text-muted)] pl-0.5">No sessions</p>
                  ) : (
                    <div className="space-y-2">
                      {occ.map(({ key, schedule: s }) => {
                        const a = s.activity!;
                        const child = a.child;
                        const log = logsByKey.get(key);
                        const title = a.activity_name || a.institution;
                        const isOpen = swipedCardId === s.id;
                        return (
                          <div
                            key={s.id}
                            className="border border-[var(--border)] rounded-xl bg-white overflow-hidden cursor-pointer transition-all"
                            onTouchStart={(e) => handleCardTouchStart(e, s.id)}
                            onTouchMove={(e) => handleCardTouchMove(e, s.id)}
                            onTouchEnd={handleCardTouchEnd}
                            onClick={() => !isOpen && setSwipedCardId(null)}
                          >
                            {/* Main card content */}
                            <div className={cn("p-3 flex items-start gap-3 transition-opacity", isOpen && "opacity-40")}>
                              <div className="text-sm font-semibold text-[var(--text-primary)] w-16 shrink-0">
                                {s.start_time ? formatTime(s.start_time) : "—"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {child && <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={18} />}
                                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</span>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.institution}</p>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSlotEdit(s); }}
                                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                  title="Edit schedule slot"
                                >
                                  <Pencil size={14} />
                                </button>
                                {log && (
                                  <button onClick={(e) => { e.stopPropagation(); openEditLog(log); }} title="Edit attendance">
                                    <Badge label={ATTENDANCE_STATUS_LABELS[log.status]} variant={statusVariant(log.status)} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Swipe reveal panel */}
                            {!log && isOpen && (
                              <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3 flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); quickAttend(s, day); setSwipedCardId(null); }}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                                  title="Mark as attended"
                                >
                                  <Check size={14} /> Attended
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAbsentModal(s, day); setSwipedCardId(null); }}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
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
                        const title = log.activity?.activity_name || log.activity?.institution || "Activity";
                        return (
                          <div key={log.id} className="border border-[var(--border)] rounded-xl p-3 bg-white flex items-start gap-3">
                            <div className="text-sm font-semibold text-[var(--text-primary)] w-16 shrink-0">
                              {log.start_time ? formatTime(log.start_time) : "—"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {log.child && <Avatar avatarKey={log.child.avatar_key} fallbackEmoji={log.child.avatar_emoji} size={18} />}
                                <span className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</span>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">Ad-hoc</span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {[log.instructor_name, log.location].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <button className="shrink-0" onClick={() => openEditLog(log)} title="Edit attendance">
                              <Badge label={ATTENDANCE_STATUS_LABELS[log.status]} variant={statusVariant(log.status)} />
                            </button>
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
