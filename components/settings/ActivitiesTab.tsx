"use client";

import { useState } from "react";
import { Plus, Pencil, Archive, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatDate } from "@/lib/utils";
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
  status: "active" as ActivityStatus, start_date: "", end_date: "", notes: "",
};

export function ActivitiesTab({ activities, categories, children, onRefresh }: Props) {
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
      status: a.status,
      start_date: a.start_date ? a.start_date.slice(0, 10) : "",
      end_date: a.end_date ? a.end_date.slice(0, 10) : "",
      notes: a.notes ?? "",
    });
    setEditing(a);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.child_id || !form.category_id || !form.activity_name.trim()) {
      setError("Child, category and activity are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        activity_name: form.activity_name.trim(),
        institution: form.institution.trim(),
        instructor_name: form.instructor_name || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
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

  async function archive(a: Activity) {
    await fetch(`/api/activities/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    onRefresh();
  }

  async function deleteActivity(a: Activity) {
    await fetch(`/api/activities/${a.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    onRefresh();
  }

  function renderRow(a: Activity) {
    const category = a.category as ActivityCategory | undefined;
    const dateText = a.start_date
      ? a.status === "active"
        ? `since ${formatDate(a.start_date)}`
        : `${formatDate(a.start_date)}${a.end_date ? ` – ${formatDate(a.end_date)}` : ""}`
      : "";
    const title = a.activity_name || a.institution;
    const meta = [
      a.activity_name && a.institution ? a.institution : "",
      a.instructor_name,
      dateText,
    ].filter(Boolean).join(" · ");
    return (
      <div key={a.id} className="flex items-center gap-3 px-4 py-3">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: category?.color_code ?? "#ccc" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {title}
            </span>
            <Badge label={STATUS_LABELS[a.status]} variant={STATUS_VARIANTS[a.status]} />
            {category && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${category.color_code}15`, color: category.color_code }}
              >
                {category.icon && <span className="mr-1">{category.icon}</span>}
                {category.name}
              </span>
            )}
          </div>
          {meta && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{meta}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => openEdit(a)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {a.status === "active" && (
            <button
              onClick={() => archive(a)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-amber-600 transition-colors"
              title="Archive (mark completed)"
            >
              <Archive size={14} />
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(a)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-secondary)]">{activities.length} activities total</p>
        <Button onClick={openAdd} size="sm">
          <Plus size={14} /> Add Activity
        </Button>
      </div>

      {/* Child filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {children.map(child => {
          const count = activities.filter(a => a.child_id === child.id && a.status === "active").length;
          const active = activeChildId === child.id;
          return (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
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

      {/* Active activities */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
        {activeList.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">No active activities.</p>
        ) : activeList.map(renderRow)}
      </div>

      {/* Paused / completed / dropped — hidden by default */}
      {inactiveList.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {showInactive ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {showInactive ? "Hide" : "Show"} {inactiveList.length} paused / completed / dropped
          </button>
          {showInactive && (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)] mt-2">
              {inactiveList.map(renderRow)}
            </div>
          )}
        </div>
      )}

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
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Child *</label>
              <select
                value={form.child_id}
                onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              >
                <option value="">Select child</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category *</label>
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              >
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Activity *</label>
            <input
              type="text"
              value={form.activity_name}
              onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))}
              placeholder="e.g. Taekwondo Class"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Institution</label>
            <input
              type="text"
              value={form.institution}
              onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
              placeholder="e.g. Jeong-in Taekwondo"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Instructor</label>
            <input
              type="text"
              value={form.instructor_name}
              onChange={e => setForm(f => ({ ...f, instructor_name: e.target.value }))}
              placeholder="e.g. Coach Reuben"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof form.status }))}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>
              {editing ? "Save changes" : "Add activity"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete activity?" size="sm">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
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
