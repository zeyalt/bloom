import type { AttendanceLog, Expense } from "@/lib/types";

// A session "happened" unless the child was absent or the provider cancelled it.
const happened = (status: string) => status !== "absent" && status !== "cancelled_by_provider";

function minutes(l: Pick<AttendanceLog, "duration_minutes" | "start_time" | "end_time">): number {
  if (l.duration_minutes && l.duration_minutes > 0) return l.duration_minutes;
  if (l.start_time && l.end_time) {
    const [sh, sm] = l.start_time.split(":").map(Number);
    const [eh, em] = l.end_time.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : 0;
  }
  return 0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface CostPerHour {
  perHour: number;
  perLesson: number;
  sessionMinutes: number;
  /** The payment the price came from. */
  payment: Expense;
}

/**
 * An activity's hourly price: its latest Lesson-type payment (amount ÷ lessons it
 * covers) over the median length of its attended sessions. Pass expenses and logs
 * already narrowed to one activity for one child (all its stints).
 *
 * Returns null when there's no Lesson payment with a lesson count, or no session
 * with a known length — a rate built from all spend over all hours would mix in
 * grading/registration fees and penalise absences, so we don't fall back to that.
 */
export function costPerHour(expenses: Expense[], logs: AttendanceLog[]): CostPerHour | null {
  const latest = expenses
    .filter(e => (e.expense_type || "Lesson") === "Lesson")
    .reduce<Expense | null>((best, e) => (!best || e.payment_date > best.payment_date ? e : best), null);
  if (!latest?.num_lessons || latest.num_lessons <= 0) return null;

  const lengths = logs.filter(l => happened(l.status)).map(minutes).filter(m => m > 0);
  if (lengths.length === 0) return null;

  const perLesson = latest.amount / latest.num_lessons;
  const sessionMinutes = median(lengths);
  return { perHour: perLesson / (sessionMinutes / 60), perLesson, sessionMinutes, payment: latest };
}
