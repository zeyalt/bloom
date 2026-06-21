"use client";

import { useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatTime } from "@/lib/utils";
import { exportAttendanceCSV } from "@/lib/export-csv";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS, SENDERS } from "@/lib/constants";
import type { AttendanceLog, Activity, ActivityCategory, Child, AttendanceStatus } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

const EMPTY_FORM = {
  activity_id: "",
  child_id: "",
  date: "",
  status: "attended" as AttendanceStatus,
  start_time: "",
  duration_minutes: "",
  sent_by: "",
  instructor_name: "",
  lesson_number: "",
  level: "",
  location: "",
  diary_notes: "",
  absence_reason: "",
  remarks: "",
};

export default function AttendancePage() {
  const [logs, setLogs] = useState<LogWithDetails[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.activity_id || !form.child_id || !form.date) {
      setError("Activity, child, and date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        activity_id: form.activity_id,
        child_id: form.child_id,
        date: form.date,
        status: form.status,
        start_time: form.start_time || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        sent_by: form.sent_by || null,
        instructor_name: form.instructor_name || null,
        lesson_number: form.lesson_number || null,
        level: form.level || null,
        location: form.location || null,
        diary_notes: form.diary_notes || null,
        absence_reason: form.absence_reason || null,
        remarks: form.remarks || null,
      };
      const res = await fetch("/api/attendance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      setShowForm(false);
      fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Attendance" subtitle="All sessions logged" />

      <div className="px-5 md:px-8 pt-4 md:pt-6">
        {/* Filters and actions - all in one row */}
        <div className="flex flex-row gap-2 mb-8 items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Child</label>
            <select
              value={filterChild}
              onChange={e => setFilterChild(e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
            >
              <option value="">All children</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>
                  {c.avatar_emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Activity</label>
            <select
              value={filterActivity}
              onChange={e => setFilterActivity(e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
            >
              <option value="">All activities</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>
                  {a.institution}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => exportAttendanceCSV(logs, `attendance-${new Date().toISOString().split('T')[0]}.csv`)}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" size="sm" onClick={openAdd}>
              <Plus size={14} /> Log
            </Button>
          </div>
        </div>

        {/* Logs list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No attendance records</p>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {logs.map(log => (
              <div
                key={log.id}
                className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-card)] hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Left: Date, child, activity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatDate(log.date)}
                      </span>
                      {log.child && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: log.child.color_code }}
                        />
                      )}
                      {log.child && (
                        <span className="text-sm text-[var(--text-secondary)]">
                          {log.child.avatar_emoji} {log.child.name}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {log.activity?.institution}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 space-x-2">
                      {log.start_time && <span>{log.start_time}</span>}
                      {log.duration_minutes && <span>· {log.duration_minutes} min</span>}
                      {log.instructor_name && <span>· {log.instructor_name}</span>}
                      {log.lesson_number && <span>· L{log.lesson_number}</span>}
                      {log.level && <span>· {log.level}</span>}
                    </div>
                  </div>

                  {/* Right: Status and notes */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      label={ATTENDANCE_STATUS_LABELS[log.status]}
                      variant={
                        log.status === "attended"
                          ? "success"
                          : log.status === "absent"
                            ? "danger"
                            : "default"
                      }
                    />
                    {log.diary_notes && (
                      <div className="text-xs text-[var(--text-secondary)] max-w-xs text-right line-clamp-2">
                        {log.diary_notes}
                      </div>
                    )}
                    {log.remarks && (
                      <div className="text-xs text-[var(--text-muted)] max-w-xs text-right line-clamp-1">
                        {log.remarks}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Log session modal */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title="Log Session">
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Child *
                </label>
                <select
                  value={form.child_id}
                  onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                >
                  <option value="">Select child</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.avatar_emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Activity *
                </label>
                <select
                  value={form.activity_id}
                  onChange={e => setForm(f => ({ ...f, activity_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                >
                  <option value="">Select activity</option>
                  {activities
                    .filter(a => !form.child_id || a.child_id === form.child_id)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.institution}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Status *
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as AttendanceStatus }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                >
                  <option value="attended">Attended</option>
                  <option value="absent">Absent</option>
                  <option value="replacement">Replacement</option>
                  <option value="trial">Trial</option>
                  <option value="grading">Grading</option>
                  <option value="online">Online</option>
                  <option value="sparring">Sparring</option>
                  <option value="competition">Competition</option>
                  <option value="cancelled_by_provider">Cancelled</option>
                  <option value="league_game">League Game</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={form.duration_minutes}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                  placeholder="e.g. 60"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Sent by
                </label>
                <select
                  value={form.sent_by}
                  onChange={e => setForm(f => ({ ...f, sent_by: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                >
                  <option value="">—</option>
                  {SENDERS.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Instructor
                </label>
                <input
                  type="text"
                  value={form.instructor_name}
                  onChange={e => setForm(f => ({ ...f, instructor_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Level
                </label>
                <input
                  type="text"
                  value={form.level}
                  onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Lesson number
                </label>
                <input
                  type="text"
                  value={form.lesson_number}
                  onChange={e => setForm(f => ({ ...f, lesson_number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Diary notes
              </label>
              <textarea
                value={form.diary_notes}
                onChange={e => setForm(f => ({ ...f, diary_notes: e.target.value }))}
                placeholder="Session notes, progress, observations..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Remarks
              </label>
              <textarea
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Any other notes..."
                rows={1}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 resize-none"
              />
            </div>

            {form.status === "absent" && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Absence reason
                </label>
                <input
                  type="text"
                  value={form.absence_reason}
                  onChange={e => setForm(f => ({ ...f, absence_reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} loading={saving}>
                Log Session
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
