"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Fab } from "@/components/ui/Fab";
import { IconButton } from "@/components/ui/IconButton";
import { GroupHeading, MoreToggle, SettingsList, SettingsRow, Tag } from "@/components/settings/SettingsList";
import { myDayApi, type CalendarDayInput } from "@/lib/my-day-api";
import { formatTime } from "@/lib/utils";
import type { CalendarDay, Child, SchoolCalendar } from "@/lib/types";

interface Props {
  calendars: SchoolCalendar[];
  calendarDays: CalendarDay[];
  childList: Child[];
  onRefresh: () => void;
}

const KIND_LABEL: Record<CalendarDay["kind"], string> = {
  term: "Term",
  school_holiday: "School holiday",
  public_holiday: "Public holiday",
  half_day: "Half day",
  no_school: "No school",
};
const KIND_COLOR: Record<CalendarDay["kind"], string> = {
  term: "#1d3f78",
  school_holiday: "#1f5a3c",
  public_holiday: "#8f1d14",
  half_day: "#8a4207",
  no_school: "#4a5c52",
};
const SOURCE_LABEL: Record<CalendarDay["source"], string> = { moe: "MOE", "data.gov.sg": "data.gov.sg", you: "Added by you" };
const ADDABLE: CalendarDayInput["kind"][] = ["no_school", "half_day", "school_holiday", "term"];

const fieldCls = "w-full px-3 py-2 text-base md:text-sm border border-[var(--rule)] rounded-lg bg-white focus:outline-none focus:border-[var(--stem)]";
const labelCls = "block text-xs font-medium text-[var(--ink-soft)] mb-1";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const d = (iso: string) => parseISO(iso.slice(0, 10));

/** "Fri 20 Nov" or "Sat 21 Nov – Thu 31 Dec", with the year when it isn't this year. */
function dateRange(start: string, end: string): string {
  const s = d(start), e = d(end);
  const year = new Date().getFullYear();
  const fmt = (x: Date) => format(x, x.getFullYear() === year ? "EEE d MMM" : "EEE d MMM yyyy");
  return start.slice(0, 10) === end.slice(0, 10) ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

const blankDay = (calendarId: string | null): CalendarDayInput => ({
  calendar_id: calendarId, start_date: todayIso(), end_date: todayIso(), kind: "no_school", title: "", ends_at: null,
});

/**
 * Settings › Calendar: the school calendars children follow, the days coming up (terms,
 * holidays, public holidays and your own days off), and adding your school's own days.
 * MOE and public-holiday days are imported and read-only; "Update" fetches them again.
 */
export function CalendarTab({ calendars, calendarDays, childList: children, onRefresh }: Props) {
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; form: CalendarDayInput } | null>(null);
  const [newCalendar, setNewCalendar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const moe = calendars.find(c => c.kind === "moe_primary");
  const calendarName = (id: string | null) => (id === null ? "Everyone" : calendars.find(c => c.id === id)?.name ?? "");
  const users = (id: string) => children.filter(c => c.calendar_id === id).map(c => c.name);

  // Upcoming = anything not over yet; terms are left out (they're the normal state, not news).
  const today = todayIso();
  const upcoming = useMemo(
    () => calendarDays.filter(x => x.end_date.slice(0, 10) >= today && x.kind !== "term"),
    [calendarDays, today]
  );
  const shown = showAll ? upcoming : upcoming.slice(0, 8);
  const thisYear = new Date().getFullYear();

  async function runImport() {
    setImporting(true); setImportNote(null);
    try {
      const r = await myDayApi.importCalendar([thisYear, thisYear + 1]);
      const missing = [
        ...r.missing_moe.map(y => `MOE term dates for ${y} aren’t in Bloom yet`),
        ...r.missing_public_holidays.map(y => `public holidays for ${y} aren’t published yet`),
      ];
      setImportNote(missing.length ? `Updated. Note: ${missing.join("; ")}.` : `Up to date for ${thisYear} and ${thisYear + 1}.`);
      onRefresh();
    } catch (e) {
      setImportNote((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function saveDay() {
    if (!editing) return;
    const f = editing.form;
    if (!f.title.trim()) { setError("Give it a name, e.g. “Sports day”."); return; }
    if (f.end_date < f.start_date) { setError("The end date can’t be before the start."); return; }
    if (f.kind === "half_day" && !f.ends_at) { setError("A half day needs the time school ends."); return; }
    setSaving(true); setError("");
    try {
      const input = { ...f, title: f.title.trim(), ends_at: f.kind === "half_day" ? f.ends_at : null };
      if (editing.id) await myDayApi.updateDay(editing.id, input);
      else await myDayApi.addDay(input);
      setEditing(null);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeDay(day: CalendarDay) {
    if (!window.confirm(`Remove “${day.title}”?`)) return;
    await myDayApi.removeDay(day.id).catch(() => {});
    onRefresh();
  }

  async function addCalendar() {
    if (!newCalendar?.trim()) return;
    setSaving(true);
    try { await myDayApi.addCalendar(newCalendar.trim()); setNewCalendar(null); onRefresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeCalendar(c: SchoolCalendar) {
    const who = users(c.id);
    const msg = who.length ? `${who.join(" and ")} follow${who.length === 1 ? "s" : ""} “${c.name}”. Delete it and its days anyway?` : `Delete “${c.name}” and its days?`;
    if (!window.confirm(msg)) return;
    await myDayApi.removeCalendar(c.id).catch(() => {});
    onRefresh();
  }

  const set = (patch: Partial<CalendarDayInput>) => setEditing(e => e && { ...e, form: { ...e.form, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <Fab label="Add a day off or half day" onClick={() => { setError(""); setEditing({ id: null, form: blankDay(moe?.id ?? calendars[0]?.id ?? null) }); }} />

      {/* Calendars */}
      <section className="flex flex-col gap-2">
        <GroupHeading count={calendars.length}>School calendars</GroupHeading>
        {calendars.length > 0 && (
          <SettingsList label="School calendars">
            {calendars.map(c => {
              const who = users(c.id);
              return (
                <SettingsRow
                  key={c.id}
                  title={c.name}
                  tags={who.map(n => <Tag key={n}>{n}</Tag>)}
                  meta={c.kind === "moe_primary" ? "Terms, school holidays and days off from MOE" : "Your own term dates and holidays"}
                  actions={c.kind === "custom" ? (
                    <IconButton icon={Trash2} label={`Delete ${c.name}`} tone="danger" onClick={() => removeCalendar(c)} />
                  ) : undefined}
                />
              );
            })}
          </SettingsList>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={moe ? "secondary" : "primary"} onClick={runImport} loading={importing}>
            <RefreshCw size={16} aria-hidden="true" />
            {moe ? "Update holidays" : "Set up MOE calendar and public holidays"}
          </Button>
          {newCalendar === null ? (
            <Button size="sm" variant="ghost" onClick={() => setNewCalendar("")}>Add a calendar</Button>
          ) : (
            <span className="flex flex-1 min-w-[240px] items-center gap-2">
              <input autoFocus value={newCalendar} onChange={e => setNewCalendar(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCalendar(); if (e.key === "Escape") setNewCalendar(null); }}
                placeholder="e.g. Zara’s preschool" aria-label="New calendar name" className={fieldCls} />
              <Button size="sm" onClick={addCalendar} loading={saving}>Add</Button>
            </span>
          )}
        </div>
        {importNote && <p role="status" className="text-sm leading-5 text-[var(--ink-soft)]">{importNote}</p>}
      </section>

      {/* Coming up */}
      <section className="flex flex-col gap-2">
        <GroupHeading count={upcoming.length}>Coming up</GroupHeading>
        {upcoming.length === 0 ? (
          <p className="text-sm leading-5 text-[var(--ink-soft)]">
            {moe ? "Nothing coming up. Add your school’s own days off with the + button." : "Set up the MOE calendar above to see school holidays and public holidays here."}
          </p>
        ) : (
          <SettingsList label="Coming up">
            {shown.map(x => (
              <SettingsRow
                key={x.id}
                title={x.title}
                tags={<Tag color={KIND_COLOR[x.kind]}>{KIND_LABEL[x.kind]}</Tag>}
                meta={dateRange(x.start_date, x.end_date) + (x.kind === "half_day" && x.ends_at ? ` · ends ${formatTime(x.ends_at)}` : "")}
                sub={[SOURCE_LABEL[x.source], x.source === "you" ? calendarName(x.calendar_id) : null, x.levels ? `Only ${x.levels.replace(/,/g, ", ")}` : null].filter(Boolean).join(" · ")}
                actions={x.source === "you" ? (<>
                  <IconButton icon={Pencil} label={`Edit ${x.title}`} onClick={() => {
                    setError("");
                    setEditing({ id: x.id, form: { calendar_id: x.calendar_id, start_date: x.start_date.slice(0, 10), end_date: x.end_date.slice(0, 10), kind: x.kind as CalendarDayInput["kind"], title: x.title, ends_at: x.ends_at } });
                  }} />
                  <IconButton icon={Trash2} label={`Remove ${x.title}`} tone="danger" onClick={() => removeDay(x)} />
                </>) : undefined}
              />
            ))}
          </SettingsList>
        )}
        {upcoming.length > 8 && (
          <MoreToggle open={showAll} onClick={() => setShowAll(v => !v)}>
            {showAll ? "Show fewer" : `Show all ${upcoming.length}`}
          </MoreToggle>
        )}
      </section>

      {/* Add / edit a day */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit day" : "Add a day off or half day"}>
        {editing && (
          <div className="space-y-4">
            {error && <p className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2">{error}</p>}
            <div>
              <span className={labelCls}>What kind of day</span>
              <div role="group" aria-label="Kind of day" className="grid grid-cols-2 gap-2">
                {ADDABLE.map(k => (
                  <button key={k} type="button" aria-pressed={editing.form.kind === k} onClick={() => set({ kind: k })}
                    className={`h-10 px-3 text-sm font-medium rounded-lg border cursor-pointer ${editing.form.kind === k ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)]" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)]"}`}>
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="day-title" className={labelCls}>Name</label>
              <input id="day-title" value={editing.form.title} onChange={e => set({ title: e.target.value })} className={fieldCls}
                placeholder={editing.form.kind === "half_day" ? "e.g. Last day of term" : editing.form.kind === "term" ? "e.g. Semester 1" : "e.g. PTM day, sports day"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="day-start" className={labelCls}>From</label>
                <input id="day-start" type="date" value={editing.form.start_date}
                  onChange={e => set({ start_date: e.target.value, end_date: editing.form.end_date < e.target.value ? e.target.value : editing.form.end_date })} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="day-end" className={labelCls}>To</label>
                <input id="day-end" type="date" value={editing.form.end_date} min={editing.form.start_date}
                  onChange={e => set({ end_date: e.target.value })} className={fieldCls} />
              </div>
            </div>
            {editing.form.kind === "half_day" && (
              <div>
                <label htmlFor="day-ends" className={labelCls}>School ends at</label>
                <input id="day-ends" type="time" value={editing.form.ends_at ?? ""} onChange={e => set({ ends_at: e.target.value || null })} className={fieldCls} />
              </div>
            )}
            <div>
              <label htmlFor="day-cal" className={labelCls}>For</label>
              <select id="day-cal" value={editing.form.calendar_id ?? ""} onChange={e => set({ calendar_id: e.target.value || null })} className={fieldCls}>
                <option value="">Every child</option>
                {calendars.map(c => <option key={c.id} value={c.id}>Children on {c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveDay} loading={saving}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
