import type { AttendanceLog } from "@/lib/types";

const RECENT = 11;  // look at this many recent attended sessions…
const MIN = 3;      // …need at least this many to go on…
// …and pre-fill only an answer shared by more than half of them.

const names = (raw?: string | null) => (raw ?? "").split(",").map(s => s.trim()).filter(Boolean);
/** Order-free key, so "Zeya, Atiqah" and "Atiqah, Zeya" count as the same answer. */
const keyOf = (list: string[]) => [...list].sort().join("|");

function mostCommon(logs: AttendanceLog[], field: "sent_by" | "fetcher"): string[] {
  if (logs.length < MIN) return [];
  const counts = new Map<string, { n: number; list: string[] }>();
  for (const l of logs) {
    const list = names(l[field]);
    if (!list.length) continue;
    const k = keyOf(list);
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { n: 1, list }); // logs are newest first, so this keeps the latest spelling/order
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best && best.n > logs.length / 2 ? best.list : [];
}

/**
 * Who usually sends / fetches this child to this class: the answer shared by more than
 * half of the last 11 attended sessions — at the same start time when there are enough
 * of those (so Mon 6pm and Sat 9:30 of one class can differ), else at any time.
 * Returns empty lists when there's no clear pattern.
 */
export function usualPeople(
  logs: AttendanceLog[],
  q: { activityId: string; childId: string; startTime?: string | null }
): { sentBy: string[]; fetcher: string[] } {
  const attended = logs
    .filter(l => l.activity_id === q.activityId && l.child_id === q.childId && l.status === "attended")
    .sort((a, b) => b.date.localeCompare(a.date));
  const slot = q.startTime?.slice(0, 5);
  const sameSlot = slot ? attended.filter(l => l.start_time?.slice(0, 5) === slot) : [];
  const recent = (sameSlot.length >= MIN ? sameSlot : attended).slice(0, RECENT);
  return { sentBy: mostCommon(recent, "sent_by"), fetcher: mostCommon(recent, "fetcher") };
}
