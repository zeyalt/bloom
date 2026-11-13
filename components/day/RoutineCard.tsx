"use client";

import { format } from "date-fns";
import { Check, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { AddTaskForm } from "./AddTaskForm";
import { Avatar } from "@/components/ui/Avatar";
import { cheer, type BuiltDay, type DayTask } from "@/lib/my-day";
import type { DayTense } from "@/lib/use-my-day";
import { cn } from "@/lib/utils";
import type { Child, OneOffTask } from "@/lib/types";

const at = (timestamp: string) => format(new Date(timestamp), "h:mm a");

/** Has the routine anything to show on this day? */
export function hasRoutine(day: BuiltDay | undefined): day is BuiltDay {
  return !!day && (day.total > 0 || day.free.length > 0 || day.homeworkLater.length > 0);
}

/**
 * One child's routine on Home's day view: Do first, homework, Hobby and Free Play, each
 * with when it was ticked and by whom. Parents can tick or untick anything (not on future
 * days); homework also has "No homework this time". "Add a task" adds a one-off for this
 * day, which has a × to take it off again.
 */
export function RoutineCard({ child, day, date, tense, onTick, onSkip, onAdd, onRemove }: {
  child: Child;
  day: BuiltDay;
  date: string;
  tense: DayTense;
  onTick: (t: DayTask) => void;
  onSkip: (t: DayTask) => void;
  onAdd: (title: string, tier: OneOffTask["tier"]) => Promise<void>;
  onRemove: (t: DayTask) => void;
}) {
  const c = cheer(day, tense, child.name);
  const bar = [...day.must, ...day.practice];
  const noSchool = day.info.kind === "holiday" ? `No school · ${day.info.reason}` : null;
  const groups: { title: string; tasks: DayTask[] }[] = [
    { title: "Do first", tasks: day.must },
    { title: "Homework, due later", tasks: day.homeworkLater },
    { title: "Hobby", tasks: day.practice },
    { title: "Free Play", tasks: day.free },
  ].filter(g => g.tasks.length > 0);
  const filled = c.tone === "done";

  return (
    <li className="border border-[var(--rule)] bg-[var(--sheet)]">
      {/* The banner: who, how far along, and a short encouraging line. */}
      <div className={cn("p-4",
        filled ? "bg-[var(--stem)] text-[var(--sheet)]"
          : c.tone === "go" ? "bg-[#e8f2eb] border-b-2 border-[var(--stem)]"
          : "bg-[var(--bg-secondary)] border-b border-[var(--rule)]")}>
        <div className="flex items-center gap-3">
          <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={32} />
          <span className="flex-1 min-w-0 text-base font-semibold">{child.name}</span>
          {day.total > 0 && <span className="text-sm font-semibold tabular-nums">{day.done} of {day.total}</span>}
        </div>
        <p className={cn("mt-3 text-xs leading-4 font-bold uppercase tracking-wider", filled ? "opacity-85" : "text-[var(--stem)]")}>
          {c.kicker}
        </p>
        <p className="mt-1 text-2xl leading-8 font-extrabold tracking-tight break-words">{c.headline}</p>
        {(c.detail || noSchool) && (
          <p className={cn("mt-1 text-sm leading-5", filled ? "opacity-90" : "text-[var(--ink-soft)]")}>
            {[c.detail, noSchool].filter(Boolean).join(" · ")}
          </p>
        )}
        {day.total > 0 && (
          <div aria-hidden="true" className="mt-3 flex gap-[3px] h-1.5">
            {bar.map(t => (
              <span key={t.key} className={cn("flex-1 rounded-sm",
                t.doneAt ? (filled ? "bg-[var(--sheet)]" : "bg-[var(--stem)]") : (filled ? "bg-[var(--sheet)]/35" : "bg-[#d5ded4]"))} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
      {groups.map(g => (
        <div key={g.title} className="mt-3">
          <h4 className="text-xs leading-4 font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{g.title}</h4>
          <ul className="divide-y divide-[var(--rule)]/60">
            {g.tasks.map(t => <TaskLine key={t.key} task={t} date={date} tense={tense} onTick={onTick} onSkip={onSkip} onRemove={onRemove} />)}
          </ul>
        </div>
      ))}
        <div className="mt-2">
          <AddTaskForm childName={child.name} onAdd={onAdd} />
        </div>
      </div>
    </li>
  );
}

function TaskLine({ task, date, tense, onTick, onSkip, onRemove }: {
  task: DayTask; date: string; tense: DayTense; onTick: (t: DayTask) => void; onSkip: (t: DayTask) => void;
  onRemove: (t: DayTask) => void;
}) {
  const oneOff = task.source.kind === "oneoff";
  const hw = task.homework;
  const done = !!task.doneAt;
  const canTick = tense !== "future";
  // A tick made on a later day than the one it's for (a parent catching up).
  const late = done && format(new Date(task.doneAt!), "yyyy-MM-dd") !== date;
  const who = done && task.doneBy === "parent"
    ? late ? `ticked later by parent · ${format(new Date(task.doneAt!), "EEE d MMM, h:mm a")}` : "ticked by parent"
    : null;
  const meta = [hw?.overdue && !done ? "Overdue" : null, oneOff ? "Just this day" : task.source.label, who].filter(Boolean);

  return (
    <li className="py-1.5">
      <div className="flex items-center gap-3">
        <button type="button" role="checkbox" aria-checked={done} disabled={!canTick}
          aria-label={`${task.title}${done ? ", done" : ""}`}
          onClick={() => onTick(task)}
          className={cn(
            "relative shrink-0 w-7 h-7 rounded-full border-2 inline-flex items-center justify-center cursor-pointer disabled:cursor-default",
            "before:absolute before:-inset-2.5 before:content-['']",
            done ? "bg-[var(--stem)] border-[var(--stem)] text-[var(--sheet)]" : "border-[var(--ink-faint)] bg-[var(--sheet)]",
            !canTick && "border-dashed opacity-60"
          )}>
          {done && <Check size={16} strokeWidth={3} aria-hidden="true" />}
        </button>
        <span className="flex-1 min-w-0 py-1">
          <span className={cn("block text-sm leading-5", done ? "text-[var(--ink)]" : "text-[var(--ink-soft)]")}>{task.title}</span>
          {meta.length > 0 && (
            <span className="block text-xs leading-4 text-[var(--ink-faint)]">
              {hw?.overdue && !done && <span className="font-semibold text-[#8f1d14]">Overdue · </span>}
              {meta.filter(m => m !== "Overdue").join(" · ")}
            </span>
          )}
        </span>
        <span className={cn("shrink-0 text-xs tabular-nums", done ? "font-semibold text-[var(--stem)]" : "text-[var(--ink-faint)]")}>
          {done ? (late ? "late" : at(task.doneAt!)) : tense === "today" ? "not yet" : tense === "past" ? "not done" : ""}
        </span>
        {oneOff && (
          <div className="shrink-0 -my-2 -mr-3">
            <IconButton icon={X} label={`Remove ${task.title}`} onClick={() => onRemove(task)} />
          </div>
        )}
      </div>
      {hw && !done && canTick && (
        <div className="mt-1 ml-10">
          <button type="button" onClick={() => onSkip(task)}
            className="relative h-8 px-3 text-xs font-semibold rounded-full border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']">
            No homework this time
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * A child with no list on this day. `setUp` false = nothing has been set up for them at all,
 * so offer to set up a routine; true = they have one, just nothing for this day.
 */
export function EmptyRoutineCard({ child, setUp, tense, onSetUp, onAdd }: {
  child: Child;
  setUp: boolean;
  tense: DayTense;
  onSetUp: () => void;
  onAdd: (title: string, tier: OneOffTask["tier"]) => Promise<void>;
}) {
  return (
    <li className="border border-[var(--rule)] bg-[var(--sheet)] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={32} />
        <span className="flex-1 min-w-0">
          <span className="block text-base font-semibold text-[var(--ink)]">{child.name}</span>
          <span className="block text-sm leading-5 text-[var(--ink-soft)]">
            {setUp
              ? tense === "today" ? "Nothing on the list today" : "Nothing on the list this day"
              : "No routine yet. Add a few things to do each day, and they’ll show here and on the tablet."}
          </span>
        </span>
      </div>
      {!setUp && (
        <button type="button" onClick={onSetUp}
          className="self-start h-10 px-4 rounded-[var(--radius-md)] border border-[var(--stem)] text-[var(--stem)] bg-[var(--sheet)] text-sm font-semibold cursor-pointer hover:bg-[#e8f2eb]">
          Set up {child.name}’s routine
        </button>
      )}
      <AddTaskForm childName={child.name} onAdd={onAdd} />
    </li>
  );
}
