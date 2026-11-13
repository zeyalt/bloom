"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar, AvatarPicker } from "@/components/ui/Avatar";
import { formatDate, calcAge, formatTime } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";
import { SettingsList, SettingsRow } from "@/components/settings/SettingsList";
import { SchoolHoursEditor, WeekHours, weekError, weekFromRows, weekToInput } from "@/components/settings/SchoolHoursEditor";
import { SCHOOL_LEVELS, levelFor, levelName } from "@/lib/my-day";
import { myDayApi } from "@/lib/my-day-api";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { Child, SchoolCalendar, SchoolHours } from "@/lib/types";

interface Props {
  children: Child[];
  schoolHours: SchoolHours[];
  calendars: SchoolCalendar[];
  onRefresh: () => void;
}

/** Picking this sets up the MOE calendar first (it only exists once imported). */
const SET_UP_MOE = "__moe__";

const EMPTY_FORM = {
  name: "", nickname: "", date_of_birth: "",
  school: "", color_code: "#1a2c22", avatar_emoji: "🌱", avatar_key: null as string | null,
  school_level: "", auto_promote: true, calendar_id: "",
};

const fieldCls = "w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-[var(--radius-md)] bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/20";

/** "School Mon–Fri · 07:30 AM–01:30 PM", or "times vary" when they differ. */
function hoursSummary(childId: string, rows: SchoolHours[]): string | null {
  const on = rows.filter(r => r.child_id === childId && r.is_school_day);
  if (!rows.some(r => r.child_id === childId)) return null;
  if (on.length === 0) return "No school days set";
  const days = DAYS_OF_WEEK.filter(d => on.some(r => r.day_of_week === d.value)).map(d => d.label);
  const dayText = days.join(" ") === "Mon Tue Wed Thu Fri" ? "Mon–Fri" : days.join(", ");
  const times = new Set(on.map(r => `${r.start_time ?? ""}-${r.end_time ?? ""}`));
  const first = on[0];
  const timeText = times.size > 1 ? "times vary"
    : first.start_time && first.end_time ? `${formatTime(first.start_time)}–${formatTime(first.end_time)}` : "";
  return ["School " + dayText, timeText].filter(Boolean).join(" · ");
}

export function ChildrenTab({ children, schoolHours, calendars, onRefresh }: Props) {
  const [editing, setEditing] = useState<Child | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [week, setWeek] = useState<WeekHours>(() => weekFromRows("", []));
  const thisYear = new Date().getFullYear();
  const hasMoe = calendars.some(c => c.kind === "moe_primary");
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
      school_level: levelFor(c, thisYear) ?? "",
      auto_promote: c.auto_promote,
      calendar_id: c.calendar_id ?? "",
    });
    setWeek(weekFromRows(c.id, schoolHours));
    setEditing(c);
    setError("");
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    const hoursProblem = weekError(week);
    if (hoursProblem) { setError(hoursProblem); return; }
    setSaving(true); setError("");
    try {
      let calendarId = form.calendar_id || null;
      if (calendarId === SET_UP_MOE) calendarId = (await myDayApi.importCalendar()).calendar_id;
      const payload = {
        ...form,
        nickname: form.nickname || null,
        date_of_birth: form.date_of_birth || null,
        school: form.school || null,
        school_level: form.school_level || null,
        school_level_year: form.school_level ? thisYear : null,
        calendar_id: calendarId,
      };
      const res = await fetch(`/api/children/${editing!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Save failed"); }
      await myDayApi.saveSchoolHours(editing!.id, weekToInput(week));
      setEditing(null);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <SettingsList label="Children">
        {children.map(c => (
          <SettingsRow
            key={c.id}
            leading={<Avatar avatarKey={c.avatar_key} fallbackEmoji={c.avatar_emoji} size={40} />}
            title={c.name}
            tags={<>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color_code }} aria-hidden="true" />
              {c.nickname && <span className="text-sm leading-5 text-[var(--ink-faint)]">“{c.nickname}”</span>}
            </>}
            meta={[c.date_of_birth ? calcAge(c.date_of_birth) : "", levelName(levelFor(c, thisYear)), c.school].filter(Boolean).join(" · ") || undefined}
            sub={hoursSummary(c.id, schoolHours) ?? (c.date_of_birth ? `Born ${formatDate(c.date_of_birth)}` : undefined)}
            actions={<IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => openEdit(c)} />}
          />
        ))}
      </SettingsList>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Child" size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-[var(--radius-md)]">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Colour</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color_code}
                  onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))}
                  className="w-10 h-12 rounded border border-[var(--rule)] cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={form.color_code}
                  onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-[var(--rule)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-stone-900/20 font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">School</label>
              <input
                type="text"
                value={form.school}
                onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[var(--rule)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-stone-900/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-2">Avatar</label>
            <AvatarPicker
              value={form.avatar_key}
              onChange={key => setForm(f => ({ ...f, avatar_key: key }))}
            />
          </div>

          {/* School: level, calendar and weekly hours — what My Day builds each day from. */}
          <section aria-labelledby="school-heading" className="space-y-3 pt-2 border-t border-[var(--rule)]">
            <div className="pt-2">
              <h3 id="school-heading" className="text-base font-semibold text-[var(--ink)]">School</h3>
              <p className="text-sm leading-5 text-[var(--ink-soft)]">Used by My Day to know school days, holidays and when {form.name || "they"} gets home.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="child-level" className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Level in {thisYear}</label>
                <select id="child-level" value={form.school_level} onChange={e => setForm(f => ({ ...f, school_level: e.target.value }))} className={fieldCls}>
                  <option value="">Not set</option>
                  {SCHOOL_LEVELS.map(l => <option key={l} value={l}>{levelName(l)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="child-calendar" className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Follows calendar</label>
                <select id="child-calendar" value={form.calendar_id} onChange={e => setForm(f => ({ ...f, calendar_id: e.target.value }))} className={fieldCls}>
                  <option value="">None (weekly hours only)</option>
                  {!hasMoe && <option value={SET_UP_MOE}>MOE primary schools</option>}
                  {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {form.school_level && (
              <label className="flex items-center gap-3 min-h-12 text-sm text-[var(--ink)] cursor-pointer">
                <input type="checkbox" checked={form.auto_promote}
                  onChange={e => setForm(f => ({ ...f, auto_promote: e.target.checked }))}
                  className="w-5 h-5 accent-[var(--stem)]" />
                Moves up a level each January
              </label>
            )}
            <div>
              <span className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Weekly hours</span>
              <SchoolHoursEditor value={week} onChange={setWeek} />
            </div>
          </section>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
