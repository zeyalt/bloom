"use client";

import { format, parseISO } from "date-fns";
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
    { title: "Not due yet, but you can start early", tasks: day.homeworkLater },
    { title: "Hobby", tasks: day.practice },
    { title: "Free Play", tasks: day.free },
  ].filter(g => g.tasks.length > 0);
  const filled = c.tone === "done";

  return (
    <li className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden">
      {/* The banner: who, how far along, and a short encouraging line. */}
      <div className={cn("px-4 pt-4 pb-3",
        filled ? "bg-[var(--stem)] text-[var(--sheet)]"
          : c.tone === "go" ? "bg-[#e8f2eb] border-b-2 border-[var(--stem)]"
          : "bg-[var(--bg-secondary)] border-b border-[var(--rule)]")}>
        <div className="flex items-center gap-3">
          <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={40} />
          <h4 className="flex-1 min-w-0 text-xl leading-7 font-bold tracking-tight text-inherit">{child.name}</h4>
          {day.total > 0 && tense !== "future" && <span className="text-sm font-semibold tabular-nums">{day.done} of {day.total}</span>}
        </div>
        <p className={cn("mt-2 text-sm leading-5 font-semibold", filled ? "opacity-85" : "text-[var(--stem)]")}>
          {c.kicker}
        </p>
        <p className="mt-0.5 text-xl leading-7 font-extrabold tracking-tight break-words">{c.headline}</p>
        {(c.detail || noSchool) && (
          <p className={cn("mt-1 text-sm leading-5", filled ? "opacity-90" : "text-[var(--ink-soft)]")}>
            {[c.detail, noSchool].filter(Boolean).join(" · ")}
          </p>
        )}
        {day.total > 0 && tense !== "future" && (
          <div aria-hidden="true" className="mt-2.5 flex gap-[3px] h-1.5">
            {bar.map(t => (
              <span key={t.key} className={cn("flex-1 rounded-sm",
                t.doneAt ? (filled ? "bg-[var(--sheet)]" : "bg-[var(--stem)]") : (filled ? "bg-[var(--sheet)]/35" : "bg-[#d5ded4]"))} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
      {groups.map(g => (
        <div key={g.title} className="mt-2">
          <h5 className="text-xs leading-4 font-semibold text-[var(--ink-soft)]">{g.title}</h5>
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
  const status = done ? (late ? "late" : at(task.doneAt!)) : tense === "today" ? "not yet" : tense === "past" ? "not done" : "";
  // Homework gets the amber tag My Day uses; everything else the blue one.
  const tag = hw
    ? `from ${format(parseISO(hw.lesson), "d MMM")} · due ${format(parseISO(hw.due), "EEE d MMM")}`
    : oneOff ? "Just this day" : task.source.label;

  return (
    <li className="py-2">
      <div className="flex items-start gap-3">
        <button type="button" role="checkbox" aria-checked={done} disabled={!canTick}
          aria-label={`${task.title}${done ? ", done" : ""}`}
          onClick={() => onTick(task)}
          className={cn(
            "relative shrink-0 mt-0.5 w-6 h-6 rounded-md border-2 inline-flex items-center justify-center cursor-pointer disabled:cursor-default",
            "before:absolute before:-inset-2.5 before:content-['']",
            done ? "bg-[var(--stem)] border-[var(--stem)] text-[var(--sheet)]" : "border-[var(--ink-faint)] bg-[var(--sheet)]",
            !canTick && "border-dashed opacity-60"
          )}>
          {done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
        </button>
        <span className="flex-1 min-w-0">
          {/* Line 1: the task, and anything urgent. */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("text-sm leading-5 font-semibold break-words",
              done ? "text-[var(--ink-soft)] line-through decoration-[#9cc5a8]" : "text-[var(--ink)]")}>{task.title}</span>
            {hw?.overdue && !done && <span className="px-2 rounded-full bg-[#f6e3e1] text-[#8f1d14] text-xs leading-5 font-semibold">Overdue</span>}
            {hw && !done && canTick && (
              // Desktop: on the task's own line, at the right.
              <button type="button" onClick={() => onSkip(task)}
                className="hidden md:inline-flex ml-auto relative h-6 px-2 rounded-full border border-[var(--rule)] bg-[var(--sheet)] text-xs leading-5 font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-10 before:-translate-y-1/2 before:content-['']">
                No homework this time
              </button>
            )}
          </span>
          {/* Line 2: where it's from, the homework itself, who ticked it, and the skip. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-[var(--ink-soft)]">
            {tag && (
              <span className={cn("px-2 rounded-full font-semibold", hw ? "bg-[#fdf0dc] text-[#8a4207]" : "bg-[#e3ebf7] text-[#1d3f78]")}>{tag}</span>
            )}
            {hw?.note && <span className="font-semibold text-[var(--ink)] break-words">{hw.note}</span>}
            {who && <span>{who}</span>}
            {hw && !done && canTick && (
              // Phones: on the second line, after the homework.
              <button type="button" onClick={() => onSkip(task)}
                className="md:hidden inline-flex relative h-6 px-2 rounded-full border border-[var(--rule)] bg-[var(--sheet)] text-xs leading-5 font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-10 before:-translate-y-1/2 before:content-['']">
                No homework this time
              </button>
            )}
          </span>
        </span>
        <span className={cn("shrink-0 text-xs leading-5 tabular-nums", done ? "font-semibold text-[var(--stem)]" : "text-[var(--ink-soft)]")}>{status}</span>
        {oneOff && (
          <div className="shrink-0 -my-2 -mr-3">
            <IconButton icon={X} label={`Remove ${task.title}`} onClick={() => onRemove(task)} />
          </div>
        )}
      </div>
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
    <li className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={32} />
        <span className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-[var(--ink)]">{child.name}</h4>
          <span className="block text-sm leading-5 text-[var(--ink-soft)]">
            {setUp
              ? tense === "today" ? "Nothing on the list today" : "Nothing on the list this day"
              : "No routine yet. Add a few things to do each day, and they’ll show here and on the tablet."}
          </span>
        </span>
      </div>
      {!setUp && (
        <button type="button" onClick={onSetUp}
          className="self-start h-11 px-4 rounded-[var(--radius-md)] border border-[var(--stem)] text-[var(--stem)] bg-[var(--sheet)] text-sm font-semibold cursor-pointer hover:bg-[#e8f2eb] active:scale-[0.98] transition-transform duration-150">
          Set up {child.name}’s routine
        </button>
      )}
      <AddTaskForm childName={child.name} onAdd={onAdd} />
    </li>
  );
}

/** Stands in for a child's card while the day loads, so nobody briefly reads "No routine yet". */
export function RoutineCardSkeleton() {
  return (
    <li aria-hidden="true" className="border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-lg)] overflow-hidden p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] animate-pulse" />
        <span className="h-4 w-24 rounded bg-[var(--bg-secondary)] animate-pulse" />
      </div>
      <span className="h-6 w-3/4 rounded bg-[var(--bg-secondary)] animate-pulse" />
      <span className="h-4 w-1/2 rounded bg-[var(--bg-secondary)] animate-pulse" />
    </li>
  );
}
