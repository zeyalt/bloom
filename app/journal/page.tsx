"use client";

import { useState } from "react";
import { Pencil, NotebookPen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { formatDate, cn } from "@/lib/utils";
import { useChildren, useActivities, useAttendanceLogs } from "@/lib/api-hooks";
import type { AttendanceLog, Activity, ActivityCategory, Child } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

const hasReflection = (l: AttendanceLog) => !!(l.learned || l.diary_notes);

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [filterChild, setFilterChild] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);

  const { data: childrenData = [] } = useChildren();
  const { data: activitiesData = [] } = useActivities();
  const { data: logsData = [], isLoading } = useAttendanceLogs({ limit: 300 });

  const children = childrenData;
  const activities = activitiesData;

  async function fetchAll() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
  }

  function openEdit(log: LogWithDetails) {
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
      learned: log.learned,
      diary_notes: log.diary_notes,
    });
    setModalOpen(true);
  }

  const entries = (logsData as LogWithDetails[])
    .filter(hasReflection)
    .filter(l => !filterChild || l.child_id === filterChild)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.start_time || "").localeCompare(a.start_time || ""));

  return (
    <div className="max-w-[900px] mx-auto w-full">
      <Header title="Journal" subtitle="Reflections & what they've learned" />

      <div className="px-5 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">
        {/* Child filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterChild("")}
            className={cn(
              "px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
              !filterChild ? "bg-[var(--text-primary)] text-white border-transparent" : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
            )}
          >
            All
          </button>
          {children.map(child => {
            const active = filterChild === child.id;
            return (
              <button
                key={child.id}
                onClick={() => setFilterChild(child.id)}
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

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-[var(--bg-secondary)] rounded-2xl animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <NotebookPen size={28} className="mx-auto mb-3 opacity-60" />
            <p className="text-sm">No reflections yet.</p>
            <p className="text-xs mt-1">Add “What was learned” or a reflection when confirming a session.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(log => {
              const child = log.child ?? children.find(c => c.id === log.child_id);
              const title = log.activity?.activity_name || log.activity?.institution || "Activity";
              const secondary = log.activity?.institution && log.activity.institution !== title ? log.activity.institution : "";
              return (
                <div key={log.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--bg-card)] p-4 md:p-5 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{formatDate(log.date)}</span>
                        {child && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${child.color_code}1a`, color: child.color_code }}>
                            {child.name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">
                        {title}{secondary && <span className="text-[var(--text-muted)]"> · {secondary}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => openEdit(log)}
                      className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      title="Edit reflection"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>

                  {log.learned && (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Learned</p>
                      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap mt-0.5">{log.learned}</p>
                    </div>
                  )}
                  {log.diary_notes && (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Reflection</p>
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mt-0.5">{log.diary_notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AttendanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          children={children}
          activities={activities}
          prefill={prefill}
          onSaved={fetchAll}
          title="Edit Reflection"
        />
      </div>
    </div>
  );
}
