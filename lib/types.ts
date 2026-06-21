// ============================================================
// Bloom — TypeScript types matching the Supabase schema
// ============================================================

export type ChildId = "11111111-1111-1111-1111-111111111111" | "22222222-2222-2222-2222-222222222222";

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
  institution: string;
  instructor_name: string | null;
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
  duration_minutes: number | null;
  status: AttendanceStatus;
  sent_by: string | null;
  instructor_name: string | null;
  lesson_number: string | null;
  level: string | null;
  location: string | null;
  diary_notes: string | null;
  absence_reason: string | null;
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
  receipt_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  child?: Child;
  category?: ActivityCategory;
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

export interface Sender {
  id: string;
  name: string;
  relationship: string | null;
  created_at: string;
}

// ============================================================
// View types
// ============================================================

export interface AttendanceSummary {
  activity_id: string;
  child_name: string;
  category_name: string;
  institution: string;
  total_sessions: number;
  attended: number;
  absent: number;
  replacements: number;
  cancelled: number;
  attendance_rate: number;
}

export interface WeeklyScheduleRow {
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  location: string | null;
  institution: string;
  instructor_name: string | null;
  category_name: string;
  category_color: string;
  child_name: string;
  child_color: string;
}

// ============================================================
// Supabase Database type (for createClient<Database>)
// ============================================================

// Base column-only types (no joined/virtual fields) — used for DB Insert/Update typing
export type ActivityCols = Omit<Activity, "child" | "category">;
export type ScheduleCols = Omit<Schedule, "activity">;
export type AttendanceCols = Omit<AttendanceLog, "activity" | "child">;
export type ExpenseCols = Omit<Expense, "child" | "category">;
export type MilestoneCols = Omit<Milestone, "activity" | "child">;

// Relationship type alias (postgrest-js GenericRelationship shape)
type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };
// Supabase GenericTable requires Row: Record<string, unknown> — add index signature via intersection
type R<T> = T & Record<string, unknown>;

export type Database = {
  public: {
    Tables: {
      children:            { Row: R<Child>;           Insert: Omit<Child,           "id" | "created_at" | "updated_at">; Update: Partial<Child>;           Relationships: Rel[] };
      activity_categories: { Row: R<ActivityCategory>; Insert: Omit<ActivityCategory, "id" | "created_at">;               Update: Partial<ActivityCategory>; Relationships: Rel[] };
      activities:          { Row: R<ActivityCols>;     Insert: Omit<ActivityCols,    "id" | "created_at" | "updated_at">; Update: Partial<ActivityCols>;    Relationships: Rel[] };
      schedules:           { Row: R<ScheduleCols>;     Insert: Omit<ScheduleCols,    "id" | "created_at">;               Update: Partial<ScheduleCols>;    Relationships: Rel[] };
      attendance_logs:     { Row: R<AttendanceCols>;   Insert: Omit<AttendanceCols,  "id" | "created_at" | "updated_at">; Update: Partial<AttendanceCols>; Relationships: Rel[] };
      expenses:            { Row: R<ExpenseCols>;      Insert: Omit<ExpenseCols,     "id" | "created_at" | "updated_at">; Update: Partial<ExpenseCols>;    Relationships: Rel[] };
      milestones:          { Row: R<MilestoneCols>;    Insert: Omit<MilestoneCols,   "id" | "created_at">;               Update: Partial<MilestoneCols>;  Relationships: Rel[] };
      senders:             { Row: R<Sender>;           Insert: Omit<Sender,          "id" | "created_at">;               Update: Partial<Sender>;          Relationships: Rel[] };
    };
    Views: {
      v_attendance_summary: { Row: AttendanceSummary };
      v_weekly_schedule: { Row: WeeklyScheduleRow };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
