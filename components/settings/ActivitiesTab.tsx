"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Fab } from "@/components/ui/Fab";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { SettingsList, SettingsRow, Tag, MoreToggle } from "@/components/settings/SettingsList";
import { formatDate } from "@/lib/utils";
import type { Activity, ActivityCategory, Child, ActivityStatus } from "@/lib/types";

interface Props {
  activities: Activity[];
  categories: ActivityCategory[];
  children: Child[];
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active", paused: "Paused", completed: "Completed", dropped: "Dropped",
};
const STATUS_VARIANTS: Record<string, "success" | "warning" | "muted" | "danger"> = {
  active: "success", paused: "warning", completed: "muted", dropped: "danger",
};

const EMPTY_FORM = {
  child_id: "", category_id: "", activity_name: "", institution: "", instructor_name: "",
  level: "", status: "active" as ActivityStatus, start_date: "", end_date: "", notes: "", prep_task: "",
};

export function ActivitiesTab({ activities, categories, children, onRefresh }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Filter activities by selected child (pill filter)
  const activeChildId = selectedChildId || children[0]?.id || "";
  const visibleActivities = activities.filter(a => a.child_id === activeChildId);
  const activeList = visibleActivities.filter(a => a.status === "active");
  const inactiveList = visibleActivities.filter(a => a.status !== "active");

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(a: Activity) {
    setForm({
      child_id: a.child_id,
      category_id: a.category_id,
      activity_name: a.activity_name ?? "",
      institution: a.institution,
      instructor_name: a.instructor_name ?? "",
      level: a.level ?? "",
      status: a.status,
      start_date: a.start_date ? a.start_date.slice(0, 10) : "",
      end_date: a.end_date ? a.end_date.slice(0, 10) : "",
      notes: a.notes ?? "",
      prep_task: a.prep_task ?? "",
    });
    setEditing(a);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.child_id || !form.category_id || !form.activity_name.trim() || !form.instructor_name.trim() || !form.status || !form.start_date) {
      setError("Child, category, activity, instructor, status, and start date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        activity_name: form.activity_name.trim(),
        institution: form.institution.trim(),
        instructor_name: form.instructor_name.trim(),
        level: form.level.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        notes: form.notes || null,
        prep_task: form.prep_task.trim() || null,
      };
      const url = editing ? `/api/activities/${editing.id}` : "/api/activities";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      setShowForm(false);
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(a: Activity) {
    await fetch(`/api/activities/${a.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    onRefresh();
  }

  function renderRow(a: Activity) {
    const category = a.category as ActivityCategory | undefined;
    const dateText = a.start_date
      ? a.end_date
        ? `${formatDate(a.start_date)} – ${formatDate(a.end_date)}`
        : `Since ${formatDate(a.start_date)}`
      : "";
    const title = a.activity_name || a.institution;
    // Freelance coaches are often stored as both institution and instructor — show them once.
    const meta = [...new Set([
      a.activity_name && a.institution ? a.institution : "",
      a.instructor_name ?? "",
    ].map(x => x.trim()).filter(Boolean))].join(" · ");
    return (
      <SettingsRow
        key={a.id}
        title={title}
        onTitleClick={() => router.push(`/activity/${a.id}`)}
        tags={<>
          {a.status !== "active" && <Badge label={STATUS_LABELS[a.status]} variant={STATUS_VARIANTS[a.status]} />}
          {category && <Tag color={category.color_code}>{category.icon && <span aria-hidden="true">{category.icon}</span>}{category.name}</Tag>}
        </>}
        meta={meta || undefined}
        sub={dateText || undefined}
        actions={<>
          <IconButton icon={Pencil} label={`Edit ${title}`} onClick={() => openEdit(a)} />
          <IconButton icon={Trash2} label={`Delete ${title}`} tone="danger" onClick={() => setConfirmDelete(a)} />
        </>}
      />
    );
  }

  return (
    <div>
      <Fab label="Add activity" onClick={openAdd} />
      <div className="flex flex-col gap-4">
        <ChildFilter single childList={children} selected={activeChildId ? [activeChildId] : []} onToggle={setSelectedChildId} />

        {activeList.length === 0 ? (
          <p className="text-sm leading-5 text-[var(--ink-soft)]">No active activities.</p>
        ) : (
          <SettingsList label="Active activities">{activeList.map(renderRow)}</SettingsList>
        )}

        {/* Paused / completed / dropped — hidden by default */}
        {inactiveList.length > 0 && (
          <div>
            <MoreToggle open={showInactive} onClick={() => setShowInactive(v => !v)}>
              {showInactive ? "Hide" : "Show"} {inactiveList.length} paused, completed or dropped
            </MoreToggle>
            {showInactive && <SettingsList label="Inactive activities">{inactiveList.map(renderRow)}</SettingsList>}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Activity" : "Add Activity"}
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Child *</label>
              <select
                value={form.child_id}
                onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              >
                <option value="">Select child</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Category *</label>
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              >
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Activity *</label>
            <input
              type="text"
              value={form.activity_name}
              onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))}
              placeholder="e.g. Taekwondo Class"
              className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Institution</label>
            <input
              type="text"
              value={form.institution}
              onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
              placeholder="e.g. Jeong-in Taekwondo"
              className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Instructor *</label>
            <input
              type="text"
              value={form.instructor_name}
              onChange={e => setForm(f => ({ ...f, instructor_name: e.target.value }))}
              placeholder="e.g. Coach Reuben"
              className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Level</label>
            <input
              type="text"
              value={form.level}
              onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              placeholder="e.g. P2 (Distinction), Kids 4T, Red Belt"
              className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label htmlFor="activity-prep" className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Prep task for My Day</label>
            <input
              id="activity-prep"
              type="text"
              value={form.prep_task}
              onChange={e => setForm(f => ({ ...f, prep_task: e.target.value }))}
              placeholder="e.g. Pack swimming kit"
              className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
            <p className="mt-1 text-xs leading-4 text-[var(--ink-faint)]">Optional. Shows as a must-do on this class’s days.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Status *</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof form.status }))}
              className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Start Date *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete activity?" size="sm">
        <p className="text-sm text-[var(--ink-soft)] mb-4">
          This will permanently delete <strong>{confirmDelete?.institution}</strong> and all its attendance records.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={() => confirmDelete && deleteActivity(confirmDelete)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
