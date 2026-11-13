"use client";

import { useRouter } from "next/navigation";
import {
  parseISO,
  startOfYear,
  endOfYear,
  differenceInCalendarDays,
  differenceInMonths,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { formatDate, harmonize } from "@/lib/utils";
import type { Activity, Child } from "@/lib/types";

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
  const router = useRouter();
  const today = new Date();
  const dated = activities.filter(a => a.start_date);

  const card = "bg-[var(--sheet)] rounded-[var(--radius-lg)] p-4 md:p-6";

  if (dated.length === 0) {
    return (
      <div className={card}>
        <h3 className="font-semibold text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>Timeline</h3>
        <p className="mt-4 text-sm text-[var(--ink-faint)]">No activities have a start date yet.</p>
      </div>
    );
  }

  // Domain across all dated activities, rounded out to whole years so the axis reads cleanly.
  const starts = dated.map(a => parseISO(a.start_date!.slice(0, 10)));
  const ends = dated.map(a => (a.end_date ? parseISO(a.end_date.slice(0, 10)) : today));
  const domainStart = startOfYear(minDate(starts));
  const domainEnd = endOfYear(maxDate([...ends, today]));
  const totalDays = Math.max(1, differenceInCalendarDays(domainEnd, domainStart));
  const pctOf = (d: Date) => (differenceInCalendarDays(d, domainStart) / totalDays) * 100;
  const startYear = domainStart.getFullYear();
  const endYear = domainEnd.getFullYear();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Group dated activities by child, then collapse same-named activities (e.g. restarted
  // after a break, or re-enrolled at the same institution) into one row with a bar per
  // stint — gaps between stints are expected and shown as empty space on the track.
  const groups = children
    .map(child => {
      const childItems = dated.filter(a => a.child_id === child.id);
      const byLabel = new Map<string, Activity[]>();
      for (const a of childItems) {
        const label = a.activity_name || a.institution || "Activity";
        const list = byLabel.get(label) || [];
        list.push(a);
        byLabel.set(label, list);
      }
      const rows = [...byLabel.entries()]
        .map(([label, stints]) => ({
          label,
          stints: stints.sort((a, b) => a.start_date!.localeCompare(b.start_date!)),
        }))
        .sort((a, b) => a.stints[0].start_date!.localeCompare(b.stints[0].start_date!));
      return { child, rows };
    })
    .filter(g => g.rows.length > 0);

  const yearAxis = (
    <div className="flex gap-1 mb-1">
      <div className="hidden sm:block w-36 shrink-0" />
      <div className="flex-1 flex">
        {years.map(y => (
          <span key={y} className="flex-1 text-xs font-medium text-[var(--ink-faint)] text-center">{y}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div className={card} data-chart>
      <div className="mb-4">
        <h3 className="font-semibold text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>Timeline</h3>
      </div>

      <div className="space-y-4">
        {groups.map(({ child, rows }) => (
          <div key={child.id}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: harmonize(child.color_code) }} />
              <span className="text-sm font-semibold text-[var(--ink)]">{child.name}</span>
            </div>

            {yearAxis}

            {/* Phones: label on its own line above a full-width bar. sm+: a 9rem label
                column, matching the Who Ferries Whom heatmap so both cards line up. */}
            <div className="space-y-2 sm:space-y-1">
              {rows.map(({ label, stints }) => (
                <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1 sm:h-7">
                  <span className="sm:w-44 shrink-0 text-xs leading-4 text-[var(--ink-soft)] break-words" title={label}>{label}</span>
                  <div className="relative w-full sm:flex-1 h-5 bg-[var(--bg-secondary)] rounded-sm overflow-hidden">
                    {stints.map(a => {
                      const start = parseISO(a.start_date!.slice(0, 10));
                      // `end_date` can be a planned/term end set while the activity is still
                      // active, so the authoritative "is this still going" signal is status,
                      // not whether an end date exists.
                      const ongoing = a.status === "active";
                      const end = ongoing ? today : a.end_date ? parseISO(a.end_date.slice(0, 10)) : today;
                      const left = pctOf(start);
                      const width = Math.max(1.5, pctOf(end) - left);
                      const tip = `${label}: ${formatDate(a.start_date!)} – ${ongoing ? "ongoing" : a.end_date ? formatDate(a.end_date) : "ongoing"} · ${formatDuration(start, end)}`;
                      return (
                        <button
                          key={a.id}
                          onClick={() => router.push(`/activity/${a.id}`)}
                          title={tip}
                          className="absolute inset-y-0 rounded-sm cursor-pointer"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: harmonize(child.color_code), opacity: ongoing ? 1 : 0.3 }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
