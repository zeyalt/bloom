import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Child, Schedule, Activity, AttendanceLog, Expense, ActivityCategory } from "./types";

export async function fetchCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json() as Promise<ActivityCategory[]>;
}

export async function fetchChildren() {
  const res = await fetch("/api/children");
  if (!res.ok) throw new Error("Failed to fetch children");
  return res.json() as Promise<Child[]>;
}

export async function fetchSchedules() {
  const res = await fetch("/api/schedules");
  if (!res.ok) throw new Error("Failed to fetch schedules");
  return res.json() as Promise<Schedule[]>;
}

export async function fetchActivities() {
  const res = await fetch("/api/activities");
  if (!res.ok) throw new Error("Failed to fetch activities");
  return res.json() as Promise<Activity[]>;
}

export async function fetchAttendanceLogs() {
  const res = await fetch("/api/attendance-logs?limit=all");
  if (!res.ok) throw new Error("Failed to fetch attendance logs");
  const data = await res.json();
  return data.data as AttendanceLog[];
}

export async function fetchExpenses(options?: { limit?: number; childId?: string; year?: number }) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.childId) params.append("child_id", options.childId);
  if (options?.year) params.append("year", String(options.year));

  const url = `/api/expenses${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  const data = await res.json();
  return data.data as Expense[];
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
}

export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: fetchChildren,
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 30 * 60 * 1000,      // 30 minutes (formerly cacheTime)
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: fetchActivities,
  });
}

/**
 * The whole attendance history, fetched once under a single key.
 *
 * Every tab used to fetch its own window (`{limit:300}`, `{limit:"all"}`,
 * `{from,to}`…), and because the options object is part of the query key those
 * were four separate cache entries of the same few hundred rows — a fresh
 * download and JSON parse on each tab switch, and again on every week arrow.
 * One shared entry means the second tab reads from cache.
 */
function useAllAttendanceLogs() {
  return useQuery({
    queryKey: ["attendance-logs"],
    queryFn: fetchAttendanceLogs,
  });
}

/**
 * Attendance logs narrowed to a window, with `activity` (including its
 * category) and `child` re-attached from the caches that already hold them.
 * The filtering that the API used to do server-side now happens here against
 * the shared dataset — same shape out, no extra request.
 *
 * `limit` counts from the most recent log, matching the API's `date desc`
 * ordering, and is applied after the other filters.
 */
export function useAttendanceLogs(options?: { limit?: number | "all"; from?: string; to?: string; childId?: string; activityId?: string }) {
  const logsQuery = useAllAttendanceLogs();
  const childrenQuery = useChildren();
  const activitiesQuery = useActivities();

  const { limit, from, to, childId, activityId } = options ?? {};
  const allLogs = logsQuery.data;
  const children = childrenQuery.data;
  const activities = activitiesQuery.data;

  const data = useMemo(() => {
    if (!allLogs) return undefined;

    const activityById = new Map((activities ?? []).map(a => [a.id, a]));
    const childById = new Map((children ?? []).map(c => [c.id, c]));

    const filtered = allLogs.filter(log => {
      if (childId && log.child_id !== childId) return false;
      if (activityId && log.activity_id !== activityId) return false;
      // Dates are ISO strings, so a lexical compare on the date part is a
      // correct inclusive range check.
      const day = log.date.slice(0, 10);
      if (from && day < from.slice(0, 10)) return false;
      if (to && day > to.slice(0, 10)) return false;
      return true;
    });

    const windowed = typeof limit === "number" ? filtered.slice(0, limit) : filtered;

    return windowed.map(log => ({
      ...log,
      activity: activityById.get(log.activity_id),
      child: childById.get(log.child_id),
    }));
  }, [allLogs, activities, children, limit, from, to, childId, activityId]);

  return {
    ...logsQuery,
    data,
    // Rows would otherwise render with blank activity/child names for a frame
    // while the lookup queries are still in flight.
    isLoading: logsQuery.isLoading || childrenQuery.isLoading || activitiesQuery.isLoading,
  };
}

export function useExpenses(options?: { limit?: number; childId?: string; year?: number }) {
  const queryKey = ["expenses", options];
  return useQuery({
    queryKey,
    queryFn: () => fetchExpenses(options),
  });
}
