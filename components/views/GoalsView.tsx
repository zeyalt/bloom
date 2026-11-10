"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { Fab } from "@/components/ui/Fab";
import { Page, Utilities, PageBody, SectionHeading } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { GoalSparkline } from "@/components/goals/GoalChart";
import { useChildren, useGoals } from "@/lib/api-hooks";
import { cn, formatDate } from "@/lib/utils";
import {
  TONE_CLASSES, achievedDate, day, earlyLateLabel, fmtValue, goalStatus, measuredProgress,
  milestoneProgress, timeLeftLabel, timeUsedPct, todayISO,
} from "@/lib/goal-progress";
import type { Goal } from "@/lib/types";

const CHILD_KEY = "bloom.goals.child";

export default function GoalsView() {
  const router = useRouter();
  const { data: children = [] } = useChildren();
  const { data: goals = [], isLoading } = useGoals();
  // The last child picked here (remembered per device), else the first child.
  const [picked, setPicked] = useState<string | null>(() => {
    try { return localStorage.getItem(CHILD_KEY); } catch { return null; }
  });
  const [creating, setCreating] = useState(false);
  const today = todayISO();

  const child = children.find(c => c.id === picked) ?? children[0];
  const childId = child?.id ?? null;
  const pickChild = (id: string) => {
    setPicked(id);
    try { localStorage.setItem(CHILD_KEY, id); } catch { /* private mode */ }
  };

  const { active, achieved } = useMemo(() => {
    const mine = goals.filter(g => g.child_id === childId);
    return {
      active: mine.filter(g => !achievedDate(g)).sort((a, b) => a.target_date.localeCompare(b.target_date)),
      achieved: mine.filter(g => achievedDate(g)).sort((a, b) => achievedDate(b)!.localeCompare(achievedDate(a)!)),
    };
  }, [goals, childId]);

  const overdue = active.filter(g => day(g.target_date) < today).length;
  const goalsLine = isLoading ? " "
    : !active.length && !achieved.length ? `No goals for ${child?.name ?? "this child"} yet`
    : [
        active.length ? `${active.length} in progress` : "nothing in progress",
        overdue ? `${overdue} overdue` : "",
        achieved.length ? `${achieved.length} achieved` : "",
      ].filter(Boolean).join(" · ");

  const open = (g: Goal) => router.push(`/goals/${g.id}`);

  return (
    <Page>
      <Header title="Goals" subtitle={goalsLine} />

      <Utilities>
        <ChildFilter single childList={children} selected={childId ? [childId] : []} onToggle={pickChild} />
      </Utilities>

      <PageBody>
        {isLoading ? (
          [1, 2].map(i => <div key={i} className="h-32 bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />)
        ) : active.length === 0 ? (
          <div className="border border-dashed border-[var(--rule)] bg-[var(--sheet)] px-4 py-8 text-center flex flex-col items-center gap-3">
            <p className="text-sm leading-5 text-[var(--ink-soft)]">No goals yet for {child?.name ?? "this child"}.</p>
            <Button size="sm" variant="secondary" onClick={() => setCreating(true)} disabled={!child}><Plus size={16} /> Add a goal</Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map(g => <GoalCard key={g.id} goal={g} today={today} onOpen={() => open(g)} />)}
          </div>
        )}

        {achieved.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionHeading>Achieved</SectionHeading>
            <ul className="border border-[var(--rule)] bg-[var(--sheet)] divide-y divide-[var(--rule)]">
              {achieved.map(g => {
                const done = achievedDate(g)!;
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => open(g)} className="w-full flex items-center gap-3 px-4 py-3 min-h-16 text-left cursor-pointer hover:bg-[var(--bg-secondary)]">
                      <span className="w-6 h-6 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0"><Check size={16} strokeWidth={3} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm leading-5 font-semibold text-[var(--ink)]">{g.kind === "measured" ? `${g.title} ${fmtValue(g.target_value ?? 0, g.unit)}` : g.title}</span>
                        <span className="block text-xs leading-4 text-[var(--ink-soft)]">Achieved {formatDate(done)} — {earlyLateLabel(done, day(g.target_date))}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </PageBody>

      <Fab label="New goal" onClick={() => child && setCreating(true)} />

      {creating && (
        <GoalFormModal open onClose={() => setCreating(false)} child={child} onCreated={id => router.push(`/goals/${id}`)} />
      )}
    </Page>
  );
}

function GoalCard({ goal, today, onOpen }: { goal: Goal; today: string; onOpen: () => void }) {
  const status = goalStatus(goal, today);
  const target = day(goal.target_date);
  return (
    <button type="button" onClick={onOpen}
      className="w-full text-left flex flex-col gap-3 p-4 bg-[var(--sheet)] border border-[var(--rule)] cursor-pointer hover:border-[var(--ink-faint)]">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs leading-4 font-bold tracking-wide uppercase text-[var(--ink-soft)]">{goal.kind === "measured" ? "Measured" : "Milestone"}</span>
        <span className={cn("text-xs leading-4 font-bold px-2 py-1 rounded-full", TONE_CLASSES[status.tone])}>{status.label}</span>
      </span>
      <span className="text-base leading-6 font-semibold text-[var(--ink)]">
        {goal.kind === "measured" ? `${goal.title} → ${fmtValue(goal.target_value ?? 0, goal.unit)}` : goal.title}
      </span>
      {goal.kind === "measured" ? <MeasuredSummary goal={goal} /> : <MilestoneSummary goal={goal} today={today} />}
      <span className="text-xs text-[var(--ink-soft)]">By {formatDate(target)} · {timeLeftLabel(today, target)}</span>
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
    <span className="flex flex-col gap-2">
      <span className="flex gap-[3px] h-2" aria-label={`${p.hitCount} of ${p.checkpoints.length} checkpoints hit`}>
        {p.checkpoints.map(c => (
          <span key={c.id} className="flex-1 rounded-sm" style={{
            backgroundColor: c.state === "hit" ? "#2f6f4e" : c.state === "missed" ? "#d97706" : c.state === "next" ? "#9cc3ab" : "#d5ded4",
          }} />
        ))}
      </span>
      <span className="text-sm text-[var(--ink)] truncate">
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
