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

export interface GoalCheckpoint {
  id: string;
  goal_id: string;
  due_date: string;
  text: string;
  hit_date: string | null;
  sort_order: number;
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
