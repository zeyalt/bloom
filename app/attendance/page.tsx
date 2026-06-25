"use client";

import { useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { formatDate, cn } from "@/lib/utils";
import { exportAttendanceCSV } from "@/lib/export-csv";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import type { AttendanceLog, Activity, ActivityCategory, Child } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

export default function AttendancePage() {
  const [logs, setLogs] = useState<LogWithDetails[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const [filterChild, setFilterChild] = useState("");
  const [filterActivity, setFilterActivity] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const [logsRes, actsRes, childRes] = await Promise.all([
        fetch(
          `/api/attendance-logs?limit=200${filterChild ? `&child_id=${filterChild}` : ""}${filterActivity ? `&activity_id=${filterActivity}` : ""}`
        ).then(r => r.json()),
        fetch("/api/activities").then(r => r.json()),
        fetch("/api/children").then(r => r.json()),
      ]);
      setLogs(logsRes.data || []);
      setActivities(Array.isArray(actsRes) ? actsRes : []);
      setChildren(Array.isArray(childRes) ? childRes : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [filterChild, filterActivity]);

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
    <div className="max-w-[1200px] mx-auto w-full">
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

        {/* Logs list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No attendance records</p>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {filteredLogs.map(log => (
              <button
                key={log.id}
                onClick={() => openEdit(log)}
                className="w-full text-left border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-card)] hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)]">{formatDate(log.date)}</span>
                      {log.child && (
                        <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                          <Avatar avatarKey={log.child.avatar_key} fallbackEmoji={log.child.avatar_emoji} size={18} />
                          {log.child.name}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {[log.activity?.activity_name, log.activity?.institution].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 space-x-2">
                      {log.start_time && <span>{log.start_time}</span>}
                      {log.end_time && <span>· {log.end_time}</span>}
                      {log.instructor_name && <span>· {log.instructor_name}</span>}
                      {log.lesson_type && <span>· {log.lesson_type}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      label={ATTENDANCE_STATUS_LABELS[log.status]}
                      variant={log.status === "attended" ? "success" : log.status === "absent" ? "danger" : "default"}
                    />
                  </div>
                </div>
              </button>
            ))}
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
