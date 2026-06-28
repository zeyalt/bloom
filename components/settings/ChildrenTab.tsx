"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar, AvatarPicker } from "@/components/ui/Avatar";
import { formatDate, calcAge } from "@/lib/utils";
import type { Child } from "@/lib/types";

interface Props {
  children: Child[];
  onRefresh: () => void;
}

const EMPTY_FORM = {
  name: "", nickname: "", date_of_birth: "",
  school: "", color_code: "#1C1917", avatar_emoji: "🌱", avatar_key: null as string | null,
};

export function ChildrenTab({ children, onRefresh }: Props) {
  const [editing, setEditing] = useState<Child | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openEdit(c: Child) {
    setForm({
      name: c.name,
      nickname: c.nickname ?? "",
      date_of_birth: c.date_of_birth ? c.date_of_birth.slice(0, 10) : "",
      school: c.school ?? "",
      color_code: c.color_code,
      avatar_emoji: c.avatar_emoji,
      avatar_key: c.avatar_key,
    });
    setEditing(c);
    setError("");
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        ...form,
        nickname: form.nickname || null,
        date_of_birth: form.date_of_birth || null,
        school: form.school || null,
      };
      const res = await fetch(`/api/children/${editing!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
      setEditing(null);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Edit child profiles. Children cannot be deleted to preserve data history.
      </p>

      <div className="space-y-3">
        {children.map(c => (
          <div key={c.id} className="flex items-center gap-4 p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-card)]">
            {/* Avatar */}
            <Avatar avatarKey={c.avatar_key} fallbackEmoji={c.avatar_emoji} size={48} className="shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--text-primary)]">{c.name}</span>
                {c.nickname && (
                  <span className="text-sm text-[var(--text-muted)]">"{c.nickname}"</span>
                )}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color_code }}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {c.date_of_birth && <span className="font-medium text-[var(--text-primary)]">{calcAge(c.date_of_birth)}</span>}
                {c.school && <span>{c.date_of_birth ? " · " : ""}{c.school}</span>}
                {c.date_of_birth && <span> · Born {formatDate(c.date_of_birth)}</span>}
              </p>
            </div>

            {/* Edit */}
            <button
              onClick={() => openEdit(c)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              title="Edit child"
            >
              <Pencil size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Child">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Colour</label>
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
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">School</label>
              <input
                type="text"
                value={form.school}
                onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Avatar</label>
            <AvatarPicker
              value={form.avatar_key}
              onChange={key => setForm(f => ({ ...f, avatar_key: key }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
