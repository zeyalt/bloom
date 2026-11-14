// ============================================================
// Bloom — shared TypeScript types (API / Prisma rows)
// ============================================================

export type ActivityStatus = "active" | "paused" | "completed" | "dropped";

export type AttendanceStatus =
  | "attended"
  | "absent"
  | "replacement"
  | "trial"
  | "grading"
  | "online"
  | "sparring"
  | "competition"
  | "cancelled_by_provider"
  | "league_game";

export type MilestoneType =
  | "grading"
  | "level_up"
  | "competition"
  | "achievement"
  | "term_start"
  | "term_end"
  | "other";

export interface Child {
  id: string;
  name: string;
  nickname: string | null;
  date_of_birth: string | null;
  school: string | null;
  color_code: string;
  avatar_emoji: string;
  avatar_key: string | null;
  school_level: string | null;      // level code: K1, P2, S1…
  school_level_year: number | null; // the year school_level was true for
  auto_promote: boolean;            // moves up a level each January
  calendar_id: string | null;       // the school calendar they follow
  created_at: string;
  updated_at: string;
}

export interface ActivityCategory {
  id: string;
  name: string;
  color_code: string;
  icon: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  child_id: string;
  category_id: string;
  activity_name?: string | null;
  institution: string;
  instructor_name: string | null;
  level: string | null;
  status: ActivityStatus;
  prep_task?: string | null;     // a must-do My Day adds on this class's days
  homework_from?: string | null; // homework after every lesson since this date; null = none
  homework_note?: string | null; // e.g. "Worksheet and spelling"
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  child?: Child;
  category?: ActivityCategory;
}

export interface Schedule {
  id: string;
  activity_id: string;
  day_of_week: number; // 0=Sunday … 6=Saturday
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  location: string | null;
  term?: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_until: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  activity?: Activity;
}

export interface AttendanceLog {
  id: string;
  activity_id: string;
  child_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  status: AttendanceStatus;
  sent_by: string | null;
  fetcher?: string | null;
  instructor_name: string | null;
  lesson_type: string | null;
  location: string | null;
  absence_reason: string | null;
  lesson_number: number | null;
  level: string | null;
  learned?: string | null;
  diary_notes: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  activity?: Activity;
  child?: Child;
}

export interface Expense {
  id: string;
  child_id: string;
  category_id: string;
  activity_id: string | null;
  institution: string;
  description: string;
  amount: number;
  payment_date: string;
  paid_by: string;
  year: number;
  num_lessons?: number | null;
  expense_type: string;
  receipt_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  child?: Child;
  category?: ActivityCategory;
  activity?: Activity;
}

export interface Milestone {
  id: string;
  activity_id: string;
  child_id: string;
  date: string;
  milestone_type: MilestoneType;
  title: string;
  description: string | null;
  result: string | null;
  created_at: string;
  // Joined fields
  activity?: Activity;
  child?: Child;
}

// ============================================================
// Goals — per-child goals with a target date
// ============================================================

export type GoalKind = "milestone" | "measured";

/** The "how" under a checkpoint: a habit being worked on until it sticks (got_date set). */
export interface GoalFocus {
  id: string;
  checkpoint_id: string;
  text: string;
  got_date: string | null;
  sort_order: number;
}

export interface GoalCheckpoint {
  id: string;
  goal_id: string;
  due_date: string;
  text: string;
  hit_date: string | null;
  sort_order: number;
  focus: GoalFocus[];
}

/** A dated update (note, milestone goals) or reading (value, measured goals). */
export interface GoalEntry {
  id: string;
  goal_id: string;
  date: string;
  note: string | null;
  value: number | null;
  created_at: string;
}

export interface Goal {
  id: string;
  child_id: string;
  kind: GoalKind;
  title: string;
  target_date: string;
  achieved_date: string | null;
  unit: string | null;
  target_value: number | null;
  practice_task?: string | null;            // practice My Day adds while the goal is open
  practice_days?: RoutineDayType | null;    // on which kind of day
  created_at: string;
  updated_at: string;
  checkpoints: GoalCheckpoint[];
  entries: GoalEntry[];
}

export interface Sender {
  id: string;
  name: string;
  relationship: string | null;
  created_at: string;
}

// ─── My Day ──────────────────────────────────────────────────────────────────

export type RoutineDayType = "school" | "holiday" | "any";
export type RoutineTier = "anchor" | "must" | "practice" | "free";
export type CalendarDayKind = "term" | "school_holiday" | "public_holiday" | "half_day" | "no_school";

export interface SchoolHours {
  id: string;
  child_id: string;
  day_of_week: number; // 0=Sunday … 6=Saturday
  is_school_day: boolean;
  start_time: string | null;
  end_time: string | null;
  after_school: string | null;       // an after-school activity, e.g. "CCA – Badminton"
  after_school_until: string | null; // when it ends ("HH:MM")
}

export interface SchoolCalendar {
  id: string;
  name: string;
  kind: "moe_primary" | "custom";
  created_at: string;
}

export interface CalendarDay {
  id: string;
  calendar_id: string | null; // null = applies to everyone (public holidays)
  start_date: string;
  end_date: string;
  kind: CalendarDayKind;
  title: string;
  ends_at: string | null;     // half days: when school ends
  levels: string | null;      // "P2,P3" — null = every level
  source: "moe" | "data.gov.sg" | "you";
  created_at: string;
}

export interface RoutineItem {
  id: string;
  child_id: string;
  weekdays: number[]; // empty = every day
  start_date: string; // first day it applies
  end_date: string | null; // last day it applies; null = goes on
  tier: RoutineTier;
  title: string;
  at_time: string | null; // anchors only, "HH:MM"
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskTick {
  id: string;
  child_id: string;
  date: string;
  item_key: string; // routine:<id> | prep:<activityId> | goal:<goalId> | homework:<activityId>:<lessonDate>
  title: string;
  tier: RoutineTier | "homework";
  done_at: string;
  skipped: boolean; // homework a parent marked "No homework this time"
  by: TickedBy;
}

export type TickedBy = "child" | "parent";

/** One line of a saved day list (see DayPlan): what the child had to do that day. */
export interface PlannedTask {
  key: string;
  title: string;
  tier: "must" | "practice" | "free";
  source: { kind: "routine" | "prep" | "goal" | "oneoff"; label: string | null };
}

/** A task for one child on one date only, added by a parent on Home. Ticked under `oneoff:<id>`. */
export interface OneOffTask {
  id: string;
  child_id: string;
  date: string;
  title: string;
  tier: "must" | "practice" | "free";
  created_at: string;
}

export interface DayPlan {
  id: string;
  child_id: string;
  date: string;
  items: PlannedTask[];
  saved_at: string;
}
