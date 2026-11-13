"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react";
import { Header, BackButton } from "@/components/layout/Header";
import { Page, PageBody } from "@/components/layout/Page";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { GoalFormModal, inputCls, labelCls } from "@/components/goals/GoalFormModal";
import { PlanPanel } from "@/components/goals/PlanPanel";
import { GoalChart } from "@/components/goals/GoalChart";
import { useChildren, useGoals } from "@/lib/api-hooks";
import { goalApi, useRefreshGoals } from "@/lib/goal-api";
import { cn, formatDate } from "@/lib/utils";
import { useSnackbar } from "@/components/ui/Snackbar";
import {
  TONE_CLASSES, achievedDate, day, earlyLateLabel, fmtValue, goalStatus, measuredProgress, milestoneProgress, round1,
  timeLeftLabel, todayISO,
} from "@/lib/goal-progress";
import type { Goal } from "@/lib/types";

export function GoalDetailView({ goalId }: { goalId: string }) {
  const router = useRouter();
  const { data: goals = [], isLoading } = useGoals();
  const { data: children = [] } = useChildren();
  const [editing, setEditing] = useState(false);
  const goal = goals.find(g => g.id === goalId);
  const child = children.find(c => c.id === goal?.child_id);
  const today = todayISO();

  const back = <BackButton icon={ArrowLeft} onClick={() => router.back()} />;

  if (isLoading) {
    return (
      <Page>
        <Header title="Goal" leading={back} subtitle=" " />
        <PageBody>{[1, 2, 3].map(i => <div key={i} className="h-24 bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />)}</PageBody>
      </Page>
    );
  }
  if (!goal) {
    return (
      <Page>
        <Header title="Goal not found" subtitle="It may have been deleted." leading={back} />
      </Page>
    );
  }

  const status = goalStatus(goal, today);
  const target = day(goal.target_date);
  const done = achievedDate(goal);
  const title = goal.kind === "measured" ? `${goal.title} → ${fmtValue(goal.target_value ?? 0, goal.unit)}` : goal.title;

  return (
    <Page>
      {/* The header carries the child; the goal title sits below it so long titles wrap instead of truncating. */}
      <Header
        title={child?.name ?? "Goal"}
        subtitle={goalLine(goal, today)}
        leading={back}
        action={<IconButton icon={Pencil} label="Edit goal" onClick={() => setEditing(true)} />}
      />
      <PageBody clear="nav">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl leading-7 font-bold tracking-tight text-[var(--ink)]">{title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm leading-5 text-[var(--ink-soft)]">
            <span>By {formatDate(target)}{done ? "" : ` · ${timeLeftLabel(today, target)}`}</span>
            <span className={cn("text-xs leading-4 font-bold px-2 py-1 rounded-full", TONE_CLASSES[status.tone])}>{status.label}</span>
          </div>
        </div>

        {goal.kind === "milestone" ? <MilestoneBody goal={goal} today={today} /> : <MeasuredBody goal={goal} today={today} />}
      </PageBody>

      {editing && (
        <GoalFormModal open onClose={() => setEditing(false)} child={child} goal={goal} onDeleted={() => router.replace("/goals")} />
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ milestone

function MilestoneBody({ goal, today }: { goal: Goal; today: string }) {
  const refresh = useRefreshGoals();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const snack = useSnackbar();
  const [error, setError] = useState<string | null>(null);
  const achieved = goal.achieved_date ? day(goal.achieved_date) : null;
  const notes = goal.entries.filter(e => e.note).slice().reverse();

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  return (
    <>
      {error && <p className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2">{error}</p>}
      {achieved && (
        <div className="flex items-center justify-between gap-3 bg-[#d9eadc] px-4 py-3 rounded-[var(--radius-lg)]">
          <span className="text-sm font-semibold text-[#1f5a3c]">Achieved {formatDate(achieved)} — {earlyLateLabel(achieved, day(goal.target_date))}</span>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => goalApi.update(goal.id, { achieved_date: null }))}>Reopen</Button>
        </div>
      )}

      <PlanPanel key={goal.id} goal={goal} today={today} />

      <section className="space-y-2">
        <h2 className="font-semibold text-[var(--ink)]">Updates</h2>
        {!achieved && (
          <form className="flex gap-2 items-end" onSubmit={e => {
            e.preventDefault();
            const text = note.trim();
            if (text) run(async () => { await goalApi.addEntry(goal.id, { date: today, note: text }); setNote(""); });
          }}>
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} aria-label="Add an update"
              placeholder="What happened? A first, a setback, a good day…" className={cn(inputCls, "resize-none flex-1")} />
            <Button type="submit" variant="secondary" disabled={!note.trim()} loading={busy}>Add</Button>
          </form>
        )}
        <ol className="relative pl-6 space-y-4 pt-1">
          <span className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-[var(--rule)]" aria-hidden="true" />
          {achieved && (
            <TimelineItem date={achieved} dot="bg-[#16A34A] border-[#16A34A]">
              <span className="font-semibold">Achieved — {earlyLateLabel(achieved, day(goal.target_date))}</span>
            </TimelineItem>
          )}
          {notes.map(n => (
            <TimelineItem key={n.id} date={day(n.date)} dot="bg-[#9aa9a0] border-[#9aa9a0]"
              onDelete={() => run(async () => {
                await goalApi.removeEntry(n.id);
                snack({ message: "Update deleted", action: { label: "Undo", onClick: () => run(() => goalApi.addEntry(n.goal_id, { date: day(n.date), note: n.note ?? undefined })) } });
              })}>
              {n.note}
            </TimelineItem>
          ))}
          <TimelineItem date={day(goal.created_at)} dot="bg-[var(--sheet)] border-[#9aa9a0]">
            Goal set — by {formatDate(day(goal.target_date))}
          </TimelineItem>
        </ol>
      </section>

      {!achieved && (
        <Button size="lg" className="w-full" disabled={busy} onClick={() => run(() => goalApi.update(goal.id, { achieved_date: today }))}>
          <Check size={20} strokeWidth={3} /> Mark goal achieved
        </Button>
      )}
    </>
  );
}

function TimelineItem({ date, dot, children, onDelete }: { date: string; dot: string; children: React.ReactNode; onDelete?: () => void }) {
  return (
    <li className="relative flex items-start gap-2">
      <span className={cn("absolute -left-6 top-1 w-3 h-3 rounded-full border-2", dot)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--ink-soft)]">{formatDate(date)}</p>
        <p className="text-sm text-[var(--ink)] whitespace-pre-line">{children}</p>
      </div>
      {onDelete && (
        <IconButton icon={Trash2} label="Delete update" tone="danger" onClick={onDelete} className="-mt-3" />
      )}
    </li>
  );
}

// ------------------------------------------------------------------ measured

function MeasuredBody({ goal, today }: { goal: Goal; today: string }) {
  const refresh = useRefreshGoals();
  const m = measuredProgress(goal);
  const unit = goal.unit;
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [busy, setBusy] = useState(false);
  const snack = useSnackbar();
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  const perMonth = m.slopePerDay !== null ? round1(m.slopePerDay * 30.4) : null;
  const ahead = m.aheadOfPlan !== null ? round1(m.aheadOfPlan) : null;
  const rows = [...m.readings].reverse();

  return (
    <>
      {error && <p className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        <Tile big={m.latest ? fmtValue(m.latest.value, unit) : "—"} small={m.latest ? `now · ${formatDate(m.latest.date)}` : "no readings"} />
        <Tile big={fmtValue(goal.target_value ?? 0, unit)} small="target" />
        <Tile big={m.remaining === null ? "—" : m.remaining <= 0 ? "Done" : fmtValue(m.remaining, unit)} small="to go" />
      </div>

      <section className="bg-[var(--sheet)] rounded-[var(--radius-lg)] p-4 space-y-3">
        <h2 className="font-semibold text-[var(--ink)]">Progress over time</h2>
        {m.readings.length < 2 ? (
          <p className="text-sm text-[var(--ink-soft)]">Log one more reading to see the chart.</p>
        ) : (
          <>
            <GoalChart goal={goal} progress={m} today={today} />
            <div className="text-sm space-y-1">
              {ahead !== null && (
                <p className="font-semibold text-[var(--ink)]">
                  {Math.abs(ahead) < 0.1 ? "Right on the planned path" : `${fmtValue(Math.abs(ahead), unit)} ${ahead > 0 ? "ahead of" : "behind"} the planned path`}
                </p>
              )}
              {perMonth !== null && m.projected !== null && day(goal.target_date) > m.latest!.date && (
                <p className="text-[var(--ink-soft)]">
                  Trend: about {perMonth >= 0 ? "+" : ""}{perMonth} {unit} a month, which lands around {fmtValue(m.projected, unit)} by {formatDate(day(goal.target_date))}
                  {m.reachesOnTrend ? " — reaches the target." : ` — short of ${fmtValue(goal.target_value ?? 0, unit)}.`}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <form className="grid grid-cols-[1fr_auto_auto] gap-2 items-end" onSubmit={e => {
        e.preventDefault();
        const v = Number(value);
        if (value.trim() !== "" && !isNaN(v) && date) run(async () => { await goalApi.addEntry(goal.id, { date, value: v }); setValue(""); });
      }}>
        <div>
          <label htmlFor="reading-value" className={labelCls}>New reading{unit ? ` (${unit})` : ""}</label>
          <input id="reading-value" type="number" inputMode="decimal" step="any" value={value} onChange={e => setValue(e.target.value)}
            placeholder={m.latest ? String(round1(m.latest.value)) : ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="reading-date" className={labelCls}>Date</label>
          <input id="reading-date" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={cn(inputCls, "w-auto")} />
        </div>
        <Button type="submit" disabled={value.trim() === "" || isNaN(Number(value))} loading={busy}>Log</Button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold text-[var(--ink)]">Readings</h2>
        <ul className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden divide-y divide-[var(--rule)]">
          {rows.map((r, i) => {
            const prev = rows[i + 1];
            const change = prev ? round1(r.value - prev.value) : null;
            if (editId === r.id) {
              return (
                <li key={r.id} className="p-3 flex flex-wrap items-end gap-2">
                  <input type="date" value={editDate} max={today} onChange={e => setEditDate(e.target.value)} aria-label="Reading date" className={cn(inputCls, "w-auto")} />
                  <input type="number" inputMode="decimal" step="any" value={editValue} onChange={e => setEditValue(e.target.value)} aria-label="Reading value" className={cn(inputCls, "w-28")} />
                  <Button size="sm" variant="secondary" onClick={() => setEditId(null)}>Cancel</Button>
                  <Button size="sm" loading={busy} disabled={editValue.trim() === "" || isNaN(Number(editValue)) || !editDate}
                    onClick={() => run(async () => { await goalApi.updateEntry(r.id, { date: editDate, value: Number(editValue) }); setEditId(null); })}>Save</Button>
                </li>
              );
            }
            return (
              <li key={r.id} className="flex items-center gap-2 pl-4 pr-1 py-1 text-sm">
                <span className="text-[var(--ink-soft)] flex-1">{formatDate(r.date)}</span>
                <span className="text-xs text-[var(--ink-soft)] w-12 text-right">{change === null ? "start" : `${change >= 0 ? "+" : ""}${change}`}</span>
                <span className="font-semibold text-[var(--ink)] w-20 text-right">{fmtValue(r.value, unit)}</span>
                <button type="button" aria-label={`Edit reading on ${formatDate(r.date)}`} onClick={() => { setEditId(r.id); setEditValue(String(r.value)); setEditDate(r.date); }}
                  className="w-12 h-12 flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer"><Pencil size={16} /></button>
                <button type="button" aria-label={`Delete reading on ${formatDate(r.date)}`} disabled={rows.length === 1}
                  onClick={() => run(async () => {
                    await goalApi.removeEntry(r.id);
                    snack({ message: `Reading of ${fmtValue(r.value, unit)} deleted`, action: { label: "Undo", onClick: () => run(() => goalApi.addEntry(goal.id, { date: day(r.date), value: r.value })) } });
                  })}
                  className="w-12 h-12 flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--margin)] cursor-pointer disabled:opacity-30 disabled:cursor-default"><Trash2 size={16} /></button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Tile({ big, small }: { big: string; small: string }) {
  return (
    <div className="bg-[var(--sheet)] rounded-[var(--radius-lg)] p-3">
      <div className="text-lg font-bold text-[var(--ink)] leading-tight">{big}</div>
      <div className="text-xs text-[var(--ink-soft)] mt-1">{small}</div>
    </div>
  );
}

/** "Milestone · 3 of 7 steps done" / "Measured · latest 124 cm, 6 cm to go". */
function goalLine(goal: Goal, today: string): string {
  if (goal.kind === "milestone") {
    const { checkpoints, hitCount } = milestoneProgress(goal, today);
    return checkpoints.length ? `Milestone · ${hitCount} of ${checkpoints.length} steps done` : "Milestone · no plan yet";
  }
  const { latest, remaining, reached } = measuredProgress(goal);
  if (!latest) return "Measured · no readings yet";
  const now = `latest ${fmtValue(latest.value, goal.unit)}`;
  return reached || remaining === null ? `Measured · ${now}, target reached` : `Measured · ${now}, ${fmtValue(round1(remaining), goal.unit)} to go`;
}
