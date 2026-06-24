"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SENDERS } from "@/lib/constants";
import type { Activity, Child, AttendanceStatus } from "@/lib/types";

export interface AttendancePrefill {
  id?: string;            // present → edit existing log (PATCH); absent → create (POST)
  activity_id?: string;
  child_id?: string;
  date?: string;
  status?: AttendanceStatus;
  start_time?: string | null;
  duration_minutes?: number | string | null;
  sent_by?: string | null;
  instructor_name?: string | null;
  lesson_number?: string | null;
  level?: string | null;
  location?: string | null;
  diary_notes?: string | null;
  absence_reason?: string | null;
  remarks?: string | null;
}

interface AttForm {
  activity_id: string;
  child_id: string;
  date: string;
  status: AttendanceStatus;
  start_time: string;
  duration_minutes: string;
  sent_by: string;
  instructor_name: string;
  lesson_number: string;
  level: string;
  location: string;
  diary_notes: string;
  absence_reason: string;
  remarks: string;
}

const blankForm = (): AttForm => ({
  activity_id: "", child_id: "", date: "", status: "attended",
  start_time: "", duration_minutes: "", sent_by: "", instructor_name: "",
  lesson_number: "", level: "", location: "", diary_notes: "",
  absence_reason: "", remarks: "",
});

function fromPrefill(p?: AttendancePrefill): AttForm {
  const f = blankForm();
  if (!p) return f;
  return {
    ...f,
    activity_id: p.activity_id ?? "",
    child_id: p.child_id ?? "",
    date: p.date ?? "",
    status: p.status ?? "attended",
    start_time: p.start_time ?? "",
    duration_minutes: p.duration_minutes != null ? String(p.duration_minutes) : "",
    sent_by: p.sent_by ?? "",
    instructor_name: p.instructor_name ?? "",
    lesson_number: p.lesson_number ?? "",
    level: p.level ?? "",
    location: p.location ?? "",
    diary_notes: p.diary_notes ?? "",
    absence_reason: p.absence_reason ?? "",
    remarks: p.remarks ?? "",
  };
}

const actLabel = (a: Activity) =>
  [a.activity_name, a.institution].filter(Boolean).join(" · ") || "Activity";

interface Props {
  open: boolean;
  onClose: () => void;
  children: Child[];
  activities: Activity[];
  prefill?: AttendancePrefill;
  onSaved: () => void;
  title?: string;
}

export function AttendanceModal({ open, onClose, children, activities, prefill, onSaved, title }: Props) {
  const [form, setForm] = useState<AttForm>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form whenever the modal opens (with fresh prefill)
  useEffect(() => {
    if (open) {
      setForm(fromPrefill(prefill));
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        duration_minutes: form.duration_minutes || null,
        sent_by: form.sent_by || null,
        instructor_name: form.instructor_name || null,
        lesson_number: form.lesson_number || null,
        level: form.level || null,
        location: form.location || null,
        diary_notes: form.diary_notes || null,
        absence_reason: form.absence_reason || null,
        remarks: form.remarks || null,
      };
      const editing = !!prefill?.id;
      const res = await fetch(
        editing ? `/api/attendance-logs/${prefill!.id}` : "/api/attendance-logs",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const childActivities = activities.filter(a => !form.child_id || a.child_id === form.child_id);
  const inputCls =
    "w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20";

  return (
    <Modal open={open} onClose={onClose} title={title ?? (prefill?.id ? "Edit Attendance" : "Confirm Attendance")}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Child *</label>
            <select value={form.child_id} onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))} className={inputCls}>
              <option value="">Select child</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Activity *</label>
            <select value={form.activity_id} onChange={e => setForm(f => ({ ...f, activity_id: e.target.value }))} className={inputCls}>
              <option value="">Select activity</option>
              {childActivities.map(a => <option key={a.id} value={a.id}>{actLabel(a)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Status *</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AttendanceStatus }))} className={inputCls}>
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
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start time</label>
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Duration (min)</label>
            <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="e.g. 60" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sent by</label>
            <select value={form.sent_by} onChange={e => setForm(f => ({ ...f, sent_by: e.target.value }))} className={inputCls}>
              <option value="">—</option>
              {SENDERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Instructor</label>
            <input type="text" value={form.instructor_name} onChange={e => setForm(f => ({ ...f, instructor_name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Location</label>
            <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Lesson number</label>
            <input type="text" value={form.lesson_number} onChange={e => setForm(f => ({ ...f, lesson_number: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Level</label>
            <input type="text" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Diary notes</label>
          <textarea value={form.diary_notes} onChange={e => setForm(f => ({ ...f, diary_notes: e.target.value }))} placeholder="Session notes, progress, observations..." rows={2} className={`${inputCls} resize-none`} />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Remarks</label>
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Any other notes..." rows={1} className={`${inputCls} resize-none`} />
        </div>

        {form.status === "absent" && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Absence reason</label>
            <input type="text" value={form.absence_reason} onChange={e => setForm(f => ({ ...f, absence_reason: e.target.value }))} className={inputCls} />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} loading={saving}>
            {prefill?.id ? "Save changes" : "Save attendance"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
