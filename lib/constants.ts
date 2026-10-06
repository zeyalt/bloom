// ============================================================
// Bloom — App-wide constants
// ============================================================

// Attendance status display
export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  attended: "Attended",
  absent: "Absent",
  replacement: "Replacement",
  trial: "Trial",
  grading: "Grading",
  online: "Online",
  sparring: "Sparring",
  competition: "Competition",
  cancelled_by_provider: "Cancelled",
  league_game: "League Game",
};

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  attended: "#16A34A",
  absent: "#DC2626",
  replacement: "#2563EB",
  trial: "#D97706",
  grading: "#8B5CF6",
  online: "#0EA5E9",
  sparring: "#F97316",
  competition: "#DB2777",
  cancelled_by_provider: "#78716C",
  league_game: "#22C55E",
};

/** Lesson type pills in the attendance form (spreadsheet “Normal Lesson” → Normal). */
export const LESSON_TYPE_OPTIONS = ["Normal", "Trial", "Replacement", "Online"] as const;

export function normalizeLessonType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "normal" || lower === "normal lesson") return "Normal";
  if (lower === "trial" || lower === "trial lesson") return "Trial";
  if (lower === "replacement" || lower === "replacement lesson") return "Replacement";
  if (lower === "online" || lower === "online lesson") return "Online";
  return t;
}

// Who pays expenses — the children appear too, for fees paid from their own
// savings accounts.
export const PAYERS = [
  "Zeya",
  "Atiqah",
  "Zeya & Atiqah",
  "Zayyan",
  "Zara",
] as const;

export const EXPENSE_TYPES = [
  "Lesson",
  "Grading",
  "Competition",
  "Registration",
  "Miscellaneous",
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_TYPE_COLORS: Record<ExpenseType, string> = {
  Lesson: "#2f6f4e",
  Grading: "#8B5CF6",
  Competition: "#DB2777",
  Registration: "#b45309",
  Miscellaneous: "#6b5344",
};

export function inferExpenseType(description: string): ExpenseType {
  const d = (description || "").toLowerCase();
  if (/\bgrading\b/.test(d)) return "Grading";
  if (/competition|championship|jssl/.test(d)) return "Competition";
  if (/exchange trip/.test(d)) return "Miscellaneous";
  if (/jersey|re-?regist|\bregistration\b|miscellaneous fees|programme fees|refundable deposit/.test(d)) {
    return "Registration";
  }
  return "Lesson";
}

// Days of the week (0=Sun, 1=Mon … 6=Sat) — display starting Monday
export const DAYS_OF_WEEK = [
  { value: 1, label: "Mon", fullLabel: "Monday" },
  { value: 2, label: "Tue", fullLabel: "Tuesday" },
  { value: 3, label: "Wed", fullLabel: "Wednesday" },
  { value: 4, label: "Thu", fullLabel: "Thursday" },
  { value: 5, label: "Fri", fullLabel: "Friday" },
  { value: 6, label: "Sat", fullLabel: "Saturday" },
  { value: 0, label: "Sun", fullLabel: "Sunday" },
] as const;

// Nav items
export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "CalendarDays" },
  { href: "/attendance", label: "Attendance", icon: "ClipboardList" },
  { href: "/expenses", label: "Expenses", icon: "Receipt" },
  { href: "/analytics", label: "Analytics", icon: "BarChart3" },
  { href: "/journal", label: "Journal", icon: "NotebookPen" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
