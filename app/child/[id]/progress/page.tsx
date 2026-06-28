"use client";

import { useEffect, useState } from "react";
import { Plus, Award, Target, Trophy, Star, BookOpen, Calendar } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import type { Milestone, Activity, ActivityCategory, Child, MilestoneType } from "@/lib/types";

interface MilestoneWithDetails extends Milestone {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

const MILESTONE_TYPES = [
  { value: "grading", label: "Grading", icon: "🥋" },
  { value: "level_up", label: "Level Up", icon: "⬆️" },
  { value: "competition", label: "Competition", icon: "🏆" },
  { value: "achievement", label: "Achievement", icon: "⭐" },
  { value: "term_start", label: "Term Start", icon: "📚" },
  { value: "term_end", label: "Term End", icon: "✅" },
  { value: "other", label: "Other", icon: "📌" },
] as const;

const EMPTY_FORM = {
  activity_id: "",
  child_id: "",
  date: "",
  milestone_type: "achievement" as MilestoneType,
  title: "",
  description: "",
  result: "",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default function ChildProgressPage({ params }: Props) {
  const [childId, setChildId] = useState("");
  const [milestones, setMilestones] = useState<MilestoneWithDetails[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setChildId(id);
      fetchData(id);
    });
  }, [params]);

  async function fetchData(id: string) {
    setLoading(true);
    try {
      const [milRes, actRes, childRes] = await Promise.all([
        fetch(`/api/milestones?child_id=${id}`).then(r => r.json()),
        fetch("/api/activities").then(r => r.json()),
        fetch("/api/children").then(r => r.json()),
      ]);
      setMilestones(Array.isArray(milRes) ? milRes : []);
      setActivities(Array.isArray(actRes) ? actRes.filter((a: any) => a.child_id === id) : []);
      const foundChild = Array.isArray(childRes) ? childRes.find((c: any) => c.id === id) : null;
      setChild(foundChild || null);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, child_id: childId });
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.activity_id || !form.date || !form.title.trim()) {
      setError("Activity, date, and title are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        activity_id: form.activity_id,
        child_id: childId,
        date: form.date,
        milestone_type: form.milestone_type,
        title: form.title.trim(),
        description: form.description || null,
        result: form.result || null,
      };
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      setShowForm(false);
      fetchData(childId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const getMilestoneIcon = (type: MilestoneType) => {
    const mt = MILESTONE_TYPES.find(t => t.value === type);
    return mt?.icon || "📌";
  };

  const getMilestoneColor = (type: MilestoneType) => {
    switch (type) {
      case "grading":
        return "text-red-600 bg-red-50";
      case "level_up":
        return "text-blue-600 bg-blue-50";
      case "competition":
        return "text-amber-600 bg-amber-50";
      case "achievement":
        return "text-green-600 bg-green-50";
      case "term_start":
      case "term_end":
        return "text-purple-600 bg-purple-50";
      default:
        return "text-stone-600 bg-stone-50";
    }
  };

  const childName = child?.name || "Child";

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header
        title={`${childName}'s Progress`}
        subtitle="Milestones and achievements"
      />

      <div className="px-5 md:px-8 pb-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[var(--text-secondary)]">
            {milestones.length} milestone{milestones.length !== 1 ? "s" : ""}
          </p>
          <Button onClick={openAdd} size="sm">
            <Plus size={14} /> Add Milestone
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No milestones yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {milestones.map((m, idx) => (
              <div
                key={m.id}
                className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-card)] relative"
              >
                {/* Timeline connector */}
                {idx < milestones.length - 1 && (
                  <div className="absolute left-7 top-14 w-0.5 h-12 bg-[var(--border)]" />
                )}

                <div className="flex gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 border-[var(--border)] relative z-10 flex items-center justify-center text-lg ${getMilestoneColor(
                        m.milestone_type
                      )}`}
                    >
                      {getMilestoneIcon(m.milestone_type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {m.title}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {formatDate(m.date)}
                      </span>
                    </div>

                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {m.activity?.institution}
                    </div>

                    {m.description && (
                      <div className="text-sm text-[var(--text-secondary)] mt-2">
                        {m.description}
                      </div>
                    )}

                    {m.result && (
                      <div className="text-sm font-medium text-[var(--text-primary)] mt-2 p-2 bg-[var(--bg-secondary)] rounded">
                        Result: {m.result}
                      </div>
                    )}

                    <div className="text-xs text-[var(--text-muted)] mt-2">
                      {MILESTONE_TYPES.find(t => t.value === m.milestone_type)?.label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add milestone modal */}
        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title="Add Milestone"
        >
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Activity *
                </label>
                <select
                  value={form.activity_id}
                  onChange={e => setForm(f => ({ ...f, activity_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                >
                  <option value="">Select activity</option>
                  {activities.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.institution}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Type *
                </label>
                <select
                  value={form.milestone_type}
                  onChange={e => setForm(f => ({ ...f, milestone_type: e.target.value as MilestoneType }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                >
                  {MILESTONE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Yellow Belt"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Result
              </label>
              <input
                type="text"
                value={form.result}
                onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                placeholder="e.g. Passed, 1st place"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Any details about this milestone..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/20 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} loading={saving}>
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
