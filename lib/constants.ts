// ============================================================
// Bloom — App-wide constants
// ============================================================

export const CHILDREN = {
  ZAYYAN: "11111111-1111-1111-1111-111111111111",
  ZARA: "22222222-2222-2222-2222-222222222222",
} as const;

// Category IDs
export const CATEGORY_IDS = {
  TAEKWONDO: "aaaa0001-0000-0000-0000-000000000000",
  SWIMMING: "aaaa0002-0000-0000-0000-000000000000",
  FOOTBALL: "aaaa0003-0000-0000-0000-000000000000",
  RELIGIOUS: "aaaa0004-0000-0000-0000-000000000000",
  ACADEMIC: "aaaa0005-0000-0000-0000-000000000000",
  SPEEDCUBING: "aaaa0006-0000-0000-0000-000000000000",
  HOBBIES: "aaaa0007-0000-0000-0000-000000000000",
  ABACUS: "aaaa0008-0000-0000-0000-000000000000",
  SPEECH_DRAMA: "aaaa0009-0000-0000-0000-000000000000",
  KPOP_DANCE: "aaaa0010-0000-0000-0000-000000000000",
} as const;

// Activity category colors
export const CATEGORY_COLORS: Record<string, string> = {
  Taekwondo: "#EF4444",
  Swimming: "#3B82F6",
  Football: "#22C55E",
  "Religious Class": "#8B5CF6",
  "Academic Tuition": "#F59E0B",
  Speedcubing: "#F97316",
  "Other Hobbies": "#EC4899",
  Abacus: "#14B8A6",
  "English Speech & Drama": "#6366F1",
  "K-Pop Dance": "#D946EF",
};

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

// Who sends kids to class
export const SENDERS = ["Zeya", "Atiqah", "Both", "Grandparent", "Helper", "Self"] as const;

// Who pays expenses
export const PAYERS = [
  "Zeya",
  "Atiqah",
  "Zeya & Atiqah",
] as const;

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
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
