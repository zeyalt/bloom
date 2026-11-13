"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Fab } from "@/components/ui/Fab";
import { IconButton } from "@/components/ui/IconButton";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { GroupHeading, MoreToggle, SettingsList, SettingsRow, Tag } from "@/components/settings/SettingsList";
import { activityLabel } from "@/lib/my-day";
import { myDayApi, type RoutineItemInput } from "@/lib/my-day-api";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { cn, formatTime } from "@/lib/utils";
import { useSnackbar } from "@/components/ui/Snackbar";
import type { Activity, Child, Goal, RoutineItem, RoutineTier, Schedule } from "@/lib/types";

interface Props {
  childList: Child[];
  routine: RoutineItem[];
  activities: Activity[];
  schedules: Schedule[];
  goals: Goal[];
  onRefresh: () => void;
}

// The names the kids see on My Day, used here too so everyone talks about the same thing.
const GROUPS: { tier: RoutineTier; title: string; hint: string }[] = [
  { tier: "anchor", title: "Today", hint: "Set times on their timetable, like dinner and bedtime. Not ticked." },
  { tier: "must", title: "1 · Do first", hint: "Jobs to finish first. Free Play unlocks when they’re all done." },
  { tier: "practice", title: "2 · Hobby", hint: "Practice and hobbies, after Do first." },
  { tier: "free", title: "3 · Free Play", hint: "Things they can choose from once Do first is done." },
];
const TIER_LABEL: Record<RoutineTier, string> = { anchor: "Today (set time)", must: "Do first", practice: "Hobby", free: "Free Play" };
const DAY_TYPE_LABEL = { school: "School days", holiday: "Holidays", any: "Every day" } as const;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const fieldCls = "w-full px-3 py-2 text-base md:text-sm border border-[var(--rule)] rounded-[var(--radius-md)] bg-white focus:outline-none focus:border-[var(--stem)]";
const labelCls = "block text-xs font-medium text-[var(--ink-soft)] mb-1";
const chipCls = (on: boolean) => cn(
  "relative h-10 px-3 text-sm font-medium rounded-full border cursor-pointer",
  "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
  on ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)]" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)]"
);

const dayList = (days: number[]) =>
  DAYS_OF_WEEK.filter(d => days.includes(d.value)).map(d => d.label).join(", ");
const todayIso = () => format(new Date(), "yyyy-MM-dd");
const shortDate = (iso: string) => format(parseISO(iso.slice(0, 10)), "d MMM yyyy");

/**
 * Settings › Routines: each child's checklist. Each line runs on the weekdays picked, from a
 * start date to an optional end date; lines past their end date fold away under "Show N
 * completed". Shows the automatic lines too (class prep from Activities, practice from Goals).
 */
export function RoutinesTab({ childList: children, routine, activities, schedules, goals, onRefresh }: Props) {
  const [childId, setChildId] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: RoutineItemInput } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const snack = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeChild = childId || children[0]?.id || "";
  const child = children.find(c => c.id === activeChild);

  const today = todayIso();
  const all = routine.filter(r => r.child_id === activeChild).sort((a, b) => a.sort_order - b.sort_order);
  const ended = (r: RoutineItem) => !!r.end_date && r.end_date.slice(0, 10) < today;
  const mine = all.filter(r => !ended(r));
  const completed = all.filter(ended).sort((a, b) => b.end_date!.localeCompare(a.end_date!));

  // Automatic lines: prep for each class with lessons, practice from open goals.
  const prep = activities
    .filter(a => a.child_id === activeChild && a.status === "active" && a.prep_task)
    .map(a => {
      const days = schedules
        .filter(s => s.activity_id === a.id && s.is_active && (!s.effective_until || s.effective_until.slice(0, 10) >= today))
        .map(s => s.day_of_week);
      return { a, days: [...new Set(days)] };
    })
    .filter(({ days }) => days.length > 0);
  const practice = goals.filter(g => g.child_id === activeChild && !g.achieved_date && g.practice_task);

  function openAdd() {
    setError("");
    setEditing({ id: null, form: { weekdays: ALL_DAYS, start_date: todayIso(), end_date: null, tier: "must", title: "", at_time: null } });
  }
  function openEdit(r: RoutineItem) {
    setError("");
    setEditing({ id: r.id, form: {
      weekdays: r.weekdays.length ? r.weekdays : ALL_DAYS, start_date: r.start_date.slice(0, 10),
      end_date: r.end_date ? r.end_date.slice(0, 10) : null, tier: r.tier, title: r.title, at_time: r.at_time,
    } });
  }

  async function save() {
    if (!editing) return;
    const f = editing.form;
    if (!f.title.trim()) { setError("What should they do? Give it a name."); return; }
    if (f.tier === "anchor" && !f.at_time) { setError("A fixed time needs a time."); return; }
    if (!f.weekdays.length) { setError("Pick at least one day of the week."); return; }
    if (!f.start_date) { setError("Pick a start date."); return; }
    if (f.end_date && f.end_date < f.start_date) { setError("The end date can’t be before the start date."); return; }
    setSaving(true); setError("");
    try {
      const input = { ...f, title: f.title.trim(), at_time: f.tier === "anchor" ? f.at_time : null };
      if (editing.id) await myDayApi.updateRoutineItem(editing.id, input);
      else await myDayApi.addRoutineItem({ ...input, child_id: activeChild });
      setEditing(null);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove() {
    const r = editing?.id ? all.find(x => x.id === editing.id) : null;
    if (!r) return;
    setSaving(true);
    try {
      const order = all.map(x => x.id);
      await myDayApi.removeRoutineItem(r.id);
      setEditing(null);
      onRefresh();
      // Undo puts it back, in the same place in the list.
      snack({ message: `Removed “${r.title}”`, action: { label: "Undo", onClick: async () => {
        const back = await myDayApi.addRoutineItem({
          child_id: r.child_id, weekdays: r.weekdays, start_date: r.start_date.slice(0, 10),
          end_date: r.end_date ? r.end_date.slice(0, 10) : null, tier: r.tier, title: r.title, at_time: r.at_time,
        });
        await myDayApi.reorderRoutine(order.map(id => (id === r.id ? back.id : id))).catch(() => {});
        onRefresh();
      } } });
    }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  /** Swap with the neighbour above/below in the same group, then save the order. */
  async function move(r: RoutineItem, dir: -1 | 1) {
    const group = mine.filter(x => x.tier === r.tier);
    const other = group[group.findIndex(x => x.id === r.id) + dir];
    if (!other) return;
    const ids = mine.map(x => x.id);
    const i = ids.indexOf(r.id), j = ids.indexOf(other.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await myDayApi.reorderRoutine(ids).catch(() => {});
    onRefresh();
  }

  const set = (patch: Partial<RoutineItemInput>) => setEditing(e => e && { ...e, form: { ...e.form, ...patch } });
  const toggleDay = (d: number) => editing && set({
    weekdays: editing.form.weekdays.includes(d) ? editing.form.weekdays.filter(x => x !== d) : [...editing.form.weekdays, d],
  });

  function tagsFor(r: RoutineItem) {
    const start = r.start_date.slice(0, 10);
    return <>
      <Tag>{r.weekdays.length ? dayList(r.weekdays) : "Every day"}</Tag>
      {start > today && <Tag color="#1d3f78">From {shortDate(start)}</Tag>}
      {r.end_date && <Tag color={ended(r) ? undefined : "#8a4207"}>{ended(r) ? "Ended" : "Until"} {shortDate(r.end_date)}</Tag>}
    </>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Fab label="Add to routine" onClick={openAdd} />

      <ChildFilter single childList={children} selected={activeChild ? [activeChild] : []} onToggle={id => { setChildId(id); setShowDone(false); }} />

      {GROUPS.map(({ tier, title, hint }) => {
        const rows = mine.filter(r => r.tier === tier);
        const ordered = tier === "anchor" ? [...rows].sort((a, b) => (a.at_time ?? "").localeCompare(b.at_time ?? "")) : rows;
        const autoPrep = tier === "must" ? prep : [];
        const autoPractice = tier === "practice" ? practice : [];
        const count = ordered.length + autoPrep.length + autoPractice.length;
        return (
          <section key={tier} className="flex flex-col gap-2">
            <div>
              <GroupHeading count={count}>{title}</GroupHeading>
              {hint && <p className="-mt-1 pb-1 text-xs leading-4 text-[var(--ink-faint)]">{hint}</p>}
            </div>
            {count === 0 ? (
              <p className="text-sm leading-5 text-[var(--ink-faint)]">Nothing yet.</p>
            ) : (
              <SettingsList label={title}>
                {ordered.map((r, i) => (
                  <SettingsRow
                    key={r.id}
                    title={tier === "anchor" && r.at_time ? `${formatTime(r.at_time)} · ${r.title}` : r.title}
                    tags={tagsFor(r)}
                    actions={<>
                      {tier !== "anchor" && <>
                        <IconButton icon={ArrowUp} label={`Move ${r.title} up`} onClick={() => move(r, -1)} disabled={i === 0} />
                        <IconButton icon={ArrowDown} label={`Move ${r.title} down`} onClick={() => move(r, 1)} disabled={i === ordered.length - 1} />
                      </>}
                      <IconButton icon={Pencil} label={`Edit ${r.title}`} onClick={() => openEdit(r)} />
                    </>}
                  />
                ))}
                {autoPrep.map(({ a, days }) => (
                  <SettingsRow key={`prep-${a.id}`} title={a.prep_task!}
                    tags={<Tag color="#4a5c52">Auto · {activityLabel(a)}</Tag>}
                    meta={`On ${activityLabel(a)} days (${dayList(days)}) · change it in Activities`} />
                ))}
                {autoPractice.map(g => (
                  <SettingsRow key={`goal-${g.id}`} title={g.practice_task!}
                    tags={<>{g.practice_days && g.practice_days !== "any" && <Tag>{DAY_TYPE_LABEL[g.practice_days]}</Tag>}<Tag color="#4a5c52">Auto · goal</Tag></>}
                    meta={`From the goal “${g.title}” · change it in Goals`} />
                ))}
              </SettingsList>
            )}
          </section>
        );
      })}

      {completed.length > 0 && (
        <section className="flex flex-col gap-2">
          <MoreToggle open={showDone} onClick={() => setShowDone(v => !v)}>
            {showDone ? "Hide" : "Show"} {completed.length} completed routine{completed.length === 1 ? "" : "s"}
          </MoreToggle>
          {showDone && (
            <SettingsList label="Completed routines">
              {completed.map(r => (
                <SettingsRow key={r.id} title={r.title} tags={<><Tag>{TIER_LABEL[r.tier]}</Tag>{tagsFor(r)}</>}
                  actions={<IconButton icon={Pencil} label={`Edit ${r.title}`} onClick={() => openEdit(r)} />} />
              ))}
            </SettingsList>
          )}
        </section>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit routine item" : `Add to ${child?.name ?? ""}’s routine`}>
        {editing && (
          <div className="space-y-4">
            {error && <p className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2">{error}</p>}
            <div>
              <span className={labelCls}>Group</span>
              <div role="group" aria-label="Group" className="grid grid-cols-2 gap-2">
                {(["must", "practice", "free", "anchor"] as RoutineTier[]).map(t => (
                  <button key={t} type="button" aria-pressed={editing.form.tier === t} onClick={() => set({ tier: t })}
                    className={cn("h-10 px-3 text-sm font-medium rounded-[var(--radius-md)] border cursor-pointer",
                      editing.form.tier === t ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)]" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)]")}>
                    {TIER_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn(editing.form.tier === "anchor" && "grid grid-cols-[minmax(0,1fr)_128px] gap-3")}>
              <div>
                <label htmlFor="routine-title" className={labelCls}>{editing.form.tier === "anchor" ? "What" : "Task"}</label>
                <input id="routine-title" value={editing.form.title} onChange={e => set({ title: e.target.value })} className={fieldCls}
                  placeholder={{ anchor: "e.g. Dinner", must: "e.g. Lunch and shower", practice: "e.g. Read a book · 20 min", free: "e.g. Lego" }[editing.form.tier]} />
              </div>
              {editing.form.tier === "anchor" && (
                <div>
                  <label htmlFor="routine-time" className={labelCls}>Time</label>
                  <input id="routine-time" type="time" value={editing.form.at_time ?? ""} onChange={e => set({ at_time: e.target.value || null })} className={fieldCls} />
                </div>
              )}
            </div>
            <div>
              <span className={labelCls}>Days of the week</span>
              <div role="group" aria-label="Days of the week" className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(d => (
                  <button key={d.value} type="button" aria-pressed={editing.form.weekdays.includes(d.value)} onClick={() => toggleDay(d.value)} className={chipCls(editing.form.weekdays.includes(d.value))}>{d.label}</button>
                ))}
              </div>
              <p className="mt-1 text-xs leading-4 text-[var(--ink-soft)]">
                {editing.form.weekdays.length === 7 ? "Every day." : editing.form.weekdays.length ? `Only on ${dayList(editing.form.weekdays)}.` : "Pick at least one day."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="routine-start" className={labelCls}>Start date</label>
                <input id="routine-start" type="date" value={editing.form.start_date} onChange={e => set({ start_date: e.target.value })} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="routine-end" className={labelCls}>End date (optional)</label>
                <input id="routine-end" type="date" value={editing.form.end_date ?? ""} min={editing.form.start_date}
                  onChange={e => set({ end_date: e.target.value || null })} className={fieldCls} />
              </div>
            </div>
            <p className="-mt-2 flex items-center gap-2 text-xs leading-4 text-[var(--ink-soft)]">
              {editing.form.end_date ? <>
                Ends {shortDate(editing.form.end_date)}.
                <button type="button" onClick={() => set({ end_date: null })}
                  className="relative font-semibold text-[var(--stem)] underline cursor-pointer before:absolute before:-inset-3 before:content-['']">Remove end date</button>
              </> : "No end date: it carries on."}
            </p>
            {/* Cancel and Save share the row; Remove sits on its own line below, so nothing
                overflows on a phone and it's hard to hit by accident. */}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button className="flex-1" onClick={save} loading={saving}>Save</Button>
            </div>
            {editing.id && (
              <Button variant="danger" className="w-full" onClick={remove} disabled={saving}>
                <Trash2 size={16} aria-hidden="true" /> Remove from routine
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
