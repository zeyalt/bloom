"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { formatTime, cn } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { Schedule, Activity, ActivityCategory, Child } from "@/lib/types";

interface Props {
  schedules: Schedule[];
  activities: Activity[];
  children: Child[];
  onRefresh: () => void;
}

interface SlotRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
}

const emptySlot = (): SlotRow => ({ day_of_week: 1, start_time: "", end_time: "", location: "" });

function dayLabel(n: number) {
  return DAYS_OF_WEEK.find(d => d.value === n)?.label ?? String(n);
}

export function SchedulesTab({ schedules, activities, children, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [childId, setChildId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [slots, setSlots] = useState<SlotRow[]>([emptySlot()]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Schedule | null>(null);
  const [filterChildId, setFilterChildId] = useState("");

  const childActivities = activities.filter(a => a.child_id === childId);

  // Pill filter: which child's schedules to show in the list
  const activeFilterChildId = filterChildId || children[0]?.id || "";

  function openAdd() {
    const firstChild = children[0]?.id ?? "";
    const firstAct =
      activities.find(a => a.child_id === firstChild && a.status === "active") ??
      activities.find(a => a.child_id === firstChild);
    setChildId(firstChild);
    setActivityId(firstAct?.id ?? "");
    setSlots([emptySlot()]);
    setIsActive(true);
    setEditing(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(s: Schedule) {
    const act = activities.find(a => a.id === s.activity_id);
    setChildId(act?.child_id ?? "");
    setActivityId(s.activity_id);
    setSlots([{
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time ?? "",
      location: s.location ?? "",
    }]);
    setIsActive(s.is_active);
    setEditing(s);
    setError("");
    setShowForm(true);
  }

  function onChildChange(v: string) {
    setChildId(v);
    const fa =
      activities.find(a => a.child_id === v && a.status === "active") ??
      activities.find(a => a.child_id === v);
    setActivityId(fa?.id ?? "");
  }

  function updateSlot(i: number, patch: Partial<SlotRow>) {
    setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    if (!activityId) { setError("Activity is required."); return; }
    const validSlots = slots.filter(s => s.start_time);
    if (validSlots.length === 0) { setError("Add at least one day with a start time."); return; }
    setSaving(true); setError("");
    try {
      const toPayload = (s: SlotRow) => ({
        activity_id: activityId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time || null,
        location: s.location || null,
        is_active: isActive,
      });

      if (editing) {
        // First valid row updates the existing slot; any extra rows are created
        const [head, ...rest] = validSlots;
        const res = await fetch(`/api/schedules/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(head)),
        });
        if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
        for (const s of rest) {
          const r = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPayload(s)),
          });
          if (!r.ok) { const j = await r.json(); throw new Error(j.error || "Save failed"); }
        }
      } else {
        for (const s of validSlots) {
          const res = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPayload(s)),
          });
          if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
        }
      }
      setShowForm(false); onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteSchedule(s: Schedule) {
    await fetch(`/api/schedules/${s.id}`, { method: "DELETE" });
    setConfirmDelete(null); onRefresh();
  }

  // Group schedules by activity, limited to the selected child
  const byActivity = activities
    .filter(act => act.child_id === activeFilterChildId)
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

      {/* Child filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {children.map(child => {
          const count = schedules.filter(s => {
            const act = activities.find(a => a.id === s.activity_id);
            return act?.child_id === child.id;
          }).length;
          const active = activeFilterChildId === child.id;
          return (
            <button
              key={child.id}
              onClick={() => setFilterChildId(child.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
                active
                  ? "bg-[var(--accent-primary)] text-white border-transparent"
                  : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
              )}
            >
              <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={20} />
              {child.name}
              <span className={cn("text-xs", active ? "text-white/80" : "text-[var(--text-muted)]")}>{count}</span>
            </button>
          );
        })}
      </div>

      {byActivity.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-6 border border-[var(--border)] rounded-xl">
          No schedules yet.
        </p>
      )}

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
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Schedule" : "Add Schedule Slots"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Child filter */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Child *</label>
              <select
                value={childId}
                onChange={e => onChildChange(e.target.value)}
                disabled={!!editing}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 disabled:opacity-60"
              >
                <option value="">Select child</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Activity *</label>
              <select
                value={activityId}
                onChange={e => setActivityId(e.target.value)}
                disabled={!!editing}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 disabled:opacity-60"
              >
                <option value="">Select activity</option>
                {childActivities.map(a => <option key={a.id} value={a.id}>{a.institution}</option>)}
              </select>
            </div>
          </div>

          {/* Slot rows */}
          <div className="space-y-3">
            {slots.map((slot, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3 space-y-2 relative">
                {((!editing && slots.length > 1) || (editing && i > 0)) && (
                  <button
                    onClick={() => setSlots(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-2 right-2 p-1 rounded text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Remove day"
                  ><X size={14} /></button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Day *</label>
                    <select
                      value={slot.day_of_week}
                      onChange={e => updateSlot(i, { day_of_week: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    >
                      {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.fullLabel}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Location</label>
                    <input
                      type="text"
                      value={slot.location}
                      onChange={e => updateSlot(i, { location: e.target.value })}
                      placeholder="e.g. Compass One"
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start time *</label>
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={e => updateSlot(i, { start_time: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End time</label>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={e => updateSlot(i, { end_time: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setSlots(prev => [...prev, emptySlot()])}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80 transition-opacity"
          >
            <Plus size={14} /> Add another day
          </button>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm text-[var(--text-primary)]">Active slot{editing ? "" : "s"}</label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>
              {editing ? "Save changes" : `Add ${slots.filter(s => s.start_time).length || ""} slot${slots.filter(s => s.start_time).length === 1 ? "" : "s"}`.trim()}
            </Button>
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
