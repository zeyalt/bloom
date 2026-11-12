// Server-side helpers shared by the My Day API routes (school hours, calendars,
// routines, ticks) and the fields My Day adds to children, activities and goals.
import type { CalendarDayKind, RoutineDayType, RoutineTier } from "./types";
import { parseDay } from "./goal-queries";

export const DAY_TYPES: readonly RoutineDayType[] = ["school", "holiday", "any"];
export const TIERS: readonly RoutineTier[] = ["anchor", "must", "practice", "free"];
export const CALENDAR_DAY_KINDS: readonly CalendarDayKind[] = ["term", "school_holiday", "public_holiday", "half_day", "no_school"];
/** Kinds a parent can add by hand (public holidays only come from data.gov.sg). */
export const USER_DAY_KINDS: readonly CalendarDayKind[] = ["term", "school_holiday", "half_day", "no_school"];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" (24-hour) → itself; null/"" → null; anything else → undefined (invalid). */
export function parseTime(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  return typeof value === "string" && TIME.test(value) ? value : undefined;
}

/** For optional text fields: undefined stays undefined (leave as is), blank → null, else trimmed. */
export function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/** The school fields a child create/update may carry — only the ones actually sent. */
export function schoolFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (body.school_level !== undefined) data.schoolLevel = optionalText(body.school_level);
  if (body.school_level_year !== undefined) {
    const y = Number(body.school_level_year);
    data.schoolLevelYear = Number.isInteger(y) && y > 2000 && y < 2100 ? y : null;
  }
  if (typeof body.auto_promote === "boolean") data.autoPromote = body.auto_promote;
  if (body.calendar_id !== undefined) data.calendarId = body.calendar_id || null;
  return data;
}

/** Validates a hand-added day; returns the Prisma data, or an error message. */
export function parseUserDay(body: Record<string, unknown>) {
  const start = parseDay(body.start_date);
  const end = body.end_date ? parseDay(body.end_date) : start;
  const kind = body.kind as (typeof USER_DAY_KINDS)[number];
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const endsAt = parseTime(body.ends_at ?? null);
  if (!start || !end) return "start_date (and end_date, if given) must be YYYY-MM-DD";
  if (end < start) return "end_date can't be before start_date";
  if (!USER_DAY_KINDS.includes(kind)) return "kind must be term, school_holiday, half_day or no_school";
  if (!title) return "title is required";
  if (endsAt === undefined) return "ends_at must be HH:MM";
  if (kind === "half_day" && !endsAt) return "a half day needs the time school ends";
  return {
    calendarId: typeof body.calendar_id === "string" && body.calendar_id ? body.calendar_id : null,
    startDate: start,
    endDate: end,
    kind,
    title,
    endsAt: kind === "half_day" ? endsAt : null,
    levels: typeof body.levels === "string" && body.levels.trim() ? body.levels.trim() : null,
  };
}

/** Validates a routine line (create or update); returns Prisma data or an error message. */
export function parseRoutineItem(body: Record<string, unknown>) {
  const dayType = body.day_type as RoutineDayType;
  const tier = body.tier as RoutineTier;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const atTime = parseTime(body.at_time ?? null);
  const weekdays = Array.isArray(body.weekdays) ? body.weekdays.map(Number) : [];
  if (!DAY_TYPES.includes(dayType)) return "day_type must be school, holiday or any";
  if (!TIERS.includes(tier)) return "tier must be anchor, must, practice or free";
  if (!title) return "title is required";
  if (atTime === undefined) return "at_time must be HH:MM";
  if (tier === "anchor" && !atTime) return "a fixed time needs a time";
  if (weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) return "weekdays must be 0–6";
  return {
    dayType,
    tier,
    title,
    atTime: tier === "anchor" ? atTime : null,
    weekdays: [...new Set(weekdays)].sort(),
  };
}
