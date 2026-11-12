// Client-side reads and writes for My Day: school hours, calendars, routines and ticks.
// Reads are React Query hooks with one cache entry per table (they're all small);
// writes go through `myDayApi` and the caller invalidates the matching key.
import { useQuery } from "@tanstack/react-query";
import type { CalendarDay, RoutineItem, SchoolCalendar, SchoolHours, TaskTick } from "./types";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

const get = <T,>(url: string) => async (): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
};

export const MY_DAY_KEYS = {
  schoolHours: ["school-hours"],
  calendars: ["calendars"],
  calendarDays: ["calendar-days"],
  routine: ["routine-items"],
  ticks: ["ticks"],
} as const;

export function useSchoolHours() {
  return useQuery({ queryKey: MY_DAY_KEYS.schoolHours, queryFn: get<SchoolHours[]>("/api/school-hours") });
}
export function useCalendars() {
  return useQuery({ queryKey: MY_DAY_KEYS.calendars, queryFn: get<SchoolCalendar[]>("/api/calendars") });
}
export function useCalendarDays() {
  return useQuery({ queryKey: MY_DAY_KEYS.calendarDays, queryFn: get<CalendarDay[]>("/api/calendar-days") });
}
export function useRoutineItems() {
  return useQuery({ queryKey: MY_DAY_KEYS.routine, queryFn: get<RoutineItem[]>("/api/routine-items") });
}
/** Ticks for a date range (inclusive), all children. */
export function useTicks(from: string, to: string = from, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: [...MY_DAY_KEYS.ticks, from, to],
    queryFn: get<TaskTick[]>(`/api/ticks?from=${from}&to=${to}`),
    refetchInterval: options?.refetchInterval,
  });
}

export interface SchoolDayInput {
  day_of_week: number;
  is_school_day: boolean;
  start_time: string | null;
  end_time: string | null;
  after_school: string | null;
  after_school_until: string | null;
}

export interface CalendarDayInput {
  calendar_id: string | null;
  start_date: string;
  end_date: string;
  kind: "term" | "school_holiday" | "half_day" | "no_school";
  title: string;
  ends_at: string | null;
}

export interface RoutineItemInput {
  child_id?: string;
  day_type: RoutineItem["day_type"];
  weekdays: number[];
  tier: RoutineItem["tier"];
  title: string;
  at_time: string | null;
}

export interface ImportResult {
  calendar_id: string;
  years: Record<string, { moe: number; publicHolidays: number }>;
  missing_moe: number[];
  missing_public_holidays: number[];
}

export const myDayApi = {
  saveSchoolHours: (childId: string, days: SchoolDayInput[]) => send("/api/school-hours", "PUT", { child_id: childId, days }),

  importCalendar: (years?: number[]) => send("/api/calendars/import", "POST", years ? { years } : {}) as Promise<ImportResult>,
  addCalendar: (name: string) => send("/api/calendars", "POST", { name }) as Promise<SchoolCalendar>,
  renameCalendar: (id: string, name: string) => send(`/api/calendars/${id}`, "PATCH", { name }),
  removeCalendar: (id: string) => send(`/api/calendars/${id}`, "DELETE"),

  addDay: (input: CalendarDayInput) => send("/api/calendar-days", "POST", input),
  updateDay: (id: string, input: CalendarDayInput) => send(`/api/calendar-days/${id}`, "PATCH", input),
  removeDay: (id: string) => send(`/api/calendar-days/${id}`, "DELETE"),

  addRoutineItem: (input: RoutineItemInput) => send("/api/routine-items", "POST", input) as Promise<RoutineItem>,
  updateRoutineItem: (id: string, input: RoutineItemInput) => send(`/api/routine-items/${id}`, "PATCH", input),
  removeRoutineItem: (id: string) => send(`/api/routine-items/${id}`, "DELETE"),
  reorderRoutine: (ids: string[]) => send("/api/routine-items/reorder", "POST", { ids }),

  tick: (input: { child_id: string; date: string; item_key: string; title: string; tier: string; skipped?: boolean }) =>
    send("/api/ticks", "POST", input) as Promise<TaskTick>,
  untick: (childId: string, date: string, itemKey: string) =>
    send(`/api/ticks?child_id=${encodeURIComponent(childId)}&date=${date}&item_key=${encodeURIComponent(itemKey)}`, "DELETE"),
};
