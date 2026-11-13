"use client";

import { useState, type ReactNode } from "react";
import { Ban, Check, Pencil, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { cn, formatTime } from "@/lib/utils";
import type { AttendanceLog, AttendanceStatus, Child } from "@/lib/types";

const QUICK_LOG: { status: AttendanceStatus; label: string; icon: typeof Check; cls: string }[] = [
  { status: "attended", label: "Attended", icon: Check, cls: "text-[var(--stem)]" },
  { status: "absent", label: "Absent", icon: X, cls: "text-[var(--margin)]" },
  { status: "cancelled_by_provider", label: "Cancelled", icon: Ban, cls: "text-[var(--ink-soft)]" },
];

const STATUS_TONE: Record<string, string> = {
  attended: "text-[var(--stem)]",
  absent: "text-[var(--margin)]",
  cancelled_by_provider: "text-[var(--ink-soft)]",
};

/** What's needed to log a scheduled session that has no record yet. */
export interface SessionToLog {
  activity_id: string;
  child_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  instructor_name: string | null;
  location: string | null;
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 409) return; // already logged (another device): the refetch shows it
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save");
}

/**
 * One class on Home's day view. Not logged yet: Attended / Absent / Cancelled save in one
 * tap (sender and fetcher filled with whoever usually does it). Logged: the outcome, and a
 * pencil that opens the full form for sender, fetcher, reflection and the rest.
 */
export function ClassRow({
  time, title, child, sub, log, session, badge, highlight, guessPeople, onOpenActivity, onOpenForm, onChanged,
}: {
  time: string | null;
  title: string;
  child?: Child;
  sub?: string | null;
  log?: AttendanceLog;
  /** Present for a scheduled session, so it can be logged in one tap. */
  session?: SessionToLog;
  badge?: ReactNode;
  highlight?: boolean;
  guessPeople: () => { sentBy: string[]; fetcher: string[] };
  onOpenActivity?: () => void;
  onOpenForm: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function quickLog(status: AttendanceStatus) {
    if (!session) return;
    const people = status === "attended" ? guessPeople() : { sentBy: [], fetcher: [] };
    setBusy(true);
    setError("");
    try {
      await send("/api/attendance-logs", "POST", {
        ...session, status, lesson_type: "Normal",
        sent_by: people.sentBy.length ? people.sentBy.join(", ") : null,
        fetcher: people.fetcher.length ? people.fetcher.join(", ") : null,
        absence_reason: null, learned: null, diary_notes: null,
      });
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("px-3 py-3", highlight && "bg-[#e8f2eb]")}>
      <div className={cn("grid gap-x-3 items-start", log ? "grid-cols-[4.5rem_minmax(0,1fr)_3rem]" : "grid-cols-[4.5rem_minmax(0,1fr)]")}>
        <div className="flex flex-col items-start gap-1">
          <time className={cn("tabular-nums text-sm leading-6", highlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]")}>
            {time ? formatTime(time) : "—"}
          </time>
          {log ? (
            <span className={cn("text-xs leading-4 font-semibold", STATUS_TONE[log.status] ?? "text-[var(--ink-soft)]")}>
              {ATTENDANCE_STATUS_LABELS[log.status] ?? "Logged"}
            </span>
          ) : badge}
        </div>
        <div className="min-w-0">
          {onOpenActivity ? (
            <button type="button" onClick={onOpenActivity}
              className="relative block min-w-12 text-left text-base leading-6 font-semibold text-[var(--stem)] hover:underline cursor-pointer break-words before:absolute before:inset-x-0 before:-inset-y-3 before:content-['']">
              {title}
            </button>
          ) : (
            <span className="block text-base leading-6 font-semibold text-[var(--ink)] break-words">{title}</span>
          )}
          <div className="flex flex-wrap items-center gap-x-2 text-sm leading-5 text-[var(--ink-soft)]">
            {child && (
              <span className="inline-flex items-center gap-1 font-semibold" style={{ color: child.color_code }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} aria-hidden="true" />
                {child.name}
              </span>
            )}
            {sub && <span aria-hidden="true">·</span>}
            {sub && <span className="min-w-0 break-words">{sub}</span>}
          </div>
        </div>
        {log && (
          <div className="-mt-3 -mr-3">
            <IconButton icon={Pencil} label={`Edit attendance for ${title}`} onClick={onOpenForm} />
          </div>
        )}
      </div>

      {!log && session && (
        <div role="group" aria-label={`Log ${title}`} className="md:ml-[5.25rem] md:max-w-md grid grid-cols-3 gap-2 mt-2">
          {QUICK_LOG.map(q => (
            <button key={q.status} type="button" disabled={busy} onClick={() => quickLog(q.status)}
              className={cn(
                "relative inline-flex items-center justify-center gap-1 h-9 px-2 text-sm font-medium border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] active:scale-95 cursor-pointer disabled:opacity-50",
                "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
                q.cls
              )}>
              <q.icon size={16} aria-hidden="true" /> {q.label}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-[var(--margin)]">{error}</p>}
    </div>
  );
}
