"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { formatTime } from "@/lib/utils";
import { exportSchedulesCSV } from "@/lib/export-csv";
import type { Schedule, Activity, ActivityCategory, Child } from "@/lib/types";

interface ScheduleWithDetails extends Schedule {
  activity?: Activity & { child?: Child; category?: ActivityCategory };
}

export default function SchedulePage() {
  const [schedulesByChild, setSchedulesByChild] = useState<Map<string, ScheduleWithDetails[]>>(new Map());
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [childRes, schedRes] = await Promise.all([
          fetch("/api/children").then(r => r.json()),
          fetch("/api/schedules").then(r => r.json()),
        ]);
        setChildren(Array.isArray(childRes) ? childRes : []);

        if (Array.isArray(schedRes)) {
          const grouped = new Map<string, ScheduleWithDetails[]>();
          for (const child of (Array.isArray(childRes) ? childRes : [])) {
            grouped.set(child.id, schedRes.filter((s: any) => s.activity?.child_id === child.id));
          }
          setSchedulesByChild(grouped);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sortedDays = DAYS_OF_WEEK;

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Weekly Schedule" subtitle="Recurring activities for each child" />

      {!loading && (
        <div className="px-5 md:px-8 pt-4 md:pt-6">
          <div className="bg-white rounded-[10px] p-4 md:p-5 mb-8 border border-[var(--border)] flex justify-end gap-2">
            <Button variant="secondary" onClick={() => exportSchedulesCSV(Array.from(schedulesByChild.values()).flat(), "schedules.csv")} size="md">
              <Download size={16} /> Export
            </Button>
          </div>
        </div>
      )}

      <div className="px-5 md:px-8 pb-8 space-y-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          children.map(child => {
            const childSchedules = schedulesByChild.get(child.id) || [];
            const activeSchedules = childSchedules.filter(s => s.is_active);

            if (activeSchedules.length === 0) {
              return (
                <div key={child.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: child.color_code }} />
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      {child.avatar_emoji} {child.name}
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">No active schedules</span>
                  </div>
                </div>
              );
            }

            // Organize by day
            const schedByDay = new Map<number, ScheduleWithDetails[]>();
            sortedDays.forEach(d => schedByDay.set(d.value, []));
            activeSchedules.forEach(s => {
              const arr = schedByDay.get(s.day_of_week) || [];
              arr.push(s);
              schedByDay.set(s.day_of_week, arr);
            });

            return (
              <div key={child.id}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: child.color_code }} />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {child.avatar_emoji} {child.name}
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">{activeSchedules.length} slots</span>
                </div>

                {/* Week grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                  {sortedDays.map(day => {
                    const dayScheds = schedByDay.get(day.value) || [];
                    return (
                      <div
                        key={day.value}
                        className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-card)] min-h-32"
                      >
                        {/* Day header */}
                        <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                          {day.fullLabel}
                        </div>

                        {/* Slots */}
                        {dayScheds.length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)]">—</p>
                        ) : (
                          <div className="space-y-2">
                            {dayScheds.map(s => {
                              const category = s.activity?.category;
                              return (
                                <div
                                  key={s.id}
                                  className="p-2 rounded-lg border-l-2 transition-all"
                                  style={{
                                    backgroundColor:
                                      category?.color_code
                                        ? `${category.color_code}08`
                                        : "var(--bg-secondary)",
                                    borderLeftColor: category?.color_code ?? "#ccc",
                                  }}
                                >
                                  <div className="text-xs font-medium text-[var(--text-primary)]">
                                    {formatTime(s.start_time)}
                                    {s.end_time && (
                                      <span className="text-[var(--text-muted)]">
                                        {" "}–{" "}
                                        {formatTime(s.end_time)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                                    {s.activity?.institution}
                                  </div>
                                  {s.activity?.instructor_name && (
                                    <div className="text-xs text-[var(--text-muted)] truncate">
                                      {s.activity.instructor_name}
                                    </div>
                                  )}
                                  {s.location && (
                                    <div className="text-xs text-[var(--text-muted)] mt-1">
                                      @ {s.location}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
