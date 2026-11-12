"use client";

// One source for every screen that shows My Day — the kids' tablet and the parent's
// Home card — so they always agree: the same data, the same day rules, the same ticks.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { useAllAttendanceLogs, useChildren, useGoals, useSchedules } from "./api-hooks";
import { MY_DAY_KEYS, myDayApi, useCalendarDays, useRoutineItems, useSchoolHours, useTicks } from "./my-day-api";
import { HOMEWORK_LOOKBACK_DAYS, buildDay, type BuiltDay, type DayTask } from "./my-day";
import type { Child, TaskTick } from "./types";

/** The current time, updated every 30 seconds — My Day screens are left open all day. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function useMyDays(now: Date) {
  const iso = format(now, "yyyy-MM-dd");
  const hhmm = format(now, "HH:mm");
  const from = format(addDays(parseISO(iso), -HOMEWORK_LOOKBACK_DAYS), "yyyy-MM-dd");
  const qc = useQueryClient();

  const { data: children = [], isLoading: lc } = useChildren();
  const { data: schedules = [] } = useSchedules();
  const { data: goals = [] } = useGoals();
  const { data: calendarDays = [] } = useCalendarDays();
  const { data: hours = [] } = useSchoolHours();
  const { data: routine = [] } = useRoutineItems();
  const { data: attendance = [] } = useAllAttendanceLogs();
  const { data: ticks = [], isLoading: lt } = useTicks(from, iso, { refetchInterval: 60_000 });

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
      map.set(child.id, buildDay({
        child, iso, now: hhmm, calendarDays, hours, routine, goals, ticks, attendance,
        schedules: schedules as Parameters<typeof buildDay>[0]["schedules"],
      }));
    }
    return map;
  }, [children, iso, hhmm, calendarDays, hours, routine, goals, ticks, attendance, schedules]);

  /**
   * Tick, untick, or (homework, parents only) mark "no homework this time". The screen
   * changes at once; if saving fails it's put back.
   */
  const write = useCallback(async (child: Child, task: DayTask, action: "toggle" | "skip") => {
    const date = task.homework?.lesson ?? iso;
    const key = [...MY_DAY_KEYS.ticks, from, iso];
    const previous = qc.getQueryData<TaskTick[]>(key) ?? [];
    const removing = action === "toggle" && !!task.doneAt;
    const next: TaskTick[] = removing
      ? previous.filter(t => !(t.child_id === child.id && t.item_key === task.key))
      : [...previous.filter(t => !(t.child_id === child.id && t.item_key === task.key)), {
          id: `pending-${task.key}`, child_id: child.id, date, item_key: task.key, title: task.title,
          tier: task.tier, done_at: new Date().toISOString(), skipped: action === "skip",
        }];
    qc.setQueryData(key, next);
    try {
      if (removing) await myDayApi.untick(child.id, date, task.key);
      else await myDayApi.tick({
        child_id: child.id, date, item_key: task.key, title: task.title, tier: task.tier,
        ...(action === "skip" ? { skipped: true } : {}),
      });
    } catch {
      qc.setQueryData(key, previous);
    } finally {
      qc.invalidateQueries({ queryKey: MY_DAY_KEYS.ticks });
    }
  }, [from, iso, qc]);

  const toggle = useCallback((child: Child, task: DayTask) => write(child, task, "toggle"), [write]);
  const skip = useCallback((child: Child, task: DayTask) => write(child, task, "skip"), [write]);

  return { iso, hhmm, children, days, ticks, toggle, skip, isLoading: lc || lt };
}
