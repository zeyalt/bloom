"use client";

// One source for every screen that shows My Day — the kids' tablet and the parent's
// Home — so they always agree: the same data, the same day rules, the same ticks.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { useAllAttendanceLogs, useChildren, useGoals, useSchedules } from "./api-hooks";
import {
  MY_DAY_KEYS, myDayApi, useCalendarDays, useDayPlans, useOneOffTasks, useRoutineItems, useSchoolHours, useTicks,
} from "./my-day-api";
import { HOMEWORK_LOOKBACK_DAYS, buildDay, type BuiltDay, type DayTask } from "./my-day";
import type { Child, OneOffTask, PlannedTask, TaskTick, TickedBy } from "./types";

/** The current time, updated every 30 seconds — My Day screens are left open all day. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** Past, today or future, relative to today's date. */
export type DayTense = "past" | "today" | "future";

/** Same items in the same order (the database hands JSON back with its keys reordered). */
const norm = (list: PlannedTask[]) =>
  JSON.stringify(list.map(i => [i.key, i.title, i.tier, i.source.kind, i.source.label ?? null]));
const sameList = (a: PlannedTask[], b: PlannedTask[]) => norm(a) === norm(b);

/**
 * Every child's day on `date` (default: today), with tick, untick and skip.
 * - Today: built live (homework, "now", deadlines), and today's list is saved as a DayPlan
 *   whenever it changes, so later it can be shown as it was.
 * - A past day: built from its saved list when there is one (else today's routine), as at
 *   the end of the day, without homework.
 * - A future day: the plan only; nothing can be ticked (`canTick` is false).
 * One-off tasks (added on Home for a single date) are part of the day on every screen.
 * `by` is stored on every tick: the tablet is "child", Home is "parent".
 */
export function useMyDays(now: Date, opts: { date?: string; by?: TickedBy } = {}) {
  const today = format(now, "yyyy-MM-dd");
  const iso = opts.date ?? today;
  const tense: DayTense = iso < today ? "past" : iso > today ? "future" : "today";
  const by: TickedBy = opts.by ?? "child";
  const hhmm = tense === "today" ? format(now, "HH:mm") : tense === "past" ? "23:59" : "00:00";
  // Today needs earlier ticks too (homework is dated by its lesson); other days only their own.
  const from = tense === "today" ? format(addDays(parseISO(iso), -HOMEWORK_LOOKBACK_DAYS), "yyyy-MM-dd") : iso;
  const qc = useQueryClient();

  const childrenQ = useChildren();
  const schedulesQ = useSchedules();
  const goalsQ = useGoals();
  const calendarQ = useCalendarDays();
  const hoursQ = useSchoolHours();
  const routineQ = useRoutineItems();
  const { data: attendance = [] } = useAllAttendanceLogs();
  const ticksQ = useTicks(from, iso, { refetchInterval: tense === "today" ? 60_000 : undefined });
  const plansQ = useDayPlans(iso);
  const oneOffQ = useOneOffTasks(iso, iso, { refetchInterval: tense === "today" ? 60_000 : undefined });

  const children = useMemo(() => childrenQ.data ?? [], [childrenQ.data]);
  const ticks = useMemo(() => ticksQ.data ?? [], [ticksQ.data]);
  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data]);
  const oneOffs = useMemo(() => oneOffQ.data ?? [], [oneOffQ.data]);

  // Pick up changes made elsewhere (Settings, the other device) without a reload.
  useEffect(() => {
    const t = window.setInterval(() => {
      for (const key of [MY_DAY_KEYS.routine, MY_DAY_KEYS.calendarDays, MY_DAY_KEYS.schoolHours, ["schedules"], ["goals"], ["attendance-logs"]]) {
        qc.invalidateQueries({ queryKey: key });
      }
    }, 5 * 60_000);
    return () => window.clearInterval(t);
  }, [qc]);

  const days = useMemo(() => {
    const map = new Map<string, BuiltDay>();
    for (const child of children) {
      const saved = tense === "past" ? plans.find(p => p.child_id === child.id)?.items ?? null : null;
      map.set(child.id, buildDay({
        child, iso, now: hhmm, ticks, attendance, plan: saved, homework: tense === "today", oneOffs,
        calendarDays: calendarQ.data ?? [], hours: hoursQ.data ?? [], routine: routineQ.data ?? [], goals: goalsQ.data ?? [],
        schedules: (schedulesQ.data ?? []) as Parameters<typeof buildDay>[0]["schedules"],
      }));
    }
    return map;
  }, [children, iso, hhmm, tense, plans, oneOffs, calendarQ.data, hoursQ.data, routineQ.data, goalsQ.data, ticks, attendance, schedulesQ.data]);

  // Save today's list once everything it's built from has loaded, and again if it changes.
  const allLoaded = [childrenQ, schedulesQ, goalsQ, calendarQ, hoursQ, routineQ, plansQ, oneOffQ].every(q => q.isSuccess);
  const savedNow = useRef(new Map<string, string>());
  useEffect(() => {
    if (tense !== "today" || !allLoaded) return;
    for (const child of children) {
      const list = days.get(child.id)?.plan ?? [];
      const existing = plans.find(p => p.child_id === child.id);
      if (existing ? sameList(existing.items, list) : list.length === 0) continue;
      const sig = `${iso}|${norm(list)}`;
      if (savedNow.current.get(child.id) === sig) continue; // already sent from here
      savedNow.current.set(child.id, sig);
      myDayApi.saveDayPlan(child.id, iso, list)
        .then(() => qc.invalidateQueries({ queryKey: MY_DAY_KEYS.dayPlans }))
        .catch(() => savedNow.current.delete(child.id));
    }
  }, [tense, allLoaded, children, days, plans, iso, qc]);

  /**
   * Tick, untick, or (homework, parents only) mark "no homework this time". The screen
   * changes at once; if saving fails it's put back. Future days can't be ticked.
   */
  const write = useCallback(async (child: Child, task: DayTask, action: "toggle" | "skip") => {
    if (tense === "future") return;
    const date = task.homework?.lesson ?? iso;
    const key = [...MY_DAY_KEYS.ticks, from, iso];
    const previous = qc.getQueryData<TaskTick[]>(key) ?? [];
    const removing = action === "toggle" && !!task.doneAt;
    const others = previous.filter(t => !(t.child_id === child.id && t.item_key === task.key));
    const next: TaskTick[] = removing ? others : [...others, {
      id: `pending-${task.key}`, child_id: child.id, date, item_key: task.key, title: task.title,
      tier: task.tier, done_at: new Date().toISOString(), skipped: action === "skip", by,
    }];
    qc.setQueryData(key, next);
    try {
      if (removing) await myDayApi.untick(child.id, date, task.key);
      else await myDayApi.tick({
        child_id: child.id, date, item_key: task.key, title: task.title, tier: task.tier, by,
        ...(action === "skip" ? { skipped: true } : {}),
      });
    } catch {
      qc.setQueryData(key, previous);
    } finally {
      qc.invalidateQueries({ queryKey: MY_DAY_KEYS.ticks });
    }
  }, [tense, from, iso, by, qc]);

  const toggle = useCallback((child: Child, task: DayTask) => write(child, task, "toggle"), [write]);

  /** Add a task for one child on this day only (parents, from Home). */
  const addOneOff = useCallback(async (child: Child, title: string, tier: OneOffTask["tier"]) => {
    await myDayApi.addOneOff({ child_id: child.id, date: iso, title, tier });
    await qc.invalidateQueries({ queryKey: MY_DAY_KEYS.oneOffs });
  }, [iso, qc]);

  /** Remove a one-off task (and its tick). It goes from the screen at once; put back if that fails. */
  const removeOneOff = useCallback(async (task: DayTask) => {
    const id = task.key.replace(/^oneoff:/, "");
    const key = [...MY_DAY_KEYS.oneOffs, iso, iso];
    const previous = qc.getQueryData<OneOffTask[]>(key) ?? [];
    qc.setQueryData(key, previous.filter(o => o.id !== id));
    try {
      await myDayApi.removeOneOff(id);
    } catch {
      qc.setQueryData(key, previous);
    } finally {
      qc.invalidateQueries({ queryKey: MY_DAY_KEYS.oneOffs });
      qc.invalidateQueries({ queryKey: MY_DAY_KEYS.ticks });
    }
  }, [iso, qc]);
  const skip = useCallback((child: Child, task: DayTask) => write(child, task, "skip"), [write]);

  return {
    iso, today, tense, hhmm, children, days, ticks, toggle, skip, addOneOff, removeOneOff,
    canTick: tense !== "future",
    isLoading: childrenQ.isLoading || ticksQ.isLoading,
  };
}
