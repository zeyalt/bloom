import { useQuery } from "@tanstack/react-query";
import type { Child, Schedule, Activity, AttendanceLog, Expense } from "./types";

export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const res = await fetch("/api/children");
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json() as Promise<Child[]>;
    },
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const res = await fetch("/api/schedules");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json() as Promise<Schedule[]>;
    },
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const res = await fetch("/api/activities");
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json() as Promise<Activity[]>;
    },
  });
}

export function useAttendanceLogs(options?: { limit?: number; from?: string; to?: string; childId?: string; activityId?: string }) {
  const queryKey = ["attendance-logs", options];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.append("limit", String(options.limit));
      if (options?.from) params.append("from", options.from);
      if (options?.to) params.append("to", options.to);
      if (options?.childId) params.append("child_id", options.childId);
      if (options?.activityId) params.append("activity_id", options.activityId);

      const url = `/api/attendance-logs${params.toString() ? "?" + params.toString() : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch attendance logs");
      const data = await res.json();
      return data.data as AttendanceLog[];
    },
  });
}

export function useExpenses(options?: { limit?: number; childId?: string; year?: number }) {
  const queryKey = ["expenses", options];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.append("limit", String(options.limit));
      if (options?.childId) params.append("child_id", options.childId);
      if (options?.year) params.append("year", String(options.year));

      const url = `/api/expenses${params.toString() ? "?" + params.toString() : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const data = await res.json();
      return data.data as Expense[];
    },
  });
}
