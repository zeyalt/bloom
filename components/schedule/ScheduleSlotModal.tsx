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
  title?: string;       // shown above the form (e.g. activity name)
  onSaved: () => void;
}

function minutesBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

export function ScheduleSlotModal({ open, onClose, schedule, title, onSaved }: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && schedule) {
      setDayOfWeek(schedule.day_of_week);
      setStartTime(schedule.start_time ?? "");
      setEndTime(schedule.end_time ?? "");
      setLocation(schedule.location ?? "");
      setIsActive(schedule.is_active);
      setError("");
    }
  }, [open, schedule]);

  async function save() {
    if (!schedule) return;
    if (!startTime) { setError("Start time is required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime || null,
          duration_minutes: minutesBetween(startTime, endTime),
          location: location || null,
          is_active: isActive,
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

  const inputCls =
    "w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20";

  return (
    <Modal open={open} onClose={onClose} title="Edit Schedule Slot">
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {title && (
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        )}
        <p className="text-xs text-[var(--text-muted)] -mt-2">
          Changes here update the recurring schedule going forward.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Day *</label>
            <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))} className={inputCls}>
              {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.fullLabel}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Compass One" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start time *</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End time</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="slot_active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
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
