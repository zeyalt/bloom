"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ActivityCategory } from "@/lib/types";

interface Props {
  categories: ActivityCategory[];
  onRefresh: () => void;
}

const EMPTY_FORM = { name: "", color_code: "#78716C", icon: "" };

export function CategoriesTab({ categories, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ActivityCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: ActivityCategory) {
    setForm({ name: c.name, color_code: c.color_code, icon: c.icon ?? "" });
    setEditing(c);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.color_code.match(/^#[0-9a-fA-F]{6}$/)) { setError("Enter a valid hex colour."); return; }
    setSaving(true); setError("");
    try {
      const payload = { name: form.name.trim(), color_code: form.color_code, icon: form.icon || null };
      const url = editing ? `/api/categories/${editing.id}` : "/api/categories";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
      setShowForm(false);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-secondary)]">{categories.length} categories</p>
        <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Category</Button>
      </div>

      <div className="space-y-1.5">
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--bg-card)]">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: c.color_code }}
            />
            <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
              {c.icon && <span className="mr-1.5">{c.icon}</span>}
              {c.name}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">{c.color_code}</span>
            <button
              onClick={() => openEdit(c)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Category" : "Add Category"} size="sm">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Taekwondo"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Icon (Emoji, Optional)</label>
            <input
              type="text"
              value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              placeholder="e.g. 🥋"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Colour *</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_code}
                onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))}
                className="w-10 h-9 rounded border border-[var(--border)] cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={form.color_code}
                onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 font-mono"
                placeholder="#EF4444"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>{editing ? "Save changes" : "Add category"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
