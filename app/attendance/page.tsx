"use client";

import { useState } from "react";
import { Plus, Download, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { formatDate, cn } from "@/lib/utils";
import { exportAttendanceCSV } from "@/lib/export-csv";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { useChildren, useActivities, useAttendanceLogs } from "@/lib/api-hooks";
import type { AttendanceLog, Activity, ActivityCategory, Child } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const [filterChild, setFilterChild] = useState("");
  const [filterActivity, setFilterActivity] = useState("");

  // Fetch data using React Query hooks
  const { data: childrenData = [] } = useChildren();
  const { data: activitiesData = [] } = useActivities();
  const { data: logsData = [], isLoading } = useAttendanceLogs({
    limit: 200,
    childId: filterChild || undefined,
    activityId: filterActivity || undefined,
  });

  const children = childrenData;
  const activities = activitiesData;
  const logs = logsData;
  const loading = isLoading;

  async function fetchAll() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
    await queryClient.invalidateQueries({ queryKey: ["activities"] });
    await queryClient.invalidateQueries({ queryKey: ["children"] });
  }

  function openAdd() {
    setPrefill({ date: new Date().toISOString().split("T")[0], status: "attended" });
    setModalOpen(true);
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
      instructor_name: log.instructor_name,
      lesson_type: log.lesson_type,
      location: log.location,
      absence_reason: log.absence_reason,
    });
    setModalOpen(true);
  }

  // Filter logs by selected child
  const filteredLogs = filterChild
    ? logs.filter(l => l.child_id === filterChild)
    : logs.filter(l => filterActivity ? l.activity_id === filterActivity : true);

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <Header title="Attendance" subtitle="All sessions logged" />

      <div className="px-5 md:px-8 pt-4 md:pt-6">
        {/* Child filter pills + actions */}
        <div className="flex flex-wrap gap-2 mb-6 items-center justify-between">
          <div className="flex flex-wrap gap-2">
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
          <div className="flex gap-1.5 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => exportAttendanceCSV(filteredLogs, `attendance-${new Date().toISOString().split('T')[0]}.csv`)}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" size="sm" onClick={openAdd}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>

        {/* Activity filter dropdown (secondary) */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Activity (optional)</label>
          <select
            value={filterActivity}
            onChange={e => setFilterActivity(e.target.value)}
            className="w-full max-w-sm px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
          >
            <option value="">All activities</option>
            {activities.map(a => (
              <option key={a.id} value={a.id}>
                {[a.activity_name, a.institution].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No attendance records</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Time</th>
                  <th className="px-3 py-2 text-left font-semibold">Activity</th>
                  <th className="px-3 py-2 text-left font-semibold">Institution</th>
                  <th className="px-3 py-2 text-left font-semibold">Level</th>
                  <th className="px-3 py-2 text-left font-semibold">Coach</th>
                  <th className="px-3 py-2 text-left font-semibold">Lesson Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Sent By</th>
                  <th className="px-3 py-2 text-center font-semibold">Status</th>
                  <th className="px-3 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{formatDate(log.date)}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{log.start_time || "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">{log.activity?.activity_name || "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{log.activity?.institution || "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{log.activity?.level || "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{log.instructor_name || "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{log.lesson_type || "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{log.sent_by || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        label={ATTENDANCE_STATUS_LABELS[log.status]}
                        variant={log.status === "attended" ? "success" : log.status === "absent" ? "danger" : "default"}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => openEdit(log)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] transition-colors"
                        title="Edit attendance"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AttendanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          children={children}
          activities={activities}
          prefill={prefill}
          onSaved={fetchAll}
          title={prefill?.id ? "Edit Attendance" : "Add Attendance"}
        />
      </div>
    </div>
  );
}
