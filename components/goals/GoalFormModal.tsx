"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { goalApi, useRefreshGoals } from "@/lib/goal-api";
import { day, todayISO } from "@/lib/goal-progress";
import type { Child, Goal, GoalKind } from "@/lib/types";

export const inputCls =
  "w-full px-3 py-2 text-base md:text-sm border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] focus:outline-none focus:border-[var(--stem)]";
export const labelCls = "block text-xs font-medium text-[var(--text-secondary)] mb-1";

const METRICS = [
  { name: "Height", unit: "cm" },
  { name: "Weight", unit: "kg" },
] as const;

/** Create a goal for `child`, or edit `goal` (title / target / date) and delete it. */
export function GoalFormModal({
  open, onClose, child, goal, onCreated, onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  child: Child | undefined;
  goal?: Goal;
  onCreated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const editing = !!goal;
  const refresh = useRefreshGoals();
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? "milestone");
  const [title, setTitle] = useState(goal?.kind === "milestone" ? goal.title : "");
  const initialMetric = goal?.kind === "measured" ? (METRICS.find(m => m.name === goal.title)?.name ?? "Other") : "Height";
  const [metric, setMetric] = useState<string>(initialMetric);
  const [customName, setCustomName] = useState(initialMetric === "Other" ? goal?.title ?? "" : "");
  const [customUnit, setCustomUnit] = useState(initialMetric === "Other" ? goal?.unit ?? "" : "");
  const [startValue, setStartValue] = useState("");
  const [targetValue, setTargetValue] = useState(goal?.target_value != null ? String(goal.target_value) : "");
  const [targetDate, setTargetDate] = useState(goal ? day(goal.target_date) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = METRICS.find(m => m.name === metric);
  const measuredName = preset ? preset.name : customName.trim();
  const unit = preset ? preset.unit : customUnit.trim();
  const valid =
    !!targetDate &&
    (kind === "milestone"
      ? !!title.trim()
      : !!measuredName && !!unit && targetValue.trim() !== "" && !isNaN(Number(targetValue)) &&
        (editing || (startValue.trim() !== "" && !isNaN(Number(startValue)))));

  async function save() {
    if (!valid || !child) return;
    setSaving(true); setError(null);
    try {
      if (editing && goal) {
        await goalApi.update(goal.id, kind === "milestone"
          ? { title: title.trim(), target_date: targetDate }
          : { title: measuredName, unit, target_value: Number(targetValue), target_date: targetDate });
        await refresh();
        onClose();
      } else {
        const created = await goalApi.create(kind === "milestone"
          ? { child_id: child.id, kind, title: title.trim(), target_date: targetDate }
          : { child_id: child.id, kind, title: measuredName, unit, target_value: Number(targetValue),
              start_value: Number(startValue), start_date: todayISO(), target_date: targetDate });
        await refresh();
        onClose();
        onCreated?.(created.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the goal");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!goal || !window.confirm(`Delete “${goal.title}” and everything logged against it? This can’t be undone.`)) return;
    setSaving(true);
    try {
      await goalApi.remove(goal.id);
      await refresh();
      onClose();
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the goal");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit goal" : `New goal for ${child?.name ?? ""}`}>
      <div className="space-y-4">
        {error && <p className="text-sm text-[var(--margin)] bg-[var(--margin)]/8 px-3 py-2">{error}</p>}

        {!editing && (
          <div>
            <span className={labelCls}>Kind of goal</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["milestone", "Milestone", "Something to learn or do"],
                ["measured", "Measured", "A number to reach, like height"],
              ] as const).map(([k, label, hint]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "text-left p-3 border rounded-[var(--radius-md)] cursor-pointer",
                    kind === k ? "border-[var(--stem)] bg-[var(--sheet)] ring-1 ring-[var(--stem)]" : "border-[var(--rule)] hover:bg-[var(--bg-secondary)]"
                  )}
                >
                  <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
                  <span className="block text-xs text-[var(--ink-soft)] mt-0.5">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "milestone" ? (
          <div>
            <label htmlFor="goal-title" className={labelCls}>Goal</label>
            <input id="goal-title" value={title} onChange={e => setTitle(e.target.value)} className={inputCls}
              placeholder="e.g. Ride a bicycle without training wheels" maxLength={255} />
          </div>
        ) : (
          <>
            <div>
              <span className={labelCls}>Measure</span>
              <div className="flex flex-wrap gap-2">
                {[...METRICS.map(m => m.name), "Other"].map(name => (
                  <button key={name} type="button" aria-pressed={metric === name} onClick={() => setMetric(name)}
                    className={cn(
                      "h-9 px-3.5 rounded-full text-sm font-medium border cursor-pointer",
                      metric === name ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)]" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)] hover:text-[var(--ink)]"
                    )}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {metric === "Other" && (
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <div>
                  <label htmlFor="goal-metric" className={labelCls}>What</label>
                  <input id="goal-metric" value={customName} onChange={e => setCustomName(e.target.value)} className={inputCls} placeholder="e.g. Reading level" />
                </div>
                <div>
                  <label htmlFor="goal-unit" className={labelCls}>Unit</label>
                  <input id="goal-unit" value={customUnit} onChange={e => setCustomUnit(e.target.value)} className={inputCls} placeholder="e.g. pages" maxLength={20} />
                </div>
              </div>
            )}
            <div className={cn("grid gap-3", editing ? "grid-cols-1" : "grid-cols-2")}>
              {!editing && (
                <div>
                  <label htmlFor="goal-now" className={labelCls}>Now{unit ? ` (${unit})` : ""}</label>
                  <input id="goal-now" type="number" inputMode="decimal" step="any" value={startValue} onChange={e => setStartValue(e.target.value)} className={inputCls} />
                </div>
              )}
              <div>
                <label htmlFor="goal-target" className={labelCls}>Target{unit ? ` (${unit})` : ""}</label>
                <input id="goal-target" type="number" inputMode="decimal" step="any" value={targetValue} onChange={e => setTargetValue(e.target.value)} className={inputCls} />
              </div>
            </div>
          </>
        )}

        <div>
          <label htmlFor="goal-date" className={labelCls}>By when</label>
          <input id="goal-date" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputCls} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {editing && (
            <Button variant="danger" onClick={remove} disabled={saving}>Delete</Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={!valid} loading={saving}>{editing ? "Save" : "Create goal"}</Button>
        </div>
        {!editing && kind === "milestone" && (
          <p className="text-xs text-[var(--ink-soft)]">Next you can have Claude draft an action plan for it.</p>
        )}
      </div>
    </Modal>
  );
}
