"use client";

import {
  parseISO,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  differenceInCalendarDays,
  differenceInMonths,
  format,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { formatDate } from "@/lib/utils";
import type { Activity, Child } from "@/lib/types";

const MONTH_W = 64;   // px per month column
const LABEL_W = 168;  // sticky left label column
const ROW_H = 34;     // activity lane height
const BAR_H = 18;
const DISPLAY_FONT = "var(--font-display)";

interface Props {
  activities: Activity[];
  children: Child[];
}

function formatDuration(start: Date, end: Date): string {
  const months = Math.max(0, differenceInMonths(end, start));
  if (months < 1) {
    const d = Math.max(1, differenceInCalendarDays(end, start));
    return `${d}d`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y}y` : null, m ? `${m}m` : null].filter(Boolean).join(" ");
}

export function EngagementTimeline({ activities, children }: Props) {
  const today = new Date();
  const dated = activities.filter(a => a.start_date);
  const missing = activities.length - dated.length;

  const card = "rounded-2xl border border-[var(--border)]/70 bg-[var(--bg-card)] p-5 md:p-6 shadow-sm";

  if (dated.length === 0) {
    return (
      <div className={card}>
        <h3 className="text-base font-semibold text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>Engagement Timeline</h3>
        <p className="mt-4 text-sm text-[var(--text-muted)]">No activities have a start date yet.</p>
      </div>
    );
  }

  // Domain across all dated activities
  const starts = dated.map(a => parseISO(a.start_date!.slice(0, 10)));
  const ends = dated.map(a => (a.end_date ? parseISO(a.end_date.slice(0, 10)) : today));
  const domainStart = startOfMonth(minDate(starts));
  const domainEnd = endOfMonth(maxDate([...ends, today]));
  const months = eachMonthOfInterval({ start: domainStart, end: domainEnd });
  const totalWidth = months.length * MONTH_W;
  const totalDays = Math.max(1, differenceInCalendarDays(domainEnd, domainStart));
  const pxPerDay = totalWidth / totalDays;
  const offsetPx = (d: Date) => differenceInCalendarDays(d, domainStart) * pxPerDay;
  const todayOffset = Math.min(Math.max(offsetPx(today), 0), totalWidth);

  const gridGradient =
    `repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${MONTH_W}px)`;

  // Group dated activities by child (in children order), sorted by start date
  const groups = children
    .map(child => ({
      child,
      items: dated
        .filter(a => a.child_id === child.id)
        .sort((a, b) => a.start_date!.localeCompare(b.start_date!)),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className={card}>
      <div className="mb-1">
        <h3 className="text-base font-semibold text-[var(--text-primary)]" style={{ fontFamily: DISPLAY_FONT }}>Engagement Timeline</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Full history — independent of the date filter above</p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ width: LABEL_W + totalWidth }}>
          {/* Month / year header */}
          <div className="flex">
            <div className="sticky left-0 z-20 bg-[var(--bg-card)] shrink-0 flex items-end pb-1" style={{ width: LABEL_W }}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Activity</span>
            </div>
            <div className="relative shrink-0" style={{ width: totalWidth }}>
              <div className="flex">
                {months.map((m, i) => (
                  <div key={i} className="shrink-0 border-l border-[var(--border)]/50 pl-1" style={{ width: MONTH_W }}>
                    <div className="h-3 text-[10px] text-[var(--text-secondary)] font-medium">
                      {(m.getMonth() === 0 || i === 0) ? format(m, "yyyy") : ""}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{format(m, "MMM")}</div>
                  </div>
                ))}
              </div>
              {/* Today pill */}
              <div className="absolute -top-0.5" style={{ left: todayOffset, transform: "translateX(-50%)" }}>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--text-primary)] text-white whitespace-nowrap">Today</span>
              </div>
            </div>
          </div>

          {/* Groups */}
          {groups.map(({ child, items }) => (
            <div key={child.id}>
              {/* Child group header */}
              <div className="flex">
                <div className="sticky left-0 z-20 bg-[var(--bg-card)] shrink-0 flex items-center gap-2 py-2" style={{ width: LABEL_W }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{child.name}</span>
                </div>
                <div className="shrink-0" style={{ width: totalWidth }} />
              </div>

              {/* Activity lanes */}
              {items.map(a => {
                const start = parseISO(a.start_date!.slice(0, 10));
                const ongoing = !a.end_date;
                const end = a.end_date ? parseISO(a.end_date.slice(0, 10)) : today;
                const left = offsetPx(start);
                const width = Math.max(6, offsetPx(end) - left);
                const title = a.activity_name || a.institution || "Activity";
                const dimmed = a.status === "dropped" || a.status === "completed";
                const tip = `${title}: ${formatDate(a.start_date!)} – ${a.end_date ? formatDate(a.end_date) : "ongoing"} · ${formatDuration(start, end)}`;
                return (
                  <div key={a.id} className="flex">
                    <div className="sticky left-0 z-10 bg-[var(--bg-card)] shrink-0 pr-3" style={{ width: LABEL_W, height: ROW_H }}>
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate leading-tight pt-1">{title}</div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-tight">
                        {formatDuration(start, end)}{ongoing ? " · ongoing" : ""}{dimmed ? ` · ${a.status}` : ""}
                      </div>
                    </div>
                    <div className="relative shrink-0" style={{ width: totalWidth, height: ROW_H, backgroundImage: gridGradient }}>
                      {/* today line */}
                      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: todayOffset, width: 1, backgroundColor: "var(--text-primary)", opacity: 0.18 }} />
                      {/* engagement bar */}
                      <div
                        title={tip}
                        className="absolute rounded-full"
                        style={{
                          left,
                          width,
                          top: (ROW_H - BAR_H) / 2,
                          height: BAR_H,
                          backgroundColor: child.color_code,
                          opacity: dimmed ? 0.45 : ongoing ? 0.85 : 1,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {missing > 0 && (
        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          {missing} {missing === 1 ? "activity" : "activities"} without a start date {missing === 1 ? "isn't" : "aren't"} shown.
        </p>
      )}
    </div>
  );
}
