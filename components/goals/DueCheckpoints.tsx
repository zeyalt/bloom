"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Target } from "lucide-react";
import { useChildren, useGoals } from "@/lib/api-hooks";
import { addDays, day, todayISO } from "@/lib/goal-progress";
import { formatDate } from "@/lib/utils";

/**
 * Home strip: unticked checkpoints on open milestone goals that are overdue or due in the
 * next 7 days, for the children selected on Home. Renders nothing when there are none.
 */
export function DueCheckpoints({ childIds }: { childIds: string[] }) {
  const router = useRouter();
  const { data: goals = [] } = useGoals();
  const { data: children = [] } = useChildren();
  const today = todayISO();

  const items = useMemo(() => {
    const horizon = addDays(today, 7);
    return goals
      .filter(g => g.kind === "milestone" && !g.achieved_date && childIds.includes(g.child_id))
      .flatMap(g => g.checkpoints
        .filter(c => !c.hit_date && day(c.due_date) <= horizon)
        .map(c => ({ goal: g, checkpoint: c, due: day(c.due_date) })))
      .sort((a, b) => a.due.localeCompare(b.due));
  }, [goals, childIds, today]);

  if (!items.length) return null;
  const color = (childId: string) => children.find(c => c.id === childId)?.color_code ?? "var(--ink-faint)";
  const name = (childId: string) => children.find(c => c.id === childId)?.name ?? "";

  return (
    <section className="mb-6" aria-labelledby="due-checkpoints">
      <h2 id="due-checkpoints" className="flex items-center gap-2 font-semibold text-[var(--ink)] mb-2">
        <Target size={16} className="text-[var(--stem)]" /> Goal checkpoints due
      </h2>
      <ul className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden divide-y divide-[var(--rule)]">
        {items.slice(0, 5).map(({ goal, checkpoint, due }) => {
          const overdue = due < today;
          return (
            <li key={checkpoint.id}>
              <button type="button" onClick={() => router.push(`/goals/${goal.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-[var(--bg-secondary)]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color(goal.child_id) }} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-[var(--ink)] truncate">{checkpoint.text}</span>
                  <span className="block text-xs text-[var(--ink-soft)] truncate">
                    {name(goal.child_id)} · {goal.title}
                  </span>
                </span>
                <span className={overdue ? "text-xs font-semibold text-[#8a3f06] shrink-0" : "text-xs text-[var(--ink-soft)] shrink-0"}>
                  {overdue ? `Was due ${formatDate(due)}` : due === today ? "Due today" : `Due ${formatDate(due)}`}
                </span>
                <ChevronRight size={16} className="text-[var(--ink-faint)] shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
      {items.length > 5 && <p className="text-xs text-[var(--ink-soft)] mt-2">+{items.length - 5} more in Goals</p>}
    </section>
  );
}
