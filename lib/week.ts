import { startOfWeek, addWeeks, addDays, format } from "date-fns";
import { DAYS_OF_WEEK } from "./constants";

export interface WeekDay {
  date: Date;
  iso: string;        // yyyy-MM-dd
  dayOfWeek: number;  // 0=Sun … 6=Sat
  label: string;      // "Mon"
  fullLabel: string;  // "Monday"
  isToday: boolean;
}

// Mon–Sun dates for the week `offset` weeks from the current week (0 = this week)
export function getWeekDays(offset: number): WeekDay[] {
  const monday = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), offset);
  const todayIso = format(new Date(), "yyyy-MM-dd");
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const dayOfWeek = date.getDay();
    const meta = DAYS_OF_WEEK.find(d => d.value === dayOfWeek);
    const iso = format(date, "yyyy-MM-dd");
    return {
      date,
      iso,
      dayOfWeek,
      label: meta?.label ?? "",
      fullLabel: meta?.fullLabel ?? "",
      isToday: iso === todayIso,
    };
  });
}

// First/last ISO date of the week plus a human label like "23 Jun – 29 Jun 2026"
export function getWeekRange(offset: number): { from: string; to: string; label: string } {
  const days = getWeekDays(offset);
  return {
    from: days[0].iso,
    to: days[6].iso,
    label: `${format(days[0].date, "d MMM")} – ${format(days[6].date, "d MMM yyyy")}`,
  };
}

interface RecurringLike {
  day_of_week: number;
  effective_from?: string | null;
  effective_until?: string | null;
}

// Does a recurring schedule occur on the given date?
export function scheduleOccursOn(schedule: RecurringLike, day: WeekDay): boolean {
  if (schedule.day_of_week !== day.dayOfWeek) return false;
  if (schedule.effective_from && day.iso < schedule.effective_from.slice(0, 10)) return false;
  if (schedule.effective_until && day.iso > schedule.effective_until.slice(0, 10)) return false;
  return true;
}

// Stable key to match a scheduled occurrence against an existing attendance log
export function occurrenceKey(activityId: string, childId: string, iso: string): string {
  return `${activityId}|${childId}|${iso}`;
}
