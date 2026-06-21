"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatTime } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { Schedule, Activity, ActivityCategory, Child } from "@/lib/types";

interface Props {
  schedules: Schedule[];
  activities: Activity[];
  onRefresh: () => void;
}

const EMPTY_FORM = {
  activity_id: "",
  day_of_week: 1 as number,
  start_time: "",
  end_time: "",
  location: "",
  is_active: true,
  notes: "",
};

function dayLabel(n: number) {
  return DAYS_OF_WEEK.find(d => d.value === n)?.label ?? String(n);
}

export function SchedulesTab({ schedules, activities, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Schedule | null>(null);

  // Only show active activities in the dropdown (but show all in existing schedule rows)
  const activeActivities = activities.filter(a => a.status === "active");

  function openAdd() {
    setForm({ ...EMPTY_FORM, activity_id: activeActivities[0]?.id ?? "" });
    setEditing(null); setError(""); setShowForm(true);
  }

  function openEdit(s: Schedule) {
    setForm({
      activity_id: s.activity_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time ?? "",
      location: s.location ?? "",
      is_active: s.is_active,
      notes: s.notes ?? "",
    });
    setEditing(s); setError(""); setShowForm(true);
  }

  async function save() {
    if (!form.activity_id) { setError("Activity is required."); return; }
    if (!form.start_time) { setError("Start time is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        activity_id: form.activity_id,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time || null,
        location: form.location || null,
        is_active: form.is_active,
        notes: form.notes || null,
      };
      const url = editing ? `/api/schedules/${editing.id}` : "/api/schedules";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
      setShowForm(false); onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteSchedule(s: Schedule) {
    await fetch(`/api/schedules/${s.id}`, { method: "DELETE" });
    setConfirmDelete(null); onRefresh();
  }

  // Group schedules by activity
  const byActivity = activities
    .map(act => ({
      activity: act,
      schedules: schedules.filter(s => s.activity_id === act.id),
    }))
    .filter(g => g.schedules.length > 0);

  const unattached = schedules.filter(s => !activities.find(a => a.id === s.activity_id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-secondary)]">{schedules.length} schedule slots</p>
        <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Slot</Button>
      </div>

      {byActivity.map(({ activity: act, schedules: slots }) => {
        const child = act.child as Child | undefined;
        const category = act.category as ActivityCategory | undefined;
        return (
          <div key={act.id} className="mb-4 border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Activity header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)]">
              {child && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} />
              )}
              <span className="text-sm font-medium text-[var(--text-primary)]">{act.institution}</span>
              {category && (
                <span className="text-xs text-[var(--text-muted)]">· {category.name}</span>
              )}
              {act.status !== "active" && (
                <Badge label={act.status} variant="muted" />
              )}
            </div>

            {/* Schedule rows */}
            <div className="divide-y divide-[var(--border)]">
              {slots.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)] w-8 shrink-0">
                    {dayLabel(s.day_of_week)}
                  </span>
                  <span className="text-sm text-[var(--text-primary)] flex-1">
                    {formatTime(s.start_time)}
                    {s.end_time && <span className="text-[var(--text-muted)]"> – {formatTime(s.end_time)}</span>}
                    {s.location && <span className="text-xs text-[var(--text-muted)] ml-2">@ {s.location}</span>}
                  </span>
                  {!s.is_active && <Badge label="Inactive" variant="muted" />}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      title="Edit"
                    ><Pencil size={14} /></button>
                    <button
                      onClick={() => setConfirmDelete(s)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete"
                    ><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {unattached.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2">{unattached.length} schedules with missing activities</p>
      )}

      {/* Add/Edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Schedule" : "Add Schedule Slot"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Activity *</label>
            <select
              value={form.activity_id}
              onChange={e => setForm(f => ({ ...f, activity_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            >
              <option value="">Select activity</option>
              {activities.map(a => {
                const child = a.child as Child | undefined;
                return (
                  <option key={a.id} value={a.id}>
                    {child?.avatar_emoji} {a.institution} ({a.status})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Day *</label>
              <select
                value={form.day_of_week}
                onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              >
                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.fullLabel}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start time *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Compass One"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm text-[var(--text-primary)]">Active slot</label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>{editing ? "Save changes" : "Add slot"}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete schedule?" size="sm">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Remove the <strong>{confirmDelete ? dayLabel(confirmDelete.day_of_week) : ""}</strong> slot at{" "}
          <strong>{confirmDelete ? formatTime(confirmDelete.start_time) : ""}</strong>?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={() => confirmDelete && deleteSchedule(confirmDelete)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
