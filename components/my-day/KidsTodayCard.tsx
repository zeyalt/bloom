"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useMyDays, useNow } from "@/lib/use-my-day";
import type { BuiltDay, DayTask } from "@/lib/my-day";
import { cn, formatTime } from "@/lib/utils";
import type { Child } from "@/lib/types";

const at = (timestamp: string) => format(new Date(timestamp), "h:mm a");
const shortTime = (hhmm: string) => formatTime(hhmm).replace(/^0/, "");

/** "2 Do first left, before AQSA at 4:00 PM", "All done", or why there's nothing. */
function summary(day: BuiltDay): { text: string; tone: "warn" | "good" | "plain" } {
  const left = day.must.filter(t => !t.doneAt).length;
  if (day.total > 0 && day.done === day.total) return { text: "All done for today", tone: "good" };
  if (left > 0) {
    const due = day.deadline ? `, before ${day.deadline.label} at ${shortTime(day.deadline.time)}` : "";
    return { text: `${left} Do first left${due}`, tone: "warn" };
  }
  if (day.total > 0) return { text: `Do first done · ${day.total - day.done} Hobby left`, tone: "plain" };
  return { text: "Nothing to tick today", tone: "plain" };
}

/**
 * Home: how each child's My Day is going — progress, what's left before the next class,
 * and a log of what they ticked and when. Parents can tick homework for them or mark
 * "No homework this time". Shows only children with something planned today.
 */
export function KidsTodayCard({ childIds }: { childIds: string[] }) {
  const now = useNow();
  const router = useRouter();
  const { children, days, toggle, skip } = useMyDays(now);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const shown = children.filter(c => {
    const d = days.get(c.id);
    return childIds.includes(c.id) && d && (d.total > 0 || d.free.length > 0 || d.homeworkLater.length > 0);
  });
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="kids-today" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="kids-today" className="flex items-center gap-2 font-semibold text-[var(--ink)]">
          <ListChecks size={16} className="text-[var(--stem)]" aria-hidden="true" /> Kids today
        </h2>
        <button type="button" onClick={() => router.push("/my-day?from=bloom")}
          className="h-12 -my-3 px-1 text-sm font-semibold text-[var(--stem)] hover:underline cursor-pointer">
          Open My Day
        </button>
      </div>
      <ul className="border border-[var(--rule)] bg-[var(--sheet)] divide-y divide-[var(--rule)]">
        {shown.map(child => (
          <ChildRow key={child.id} child={child} day={days.get(child.id)!}
            open={!!open[child.id]} onToggleOpen={() => setOpen(o => ({ ...o, [child.id]: !o[child.id] }))}
            onTick={t => toggle(child, t)} onSkip={t => skip(child, t)}
            onOpenMyDay={() => router.push(`/my-day?from=bloom&child=${child.id}`)} />
        ))}
      </ul>
    </section>
  );
}

function ChildRow({ child, day, open, onToggleOpen, onTick, onSkip, onOpenMyDay }: {
  child: Child;
  day: BuiltDay;
  open: boolean;
  onToggleOpen: () => void;
  onTick: (t: DayTask) => void;
  onSkip: (t: DayTask) => void;
  onOpenMyDay: () => void;
}) {
  const s = summary(day);
  const all = [...day.must, ...day.practice];
  const last = [...all, ...day.free].filter(t => t.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))[0];
  const noSchool = day.info.kind === "holiday" ? `No school · ${day.info.reason}` : null;

  return (
    <li>
      <button type="button" onClick={onToggleOpen} aria-expanded={open}
        className="w-full px-4 py-3 flex flex-col gap-2 text-left cursor-pointer hover:bg-[var(--bg-secondary)]">
        <span className="w-full flex items-center gap-3">
          <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={32} />
          <span className="flex-1 min-w-0 text-base font-semibold text-[var(--ink)]">{child.name}</span>
          {day.total > 0 && <span className="text-sm font-semibold tabular-nums">{day.done} of {day.total}</span>}
          {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </span>
        {day.total > 0 && (
          <span aria-hidden="true" className="w-full flex gap-[3px] h-1.5">
            {all.map(t => <span key={t.key} className={cn("flex-1 rounded-sm", t.doneAt ? "bg-[var(--stem)]" : "bg-[#d5ded4]")} />)}
          </span>
        )}
        <span className={cn("text-sm leading-5",
          s.tone === "warn" ? "text-[#8a4207] font-medium" : s.tone === "good" ? "text-[var(--stem)] font-medium" : "text-[var(--ink-soft)]")}>
          {[noSchool, s.text, last ? `Last: ${last.title} · ${at(last.doneAt!)}` : null].filter(Boolean).join(" · ")}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          <ul className="border-t border-[var(--rule)] divide-y divide-[var(--rule)]/60">
            {[...day.must, ...day.homeworkLater, ...day.practice].map(t => (
              <LogRow key={t.key} task={t} onTick={onTick} onSkip={onSkip} />
            ))}
            {day.free.filter(f => f.doneAt).map(f => (
              <li key={f.key} className="flex items-center gap-3 min-h-11 py-1 text-sm">
                <span className="w-[72px] shrink-0 font-semibold tabular-nums text-[var(--stem)]">{at(f.doneAt!)}</span>
                <span className="flex-1 min-w-0">Free Play: {f.title}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onOpenMyDay}
            className="mt-1 h-11 px-1 text-sm font-semibold text-[var(--stem)] hover:underline cursor-pointer">
            Open {child.name}’s My Day
          </button>
        </div>
      )}
    </li>
  );
}

function LogRow({ task, onTick, onSkip }: { task: DayTask; onTick: (t: DayTask) => void; onSkip: (t: DayTask) => void }) {
  const hw = task.homework;
  const done = !!task.doneAt;
  return (
    <li className="py-2 text-sm">
      <div className="flex items-start gap-3 min-h-7">
        <span className={cn("w-[72px] shrink-0 tabular-nums", done ? "font-semibold text-[var(--stem)]" : "text-[var(--ink-faint)]")}>
          {done ? at(task.doneAt!) : "not yet"}
        </span>
        <span className="flex-1 min-w-0">
          <span className={cn("text-[var(--ink)]", !done && "text-[var(--ink-soft)]")}>{task.title}</span>
          {(task.source.label || hw?.overdue) && (
            <span className="block text-xs leading-4 text-[var(--ink-faint)]">
              {hw?.overdue && !done && <span className="font-semibold text-[#8f1d14]">Overdue · </span>}
              {task.source.label}
            </span>
          )}
        </span>
      </div>
      {hw && (
        <div className="mt-1 ml-[84px] flex flex-wrap gap-2">
          {done ? (
            <button type="button" onClick={() => onTick(task)} className={pillCls}>Undo</button>
          ) : (<>
            <button type="button" onClick={() => onTick(task)} className={pillCls}>Mark done</button>
            <button type="button" onClick={() => onSkip(task)} className={pillCls}>No homework this time</button>
          </>)}
        </div>
      )}
    </li>
  );
}

const pillCls = cn(
  "relative h-9 px-3 text-xs font-semibold rounded-full border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer",
  "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']"
);
