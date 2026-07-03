"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Activity, Child, AttendanceStatus } from "@/lib/types";

export interface AttendancePrefill {
  id?: string;            // present → edit existing log (PATCH); absent → create (POST)
  activity_id?: string;
  child_id?: string;
  date?: string;
  status?: AttendanceStatus;
  start_time?: string | null;
  end_time?: string | null;
  sent_by?: string | null;
  fetcher?: string | null;
  instructor_name?: string | null;
  lesson_type?: string | null;
  location?: string | null;
  absence_reason?: string | null;
  learned?: string | null;
  diary_notes?: string | null;
}

interface AttForm {
  activity_id: string;
  child_id: string;
  date: string;
  status: AttendanceStatus;
  start_time: string;
  end_time: string;
  sent_by: string[];
  fetcher: string[];
  instructor_name: string;
  lesson_type: string;
  location: string;
  absence_reason: string;
  learned: string;
  diary_notes: string;
}

const ABSENCE_REASON_OPTIONS = ["Sick", "Cancelled", "Transport Issue", "Conflict", "Other"];
const LESSON_TYPE_OPTIONS = ["Normal", "Trial", "Replacement", "Online", "Sparring"];
const SENT_BY_OPTIONS = ["Zeya", "Atiqah", "Helper"];
const FETCHER_OPTIONS = SENT_BY_OPTIONS;
const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "attended", label: "Attended" },
  { value: "absent", label: "Absent" },
  { value: "cancelled_by_provider", label: "Cancelled" },
];

const parseSenders = (raw?: string | null): string[] =>
  raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : [];

const blankForm = (): AttForm => ({
  activity_id: "", child_id: "", date: "", status: "attended",
  start_time: "", end_time: "", sent_by: [], fetcher: [],
  instructor_name: "", lesson_type: "",
  location: "", absence_reason: "",
  learned: "", diary_notes: "",
});

function fromPrefill(p?: AttendancePrefill): AttForm {
  const f = blankForm();
  if (!p) return f;
  const senders = parseSenders(p.sent_by);
  const fetchers = parseSenders(p.fetcher);
  return {
    ...f,
    activity_id: p.activity_id ?? "",
    child_id: p.child_id ?? "",
    date: p.date ?? "",
    status: p.status ?? "attended",
    start_time: p.start_time ?? "",
    end_time: p.end_time ?? "",
    sent_by: senders,
    fetcher: fetchers,
    instructor_name: p.instructor_name ?? "",
    lesson_type: p.lesson_type || "",
    location: p.location ?? "",
    absence_reason: p.absence_reason ?? "",
    learned: p.learned ?? "",
    diary_notes: p.diary_notes ?? "",
  };
}

const actLabel = (a: Activity) => a.activity_name || a.institution || "Activity";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customSender, setCustomSender] = useState("");
  const [customFetcher, setCustomFetcher] = useState("");
  const [customLesson, setCustomLesson] = useState("");

  // Reset form whenever the modal opens (with fresh prefill)
  useEffect(() => {
    if (open) {
      setForm(fromPrefill(prefill));
      setError("");
      setCustomSender("");
      setCustomFetcher("");
      setCustomLesson("");
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
        end_time: form.end_time && form.end_time.trim() ? form.end_time : null,
        sent_by: form.sent_by.length ? form.sent_by.join(", ") : null,
        fetcher: form.fetcher.length ? form.fetcher.join(", ") : null,
        instructor_name: form.instructor_name || null,
        lesson_type: form.lesson_type || null,
        location: form.location || null,
        // Same column stores the absence reason (absent) or cancellation reason (cancelled).
        absence_reason: (form.status === "absent" || form.status === "cancelled_by_provider")
          ? form.absence_reason || null
          : null,
        learned: form.learned.trim() || null,
        diary_notes: form.diary_notes.trim() || null,
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

  async function deleteRecord() {
    if (!prefill?.id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/attendance-logs/${prefill.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Delete failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  // Match the Settings → Activities list: active activities only, filtered by
  // child. Keep the currently-selected activity even if it's since been dropped.
  const childActivities = activities.filter(
    a => (!form.child_id || a.child_id === form.child_id)
      && (a.status === "active" || a.id === form.activity_id)
  );
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
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Time</label>
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Time</label>
            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} />
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

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Lesson Type</label>
          <div className="flex flex-wrap items-center gap-2">
            {[...LESSON_TYPE_OPTIONS, ...(form.lesson_type && !LESSON_TYPE_OPTIONS.includes(form.lesson_type) ? [form.lesson_type] : [])].map(lt => {
              const active = form.lesson_type === lt;
              return (
                <button
                  key={lt}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, lesson_type: lt }))}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
                    active
                      ? "bg-[var(--text-primary)] text-white border-transparent"
                      : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {lt}
                </button>
              );
            })}
            <input
              type="text"
              value={customLesson}
              onChange={e => setCustomLesson(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = customLesson.trim();
                  if (v) setForm(f => ({ ...f, lesson_type: v }));
                  setCustomLesson("");
                }
              }}
              onBlur={() => {
                const v = customLesson.trim();
                if (v) setForm(f => ({ ...f, lesson_type: v }));
                setCustomLesson("");
              }}
              placeholder="+ Add other"
              className="w-28 px-3.5 py-2 text-sm rounded-full border border-dashed border-[var(--border)] bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:w-36 transition-all duration-150"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sender</label>
          <div className="flex flex-wrap items-center gap-2">
            {[...SENT_BY_OPTIONS, ...form.sent_by.filter(s => !SENT_BY_OPTIONS.includes(s))].map(s => {
              const active = form.sent_by.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    sent_by: active ? f.sent_by.filter(x => x !== s) : [...f.sent_by, s],
                  }))}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
                    active
                      ? "bg-[var(--text-primary)] text-white border-transparent"
                      : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            <input
              type="text"
              value={customSender}
              onChange={e => setCustomSender(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = customSender.trim();
                  if (v && !form.sent_by.includes(v)) setForm(f => ({ ...f, sent_by: [...f.sent_by, v] }));
                  setCustomSender("");
                }
              }}
              onBlur={() => {
                const v = customSender.trim();
                if (v && !form.sent_by.includes(v)) setForm(f => ({ ...f, sent_by: [...f.sent_by, v] }));
                setCustomSender("");
              }}
              placeholder="+ Add other"
              className="w-28 px-3.5 py-2 text-sm rounded-full border border-dashed border-[var(--border)] bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:w-36 transition-all duration-150"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Fetcher</label>
          <div className="flex flex-wrap items-center gap-2">
            {[...FETCHER_OPTIONS, ...form.fetcher.filter(s => !FETCHER_OPTIONS.includes(s))].map(s => {
              const active = form.fetcher.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    fetcher: active ? f.fetcher.filter(x => x !== s) : [...f.fetcher, s],
                  }))}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
                    active
                      ? "bg-[var(--text-primary)] text-white border-transparent"
                      : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            <input
              type="text"
              value={customFetcher}
              onChange={e => setCustomFetcher(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = customFetcher.trim();
                  if (v && !form.fetcher.includes(v)) setForm(f => ({ ...f, fetcher: [...f.fetcher, v] }));
                  setCustomFetcher("");
                }
              }}
              onBlur={() => {
                const v = customFetcher.trim();
                if (v && !form.fetcher.includes(v)) setForm(f => ({ ...f, fetcher: [...f.fetcher, v] }));
                setCustomFetcher("");
              }}
              placeholder="+ Add other"
              className="w-28 px-3.5 py-2 text-sm rounded-full border border-dashed border-[var(--border)] bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:w-36 transition-all duration-150"
            />
          </div>
        </div>

        {form.status === "absent" && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Absence Reason</label>
            <select value={form.absence_reason} onChange={e => setForm(f => ({ ...f, absence_reason: e.target.value }))} className={inputCls}>
              <option value="">Select reason</option>
              {ABSENCE_REASON_OPTIONS.map(ar => <option key={ar} value={ar}>{ar}</option>)}
            </select>
          </div>
        )}

        {form.status === "cancelled_by_provider" && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Cancellation Reason</label>
            <input
              type="text"
              value={form.absence_reason}
              onChange={e => setForm(f => ({ ...f, absence_reason: e.target.value }))}
              placeholder="Enter cancellation reason"
              className={inputCls}
            />
          </div>
        )}

        <div className="pt-1 border-t border-[var(--border)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 mt-3">Reflection</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">What was learned</label>
              <textarea
                value={form.learned}
                onChange={e => setForm(f => ({ ...f, learned: e.target.value }))}
                placeholder="Skills or topics from this session…"
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reflection / Notes</label>
              <textarea
                value={form.diary_notes}
                onChange={e => setForm(f => ({ ...f, diary_notes: e.target.value }))}
                placeholder="How did it go? Highlights, struggles, mood…"
                rows={3}
                className={`${inputCls} resize-y`}
              />
            </div>
          </div>
        </div>

        {confirmDelete ? (
          <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-900">Delete this attendance record?</p>
            <p className="text-xs text-red-700">This action cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <button onClick={deleteRecord} disabled={saving} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50">
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            {prefill?.id && (
              <button onClick={() => setConfirmDelete(true)} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors">Delete</button>
            )}
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>
              Confirm
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
