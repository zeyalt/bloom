"use client";

import { useState } from "react";
import { Plus, Pencil, Archive, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
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
  child_id: "", category_id: "", institution: "", instructor_name: "",
  status: "active" as ActivityStatus, start_date: "", end_date: "", notes: "",
};

export function ActivitiesTab({ activities, categories, children, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);

  // Group by child
  const byChild = children.map(child => ({
    child,
    activities: activities.filter(a => a.child_id === child.id),
  }));

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
      institution: a.institution,
      instructor_name: a.instructor_name ?? "",
      status: a.status,
      start_date: a.start_date ?? "",
      end_date: a.end_date ?? "",
      notes: a.notes ?? "",
    });
    setEditing(a);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.child_id || !form.category_id || !form.institution.trim()) {
      setError("Child, category and institution are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-secondary)]">{activities.length} activities total</p>
        <Button onClick={openAdd} size="sm">
          <Plus size={14} /> Add Activity
        </Button>
      </div>

      {byChild.map(({ child, activities: acts }) => (
        <div key={child.id} className="mb-4 border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Child header */}
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] hover:bg-stone-200 transition-colors"
            onClick={() => setExpandedChild(expandedChild === child.id ? null : child.id)}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: child.color_code }}
              />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {child.avatar_emoji} {child.name}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {acts.filter(a => a.status === "active").length} active
              </span>
            </div>
            {expandedChild === child.id ? <ChevronUp size={15} className="text-[var(--text-muted)]" /> : <ChevronDown size={15} className="text-[var(--text-muted)]" />}
          </button>

          {expandedChild === child.id && (
            <div className="divide-y divide-[var(--border)]">
              {acts.length === 0 ? (
                <p className="px-4 py-4 text-sm text-[var(--text-muted)]">No activities yet.</p>
              ) : acts.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: (a.category as ActivityCategory)?.color_code ?? "#ccc" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {a.institution}
                      </span>
                      <Badge
                        label={STATUS_LABELS[a.status]}
                        variant={STATUS_VARIANTS[a.status]}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {(a.category as ActivityCategory)?.name}
                      {a.instructor_name && ` · ${a.instructor_name}`}
                      {a.start_date && ` · from ${formatDate(a.start_date)}`}
                    </p>
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
              ))}
            </div>
          )}
        </div>
      ))}

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
                {children.map(c => <option key={c.id} value={c.id}>{c.avatar_emoji} {c.name}</option>)}
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
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Institution / Name *</label>
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

          <div className="grid grid-cols-3 gap-3">
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

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any notes about this activity"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 resize-none"
            />
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
