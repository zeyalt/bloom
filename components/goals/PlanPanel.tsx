"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn, formatDate } from "@/lib/utils";
import { goalApi, useRefreshGoals } from "@/lib/goal-api";
import { day, milestoneProgress, timeLeftLabel } from "@/lib/goal-progress";
import type { Goal, GoalCheckpoint } from "@/lib/types";
import { inputCls, labelCls } from "./GoalFormModal";

type Mode = "view" | "prompt" | "drafting" | "edit";
interface DraftRow { key: string; id?: string; due_date: string; text: string; hit_date: string | null }

let keySeq = 0;
const newKey = () => `row-${++keySeq}`;

/**
 * A milestone goal's action plan: ask Claude for a draft (or write one), edit it, save it,
 * then tick checkpoints off. The same flow for every goal, whatever it is about.
 */
export function PlanPanel({ goal, today }: { goal: Goal; today: string }) {
  const refresh = useRefreshGoals();
  const progress = milestoneProgress(goal, today);
  const hasPlan = progress.checkpoints.length > 0;
  const open = !goal.achieved_date;

  const [mode, setMode] = useState<Mode>("view");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [fromClaude, setFromClaude] = useState(false);
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown: Mode = mode === "view" && !hasPlan && open ? "prompt" : mode;
  // Rows keep the checkpoint's id, so saving edits it in place and its focus points stay.
  const keptHits = (): DraftRow[] =>
    progress.checkpoints.filter(c => c.hit_date).map(c => ({ key: newKey(), id: c.id, due_date: day(c.due_date), text: c.text, hit_date: day(c.hit_date!) }));

  function startEdit() {
    setRows(progress.checkpoints.map(c => ({ key: newKey(), id: c.id, due_date: day(c.due_date), text: c.text, hit_date: c.hit_date ? day(c.hit_date) : null })));
    setFromClaude(false); setError(null); setMode("edit");
  }
  function writeOwn() {
    setRows([...keptHits(), { key: newKey(), due_date: day(goal.target_date), text: "", hit_date: null }]);
    setFromClaude(false); setError(null); setMode("edit");
  }
  async function draft() {
    setError(null); setMode("drafting");
    try {
      const res = await goalApi.draftPlan(goal.id, context, today);
      setRows([...keptHits(), ...res.checkpoints.map(c => ({ key: newKey(), due_date: c.due_date, text: c.text, hit_date: null }))]);
      setFromClaude(true); setMode("edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft a plan");
      setMode("prompt");
    }
  }
  async function save() {
    const clean = rows.filter(r => r.text.trim() && r.due_date);
    setSaving(true); setError(null);
    try {
      await goalApi.savePlan(goal.id, clean.map(r => ({ id: r.id, due_date: r.due_date, text: r.text.trim(), hit_date: r.hit_date })));
      await refresh();
      setMode("view"); setRows([]); setContext("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the plan");
    } finally {
      setSaving(false);
    }
  }
  async function toggleHit(id: string, hit: boolean) {
    setBusyId(id);
    try {
      await goalApi.setCheckpointHit(id, hit ? null : today);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }
  const patchRow = (key: string, patch: Partial<DraftRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const monthsLeft = timeLeftLabel(today, day(goal.target_date)).replace(" left", "");

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--ink)]">Action plan</h2>
        {shown === "view" && hasPlan && open && (
          <Button variant="secondary" size="sm" onClick={startEdit}><Pencil size={16} /> Edit plan</Button>
        )}
      </div>
      {error && <p className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2">{error}</p>}

      {shown === "prompt" && (
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-4 space-y-3">
          <p className="text-sm text-[var(--ink)]">
            Claude can break this goal into dated checkpoints that fit the {monthsLeft} until {formatDate(day(goal.target_date))}.
          </p>
          <div>
            <label htmlFor="plan-context" className={labelCls}>Anything Claude should know? <span className="font-normal">(optional)</span></label>
            <textarea id="plan-context" rows={2} value={context} onChange={e => setContext(e.target.value)} maxLength={2000}
              className={cn(inputCls, "resize-none")} placeholder="e.g. what they can already do, what’s been hard so far" />
          </div>
          {hasPlan && (
            <p className="text-xs text-[#8a3f06]">A new draft replaces the current checkpoints when you save it. Checkpoints already hit are kept.</p>
          )}
          <div className="flex gap-2">
            {hasPlan && <Button variant="secondary" className="flex-1" onClick={() => setMode("view")}>Cancel</Button>}
            <Button className="flex-[2]" onClick={draft}><Sparkles size={16} /> Draft action plan</Button>
          </div>
          <button type="button" onClick={writeOwn} className="block mx-auto min-h-12 px-2 text-sm font-semibold text-[var(--stem)] cursor-pointer hover:underline">
            Or write the checkpoints myself
          </button>
        </div>
      )}

      {shown === "drafting" && (
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-4 flex items-center gap-3 text-sm text-[var(--ink)]" role="status">
          <Loader2 size={20} className="animate-spin text-[var(--stem)]" /> Drafting checkpoints…
        </div>
      )}

      {shown === "edit" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-soft)]">
            {fromClaude
              ? `Claude’s draft. Change any date or wording, add or remove checkpoints, then save.`
              : "Change any date or wording, add or remove checkpoints. Ticks on checkpoints already hit are kept."}
          </p>
          <div className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden divide-y divide-[var(--rule)]">
            {rows.map((r, i) => (
              <div key={r.key} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <label htmlFor={`due-${r.key}`} className="text-xs font-semibold text-[var(--stem)]">By</label>
                  <input id={`due-${r.key}`} type="date" value={r.due_date} max={day(goal.target_date)}
                    onChange={e => patchRow(r.key, { due_date: e.target.value })}
                    className={cn(inputCls, "w-auto min-w-0 py-2")} />
                  {r.hit_date && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#d9eadc] text-[#1f5a3c] whitespace-nowrap">Hit {format(parseISO(r.hit_date), "d MMM")}</span>
                  )}
                  <span className="flex-1" />
                  <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                    aria-label={`Remove checkpoint ${i + 1}`}
                    className="w-12 h-12 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--margin)] cursor-pointer">
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea rows={2} value={r.text} onChange={e => patchRow(r.key, { text: e.target.value })} maxLength={500}
                  aria-label={`Checkpoint ${i + 1}`} placeholder="What should be true by then?" className={cn(inputCls, "resize-none")} />
              </div>
            ))}
            <button type="button"
              onClick={() => setRows(rs => [...rs, { key: newKey(), due_date: day(goal.target_date), text: "", hit_date: null }])}
              className="w-full min-h-12 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--stem)] cursor-pointer hover:bg-[var(--bg-secondary)]">
              <Plus size={16} /> Add checkpoint
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setMode("view"); setRows([]); }} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={save} loading={saving}>Save plan</Button>
          </div>
          <button type="button" onClick={() => setMode("prompt")}
            className="mx-auto flex items-center gap-2 min-h-12 px-2 text-sm font-semibold text-[var(--stem)] cursor-pointer hover:underline">
            <Sparkles size={16} /> Redraft with Claude
          </button>
        </div>
      )}

      {shown === "view" && hasPlan && (
        <>
          <ol className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden divide-y divide-[var(--rule)]">
            {progress.checkpoints.map(c => {
              const hit = c.state === "hit", missed = c.state === "missed", next = c.state === "next";
              const meta = hit
                ? `Hit ${formatDate(day(c.hit_date!))} · aimed for ${formatDate(day(c.due_date))}`
                : missed ? `Missed — was due ${formatDate(day(c.due_date))}`
                : `${next ? "Next · " : ""}by ${formatDate(day(c.due_date))}`;
              return (
                <li key={c.id} className={cn(next && "bg-[#eef5ef]")}>
                  <div className="flex items-center gap-1 pr-3">
                    <button type="button" onClick={() => toggleHit(c.id, hit)} disabled={busyId === c.id || !open}
                      aria-pressed={hit} aria-label={hit ? `Unmark: ${c.text}` : `Mark hit: ${c.text}`}
                      className="w-12 h-12 shrink-0 flex items-center justify-center cursor-pointer disabled:cursor-default">
                      <span className={cn(
                        "w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-white",
                        hit ? "bg-[var(--stem)] border-[var(--stem)]"
                          : missed ? "border-[#b45309]"
                          : next ? "border-[var(--stem)]" : "border-dashed border-[#9aa9a0]"
                      )}>
                        {busyId === c.id ? <Loader2 size={16} className="animate-spin text-[var(--ink-soft)]" /> : hit && <Check size={16} strokeWidth={3.2} />}
                      </span>
                    </button>
                    <div className="py-2 min-w-0">
                      <p className={cn("text-sm text-[var(--ink)]", next ? "font-semibold" : "font-medium")}>{c.text}</p>
                      <p className={cn("text-xs", missed ? "text-[#8a3f06]" : "text-[var(--ink-soft)]")}>{meta}</p>
                    </div>
                  </div>
                  {/* The how: focus points, open by default on the current checkpoint. */}
                  <FocusList checkpoint={c} today={today} canEdit={open && !hit} startOpen={next} />
                </li>
              );
            })}
          </ol>
          {open && <p className="text-xs text-[var(--ink-soft)]">Tap a circle when a checkpoint is hit.</p>}
        </>
      )}
    </section>
  );
}

/**
 * The focus points under one checkpoint: what to work on to hit it ("plan during
 * inspection"). Each is "working on it" until a parent marks it got. Collapsed on
 * checkpoints other than the current one, so the plan stays short.
 */
function FocusList({ checkpoint, today, canEdit, startOpen }: {
  checkpoint: GoalCheckpoint; today: string; canEdit: boolean; startOpen: boolean;
}) {
  const refresh = useRefreshGoals();
  const [open, setOpen] = useState(startOpen);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const items = checkpoint.focus ?? [];
  const working = items.filter(f => !f.got_date).length;
  if (items.length === 0 && !canEdit) return null;

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try { await fn(); await refresh(); } finally { setBusy(null); }
  }
  async function add() {
    const t = text.trim();
    if (!t) { setAdding(false); return; }
    await run("new", () => goalApi.addFocus(checkpoint.id, t));
    setText("");
  }

  const summary = items.length === 0 ? "Add a focus point"
    : working === 0 ? `${items.length} focus point${items.length === 1 ? "" : "s"}, all got`
    : `${working} focus point${working === 1 ? "" : "s"}`;

  return (
    <div className="pl-12 pr-3 pb-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="relative -ml-1 inline-flex items-center gap-1 min-h-8 px-1 text-xs font-semibold text-[var(--stem)] cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']">
          <ChevronDown size={14} aria-hidden="true" /> {summary}
        </button>
      ) : (
        <ul className="flex flex-col">
          {items.map(f => {
            const got = !!f.got_date;
            return (
              <li key={f.id} className="flex items-center gap-2 min-h-9">
                <button type="button" disabled={!canEdit || busy === f.id} aria-pressed={got}
                  aria-label={got ? `Still working on: ${f.text}` : `Got it: ${f.text}`}
                  onClick={() => run(f.id, () => goalApi.updateFocus(f.id, { got_date: got ? null : today }))}
                  className={cn("relative shrink-0 w-5 h-5 rounded-full border-2 inline-flex items-center justify-center cursor-pointer disabled:cursor-default",
                    "before:absolute before:-inset-2.5 before:content-['']",
                    got ? "bg-[var(--stem)] border-[var(--stem)] text-[var(--sheet)]" : "border-[var(--ink-faint)] bg-[var(--sheet)]")}>
                  {got && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                </button>
                <span className={cn("flex-1 min-w-0 text-sm leading-5 break-words", got ? "text-[var(--ink-soft)]" : "text-[var(--ink)]")}>
                  {f.text}
                  {got && <span className="ml-2 text-xs text-[var(--ink-soft)]">got {formatDate(day(f.got_date!))}</span>}
                </span>
                {canEdit && <IconButton icon={X} label={`Remove ${f.text}`} onClick={() => run(f.id, () => goalApi.removeFocus(f.id))} className="-mr-3 scale-75" />}
              </li>
            );
          })}
          {canEdit && (adding ? (
            <li className="flex items-center gap-2 py-1">
              <input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={300}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void add(); } if (e.key === "Escape") { setAdding(false); setText(""); } }}
                onBlur={() => void add()} placeholder="e.g. plan properly during inspection" aria-label="New focus point"
                className={cn(inputCls, "py-1.5 text-sm")} />
            </li>
          ) : (
            <li>
              <button type="button" onClick={() => setAdding(true)}
                className="relative -ml-1 inline-flex items-center gap-1 min-h-8 px-1 text-xs font-semibold text-[var(--stem)] cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']">
                <Plus size={14} aria-hidden="true" /> Add a focus point
              </button>
            </li>
          ))}
          {items.length > 0 && !startOpen && (
            <li>
              <button type="button" onClick={() => setOpen(false)} className="min-h-8 px-1 -ml-1 text-xs text-[var(--ink-soft)] cursor-pointer hover:text-[var(--ink)]">Hide</button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
