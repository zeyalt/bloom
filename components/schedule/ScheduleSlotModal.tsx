"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { Schedule } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  title?: string;
  onSaved: () => void;
}

const EMPTY_FORM = {
  day_of_week: 1,
  start_time: "",
  end_time: "",
  location: "",
  institution: "",
  level: "",
  is_active: true,
  effective_from: "",
  effective_until: "",
};

function minutesBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

export function ScheduleSlotModal({ open, onClose, schedule, title, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && schedule) {
      setForm({
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time ?? "",
        end_time: schedule.end_time ?? "",
        location: schedule.location ?? "",
        institution: "",
        level: "",
        is_active: schedule.is_active,
        effective_from: schedule.effective_from ? String(schedule.effective_from).slice(0, 10) : "",
        effective_until: schedule.effective_until ? String(schedule.effective_until).slice(0, 10) : "",
      });
      setError("");
    } else if (open) {
      setForm(EMPTY_FORM);
      setError("");
    }
  }, [open, schedule]);

  async function save() {
    if (!schedule) return;
    if (!form.start_time) { setError("Start Time is required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time || null,
          duration_minutes: minutesBetween(form.start_time, form.end_time),
          location: form.location || null,
          is_active: form.is_active,
        }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20";

  return (
    <Modal open={open} onClose={onClose} title={schedule ? "Edit Schedule" : "Add Schedule"}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {title && <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>}
        <p className="text-xs text-[var(--text-muted)] -mt-2">Changes here update the recurring schedule going forward.</p>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Day *</label>
          <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} className={inputCls}>
            {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.fullLabel}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Institution</label>
          <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="e.g. Barca Academy" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Level</label>
          <input type="text" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} placeholder="e.g. U10" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Time *</label>
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Time</label>
            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
            <input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Date</label>
            <input type="date" value={form.effective_until} onChange={e => setForm(f => ({ ...f, effective_until: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Location</label>
          <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Compass One" className={inputCls} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="slot_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
          <label htmlFor="slot_active" className="text-sm text-[var(--text-primary)]">Active slot</label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} loading={saving}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
