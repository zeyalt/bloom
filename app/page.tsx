"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
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

  function openConfirm(s: ScheduleWithDetails, day: WeekDay) {
    const a = s.activity!;
    setPrefill({
      activity_id: a.id,
      child_id: a.child_id,
      date: day.iso,
      status: "attended",
      start_time: s.start_time,
      duration_minutes: s.duration_minutes,
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
      duration_minutes: log.duration_minutes,
      sent_by: log.sent_by,
      instructor_name: log.instructor_name,
      lesson_number: log.lesson_number,
      level: log.level,
      location: log.location,
      diary_notes: log.diary_notes,
      absence_reason: log.absence_reason,
      remarks: log.remarks,
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
      .filter(s => s.is_active && s.activity && scheduleOccursOn(s, day) && childMatch(s.activity.child_id))
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
                        const instructor = log?.instructor_name ?? a.instructor_name;
                        const location = log?.location ?? s.location;
                        return (
                          <div key={key} className="border border-[var(--border)] rounded-xl p-3 bg-white flex items-start gap-3">
                            <div className="text-sm font-semibold text-[var(--text-primary)] w-16 shrink-0">
                              {s.start_time ? formatTime(s.start_time) : "—"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {child && <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={18} />}
                                <span className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {[a.activity_name ? a.institution : "", instructor, location].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <div className="shrink-0">
                              {log ? (
                                <button onClick={() => openEditLog(log)} title="Edit attendance">
                                  <Badge label={ATTENDANCE_STATUS_LABELS[log.status]} variant={statusVariant(log.status)} />
                                </button>
                              ) : (
                                <Button size="sm" variant="secondary" onClick={() => openConfirm(s, day)}>
                                  <Check size={14} /> Confirm
                                </Button>
                              )}
                            </div>
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
    </div>
  );
}
