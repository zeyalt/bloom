"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import { isBefore, startOfToday, parseISO } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { formatTime, formatDate, cn } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { Schedule, Activity, ActivityCategory, Child } from "@/lib/types";

interface Props {
  schedules: Schedule[];
  activities: Activity[];
  children: Child[];
  onRefresh: () => void;
}

interface SlotRow {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
}

// A card = the day-slots of one activity that share the same term.
interface ScheduleCard {
  activity: Activity;
  category?: ActivityCategory;
  term: string | null;
  level: string | null;
  effective_from: string | null;
  effective_until: string | null;
  slots: Schedule[];
  ended: boolean;
}

const emptySlot = (): SlotRow => ({ day_of_week: 1, start_time: "", end_time: "", location: "" });

function dayLabel(n: number) {
  return DAYS_OF_WEEK.find(d => d.value === n)?.label ?? String(n);
}

function dateRangeLabel(from: string | null, until: string | null): string {
  if (from && until) return `${formatDate(from)} – ${formatDate(until)}`;
  if (from) return `Since ${formatDate(from)}`;
  if (until) return `Until ${formatDate(until)}`;
  return "";
}

export function SchedulesTab({ schedules, activities, children, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editOriginalIds, setEditOriginalIds] = useState<string[]>([]);
  const [childId, setChildId] = useState("");
  const [activityName, setActivityName] = useState("");
  const [institution, setInstitution] = useState("");
  const [slots, setSlots] = useState<SlotRow[]>([emptySlot()]);
  const [level, setLevel] = useState("");
  const [term, setTerm] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Schedule | null>(null);
  const [filterChildId, setFilterChildId] = useState("");
  const [showEnded, setShowEnded] = useState(false);

  const childActivities = activities.filter(a => a.child_id === childId);

  // Activity is selected via name + institution (which resolves to one record)
  const actName = (a: Activity) => a.activity_name || a.institution;
  const activityNames = [...new Set(childActivities.map(actName))];
  const institutionsForName = [
    ...new Set(childActivities.filter(a => actName(a) === activityName).map(a => a.institution)),
  ];
  const resolvedActivityId =
    childActivities.find(a => actName(a) === activityName && a.institution === institution)?.id ?? "";

  // Pill filter: which child's schedules to show in the list
  const activeFilterChildId = filterChildId || children[0]?.id || "";

  function selectActivity(a: Activity | undefined) {
    setActivityName(a ? (a.activity_name || a.institution) : "");
    setInstitution(a?.institution ?? "");
  }

  function resetSharedFields() {
    setLevel(""); setTerm(""); setEffectiveFrom(""); setEffectiveUntil(""); setIsActive(true);
  }

  function openAdd() {
    const firstChild = children[0]?.id ?? "";
    const firstAct =
      activities.find(a => a.child_id === firstChild && a.status === "active") ??
      activities.find(a => a.child_id === firstChild);
    setChildId(firstChild);
    selectActivity(firstAct);
    setSlots([emptySlot()]);
    resetSharedFields();
    setEditing(false);
    setEditOriginalIds([]);
    setError("");
    setShowForm(true);
  }

  function openEditCard(card: ScheduleCard) {
    setChildId(card.activity.child_id);
    selectActivity(card.activity);
    setSlots(card.slots.map(s => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time ?? "",
      location: s.location ?? "",
    })));
    setLevel(card.level ?? "");
    setTerm(card.term ?? "");
    setEffectiveFrom(card.effective_from ? card.effective_from.slice(0, 10) : "");
    setEffectiveUntil(card.effective_until ? card.effective_until.slice(0, 10) : "");
    setIsActive(card.slots.every(s => s.is_active));
    setEditing(true);
    setEditOriginalIds(card.slots.map(s => s.id));
    setError("");
    setShowForm(true);
  }

  function onChildChange(v: string) {
    setChildId(v);
    const fa =
      activities.find(a => a.child_id === v && a.status === "active") ??
      activities.find(a => a.child_id === v);
    selectActivity(fa);
  }

  function onActivityNameChange(name: string) {
    setActivityName(name);
    const insts = childActivities.filter(a => actName(a) === name).map(a => a.institution);
    setInstitution(insts[0] ?? "");
  }

  function updateSlot(i: number, patch: Partial<SlotRow>) {
    setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    if (!resolvedActivityId) { setError("Activity is required."); return; }
    const validSlots = slots.filter(s => s.start_time);
    if (validSlots.length === 0) { setError("Add at least one day with a start time."); return; }
    setSaving(true); setError("");
    try {
      const toPayload = (s: SlotRow) => ({
        activity_id: resolvedActivityId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time && s.end_time.trim() ? s.end_time : null,
        location: s.location && s.location.trim() ? s.location : null,
        level: level.trim() || null,
        term: term.trim() || null,
        effective_from: effectiveFrom || null,
        effective_until: effectiveUntil || null,
        is_active: isActive,
      });

      if (editing) {
        // PATCH existing slots, POST new ones, DELETE removed ones.
        const keptIds: string[] = [];
        for (const s of validSlots) {
          if (s.id) {
            keptIds.push(s.id);
            const res = await fetch(`/api/schedules/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(toPayload(s)),
            });
            if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
          } else {
            const res = await fetch("/api/schedules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(toPayload(s)),
            });
            if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
          }
        }
        for (const id of editOriginalIds.filter(id => !keptIds.includes(id))) {
          await fetch(`/api/schedules/${id}`, { method: "DELETE" });
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

  // ── Build cards: group an activity's schedules by term ──
  const today = startOfToday();
  const allCards: ScheduleCard[] = [];
  for (const act of activities.filter(a => a.child_id === activeFilterChildId)) {
    const actSchedules = schedules.filter(s => s.activity_id === act.id);
    if (actSchedules.length === 0) continue;
    const byTerm = new Map<string, Schedule[]>();
    for (const s of actSchedules) {
      const key = s.term ?? "";
      byTerm.set(key, [...(byTerm.get(key) ?? []), s]);
    }
    for (const [, group] of byTerm) {
      const sorted = [...group].sort((a, b) =>
        a.day_of_week - b.day_of_week || (a.start_time || "").localeCompare(b.start_time || ""));
      const first = sorted[0];
      const effective_until = first.effective_until;
      allCards.push({
        activity: act,
        category: act.category as ActivityCategory | undefined,
        term: first.term ?? null,
        level: first.level ?? null,
        effective_from: first.effective_from,
        effective_until,
        slots: sorted,
        ended: !!effective_until && isBefore(parseISO(effective_until.slice(0, 10)), today),
      });
    }
  }

  const activeCards = allCards.filter(c => !c.ended);
  const endedCards = allCards.filter(c => c.ended);

  // Group active cards by category
  const categoryGroups = new Map<string, { category?: ActivityCategory; cards: ScheduleCard[] }>();
  for (const card of activeCards) {
    const key = card.category?.id ?? "__uncat__";
    if (!categoryGroups.has(key)) categoryGroups.set(key, { category: card.category, cards: [] });
    categoryGroups.get(key)!.cards.push(card);
  }
  const sortedCategoryGroups = [...categoryGroups.values()].sort((a, b) => {
    if (!a.category) return 1;
    if (!b.category) return -1;
    return a.category.name.localeCompare(b.category.name);
  });

  const unattached = schedules.filter(s => !activities.find(a => a.id === s.activity_id));

  // ── Renderers ──
  function categoryHeading(category?: ActivityCategory) {
    return (
      <div className="mb-2 mt-5 first:mt-0">
        {category ? (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${category.color_code}15`, color: category.color_code }}
          >
            {category.icon && <span className="mr-1">{category.icon}</span>}
            {category.name}
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Uncategorized</span>
        )}
      </div>
    );
  }

  function renderCard(card: ScheduleCard, opts?: { showCategoryChip?: boolean }) {
    const act = card.activity;
    const title = act.activity_name || act.institution;
    const inst = (act.institution ?? "").trim();
    const isBlankInst = inst === "" || inst.toLowerCase() === "freelance";
    const secondaryRaw = isBlankInst ? (act.instructor_name ?? "") : inst;
    const secondary = secondaryRaw && secondaryRaw !== title ? secondaryRaw : "";
    const range = dateRangeLabel(card.effective_from, card.effective_until);
    return (
      <div key={`${act.id}|${card.term ?? ""}`} className="mb-4 border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] flex-wrap">
          {opts?.showCategoryChip && card.category && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${card.category.color_code}15`, color: card.category.color_code }}
            >
              {card.category.icon && <span className="mr-1">{card.category.icon}</span>}
              {card.category.name}
            </span>
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {secondary && <span className="text-xs text-[var(--text-muted)]">· {secondary}</span>}
          {act.status !== "active" && <Badge label={act.status} variant="muted" />}
          {card.level && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)]">
              {card.level}
            </span>
          )}
          {card.term && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)]">
              {/^term\b/i.test(card.term.trim()) ? card.term : `Term ${card.term}`}
            </span>
          )}
          {range && <span className="text-xs text-[var(--text-muted)]">{range}</span>}
          <button
            onClick={() => openEditCard(card)}
            className="ml-auto p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] transition-colors shrink-0"
            title="Edit schedule"
          ><Pencil size={14} /></button>
        </div>

        {/* Schedule rows */}
        <div className="divide-y divide-[var(--border)]">
          {card.slots.map(s => (
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
              <button
                onClick={() => setConfirmDelete(s)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                title="Delete day"
              ><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-secondary)]">{schedules.length} schedule slots</p>
        <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Schedule</Button>
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
              style={active ? { backgroundColor: child.color_code } : undefined}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
                active
                  ? "text-white border-transparent"
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

      {activeCards.length === 0 && endedCards.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-6 border border-[var(--border)] rounded-xl">
          No schedules yet.
        </p>
      )}

      {/* Active cards grouped by category */}
      {sortedCategoryGroups.map(group => (
        <div key={group.category?.id ?? "__uncat__"}>
          {categoryHeading(group.category)}
          {group.cards.map(card => renderCard(card))}
        </div>
      ))}

      {/* Ended cards — collapsed at the bottom */}
      {endedCards.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowEnded(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {showEnded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {showEnded ? "Hide" : "Show"} {endedCards.length} ended
          </button>
          {showEnded && (
            <div className="mt-3">
              {endedCards.map(card => renderCard(card, { showCategoryChip: true }))}
            </div>
          )}
        </div>
      )}

      {unattached.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2">{unattached.length} schedules with missing activities</p>
      )}

      {/* Add/Edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Schedule" : "Add Schedule"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Child + Activity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Child *</label>
              <select
                value={childId}
                onChange={e => onChildChange(e.target.value)}
                disabled={editing}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 disabled:opacity-60"
              >
                <option value="">Select child</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Activity *</label>
              <select
                value={activityName}
                onChange={e => onActivityNameChange(e.target.value)}
                disabled={editing}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 disabled:opacity-60"
              >
                <option value="">Select activity</option>
                {activityNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Institution — mapped from the selected activity */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Institution *</label>
            <select
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              disabled={editing || !activityName}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 disabled:opacity-60"
            >
              <option value="">Select institution</option>
              {institutionsForName.map(inst => <option key={inst} value={inst}>{inst}</option>)}
            </select>
          </div>

          {/* Level + Term */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Level</label>
              <input
                type="text"
                value={level}
                onChange={e => setLevel(e.target.value)}
                placeholder="e.g. U10"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Term</label>
              <input
                type="text"
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder="e.g. 2 2026"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          {/* Start Date and End Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Date</label>
              <input
                type="date"
                value={effectiveUntil}
                onChange={e => setEffectiveUntil(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          {/* Slot rows */}
          <div className="space-y-3">
            {slots.map((slot, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3 space-y-2 relative">
                {slots.length > 1 && (
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
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Time *</label>
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={e => updateSlot(i, { start_time: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Time</label>
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
              Confirm
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
