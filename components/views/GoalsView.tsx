"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { Fab } from "@/components/ui/Fab";
import { Page, Utilities, PageBody, SectionHeading } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { GoalSparkline } from "@/components/goals/GoalChart";
import { useChildren, useGoals } from "@/lib/api-hooks";
import { cn, formatDate } from "@/lib/utils";
import {
  TONE_CLASSES, achievedDate, day, earlyLateLabel, fmtValue, goalStatus, measuredProgress,
  milestoneProgress, timeLeftLabel, timeUsedPct, todayISO,
} from "@/lib/goal-progress";
import type { Child, Goal } from "@/lib/types";

const CHILDREN_KEY = "bloom.goals.children";

/** The children shown here (remembered per device); null = everyone. */
function readShown(): string[] | null {
  try {
    const raw = localStorage.getItem(CHILDREN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

const countLine = (active: Goal[], achieved: Goal[], today: string) => {
  const overdue = active.filter(g => day(g.target_date) < today).length;
  return [
    active.length ? `${active.length} in progress` : "nothing in progress",
    overdue ? `${overdue} overdue` : "",
    achieved.length ? `${achieved.length} achieved` : "",
  ].filter(Boolean).join(" · ");
};

export default function GoalsView() {
  const router = useRouter();
  const { data: children = [] } = useChildren();
  const { data: goals = [], isLoading, isError, refetch } = useGoals();
  const [shown, setShown] = useState<string[] | null>(readShown);
  const [creatingFor, setCreatingFor] = useState<Child | null>(null);
  const [choosing, setChoosing] = useState(false);
  const today = todayISO();

  // Everyone until a pill is switched off; ids of children since removed are ignored.
  const selectedIds = useMemo(() => {
    const ids = shown?.filter(id => children.some(c => c.id === id));
    return ids && ids.length ? ids : children.map(c => c.id);
  }, [shown, children]);
  const kids = children.filter(c => selectedIds.includes(c.id));
  const toggleChild = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    if (!next.length) return; // keep at least one child showing
    setShown(next);
    try { localStorage.setItem(CHILDREN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const byChild = useMemo(() => new Map(children.map(c => {
    const mine = goals.filter(g => g.child_id === c.id);
    return [c.id, {
      active: mine.filter(g => !achievedDate(g)).sort((a, b) => a.target_date.localeCompare(b.target_date)),
      achieved: mine.filter(g => achievedDate(g)).sort((a, b) => achievedDate(b)!.localeCompare(achievedDate(a)!)),
    }];
  })), [goals, children]);

  const allActive = kids.flatMap(k => byChild.get(k.id)?.active ?? []);
  const allAchieved = kids.flatMap(k => byChild.get(k.id)?.achieved ?? []);
  const goalsLine = isLoading ? " "
    : isError ? "Couldn’t load goals"
    : !allActive.length && !allAchieved.length ? "No goals yet"
    : countLine(allActive, allAchieved, today);

  const open = (g: Goal) => router.push(`/goals/${g.id}`);
  const newGoal = () => {
    if (kids.length === 1) setCreatingFor(kids[0]);
    else if (kids.length > 1) setChoosing(true);
  };

  return (
    <Page>
      <Header title="Goals" subtitle={goalsLine} />

      <Utilities>
        <ChildFilter childList={children} selected={selectedIds} onToggle={toggleChild} />
      </Utilities>

      <PageBody>
        {isLoading ? (
          [1, 2].map(i => <div key={i} className="h-24 bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />)
        ) : isError ? (
          // Don't pass a failed load off as "no goals" — that hides server problems.
          <div role="alert" className="border border-[var(--margin)]/40 bg-[var(--sheet)] px-4 py-6 flex flex-col items-start gap-3">
            <p className="text-sm leading-5 text-[var(--ink)]">Goals couldn’t be loaded, so adding one won’t work right now either. If you’re running the app locally, restart the dev server.</p>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : (
          kids.map(kid => {
            const { active = [], achieved = [] } = byChild.get(kid.id) ?? {};
            return (
              <section key={kid.id} aria-labelledby={`goals-${kid.id}`} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Avatar avatarKey={kid.avatar_key} fallbackEmoji={kid.avatar_emoji} size={28} />
                  <SectionHeading id={`goals-${kid.id}`}>{kid.name}</SectionHeading>
                  {(active.length > 0 || achieved.length > 0) && (
                    <span className="text-sm leading-5 text-[var(--ink-soft)]">{countLine(active, achieved, today)}</span>
                  )}
                </div>

                {active.length === 0 ? (
                  <div className="border border-dashed border-[var(--rule)] bg-[var(--sheet)] px-3 py-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm leading-5 text-[var(--ink-soft)]">Nothing in progress for {kid.name}.</p>
                    <Button size="sm" variant="secondary" onClick={() => setCreatingFor(kid)}><Plus size={16} /> Add a goal</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {active.map(g => <GoalCard key={g.id} goal={g} today={today} onOpen={() => open(g)} />)}
                  </div>
                )}

                {achieved.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <h3 className="text-xs leading-4 font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Achieved</h3>
                    <ul className="border border-[var(--rule)] bg-[var(--sheet)] divide-y divide-[var(--rule)]">
                      {achieved.map(g => {
                        const done = achievedDate(g)!;
                        return (
                          <li key={g.id}>
                            <button type="button" onClick={() => open(g)} className="w-full flex items-center gap-3 px-3 py-2.5 min-h-12 text-left cursor-pointer hover:bg-[var(--bg-secondary)]">
                              <span className="w-6 h-6 rounded-full bg-[var(--stem)] text-white flex items-center justify-center shrink-0"><Check size={16} strokeWidth={3} aria-hidden="true" /></span>
                              <span className="min-w-0">
                                <span className="block text-sm leading-5 font-semibold text-[var(--ink)] break-words">{g.kind === "measured" ? `${g.title} ${fmtValue(g.target_value ?? 0, g.unit)}` : g.title}</span>
                                <span className="block text-xs leading-4 text-[var(--ink-soft)]">Achieved {formatDate(done)} · {earlyLateLabel(done, day(g.target_date))}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          })
        )}
      </PageBody>

      <Fab label="New goal" onClick={newGoal} />

      {/* With more than one child showing, ask whose goal it is. */}
      <Modal open={choosing} onClose={() => setChoosing(false)} title="New goal for…" size="sm">
        <div className="flex flex-col gap-2">
          {kids.map(k => (
            <button key={k.id} type="button" onClick={() => { setChoosing(false); setCreatingFor(k); }}
              className="flex items-center gap-3 h-14 px-3 border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] text-base font-semibold text-[var(--ink)] cursor-pointer hover:border-[var(--stem)]">
              <Avatar avatarKey={k.avatar_key} fallbackEmoji={k.avatar_emoji} size={32} /> {k.name}
            </button>
          ))}
        </div>
      </Modal>

      {creatingFor && (
        <GoalFormModal open onClose={() => setCreatingFor(null)} child={creatingFor} onCreated={id => router.push(`/goals/${id}`)} />
      )}
    </Page>
  );
}

/** One goal in progress: title and status on one line, progress, then the date. Nothing is cut off. */
function GoalCard({ goal, today, onOpen }: { goal: Goal; today: string; onOpen: () => void }) {
  const status = goalStatus(goal, today);
  const target = day(goal.target_date);
  return (
    <button type="button" onClick={onOpen}
      className="w-full min-w-0 text-left flex flex-col gap-1.5 px-3 py-2.5 bg-[var(--sheet)] border border-[var(--rule)] cursor-pointer hover:border-[var(--ink-faint)] active:bg-[var(--bg-secondary)] transition-colors duration-150">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[15px] leading-5 font-semibold text-[var(--ink)] break-words">
          {goal.kind === "measured" ? `${goal.title} → ${fmtValue(goal.target_value ?? 0, goal.unit)}` : goal.title}
        </span>
        <span className={cn("shrink-0 text-xs leading-4 font-bold px-2 py-0.5 rounded-full whitespace-nowrap", TONE_CLASSES[status.tone])}>{status.label}</span>
      </span>
      {goal.kind === "measured" ? <MeasuredSummary goal={goal} /> : <MilestoneSummary goal={goal} today={today} />}
      <span className="text-xs leading-4 text-[var(--ink-soft)]">By {formatDate(target)} · {timeLeftLabel(today, target)}</span>
    </button>
  );
}

function MilestoneSummary({ goal, today }: { goal: Goal; today: string }) {
  const p = milestoneProgress(goal, today);
  if (!p.checkpoints.length) {
    return (
      <span className="block h-2 rounded-full bg-[#d5ded4] overflow-hidden">
        <span className="block h-full bg-[#9aa9a0]" style={{ width: `${timeUsedPct(goal, today)}%` }} />
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex gap-[3px] h-2" aria-label={`${p.hitCount} of ${p.checkpoints.length} checkpoints hit`}>
        {p.checkpoints.map(c => (
          <span key={c.id} className="flex-1 rounded-sm" style={{
            backgroundColor: c.state === "hit" ? "#2f6f4e" : c.state === "missed" ? "#d97706" : c.state === "next" ? "#9cc3ab" : "#d5ded4",
          }} />
        ))}
      </span>
      <span className="text-sm leading-5 text-[var(--ink)] break-words">
        <span className="text-[var(--ink-soft)]">{p.hitCount} of {p.checkpoints.length} · Next: </span>
        {p.next ? p.next.text : "all checkpoints done"}
      </span>
    </span>
  );
}

function MeasuredSummary({ goal }: { goal: Goal }) {
  const m = measuredProgress(goal);
  return (
    <span className="flex flex-col gap-1">
      <GoalSparkline goal={goal} progress={m} />
      <span className="text-sm text-[var(--ink-soft)]">
        <span className="font-semibold text-[var(--ink)]">{m.latest ? fmtValue(m.latest.value, goal.unit) : "—"}</span> now
        {m.remaining !== null && m.remaining > 0 && <> · {fmtValue(m.remaining, goal.unit)} to go</>}
      </span>
    </span>
  );
}
