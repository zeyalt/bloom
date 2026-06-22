"use client";

import { useEffect, useState } from "react";
import { Receipt, TrendingUp, Calendar, Activity } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/StatCard";
import { ChildAvatar } from "@/components/ui/ChildAvatar";
import { ActivityCard } from "@/components/ui/ActivityCard";
import { formatCurrency, formatDate, formatTime, getCurrentYear } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { Schedule, Activity as ActivityType, ActivityCategory, Child, AttendanceLog, Expense } from "@/lib/types";

interface ScheduleWithDetails extends Schedule {
  activity?: ActivityType & { child?: Child; category?: ActivityCategory };
}

interface LogWithDetails extends AttendanceLog {
  activity?: ActivityType;
  child?: Child;
}

interface ExpenseWithDetails extends Expense {
  child?: Child;
  category?: ActivityCategory;
}

export default function DashboardPage() {
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [logs, setLogs] = useState<LogWithDetails[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [schedRes, logsRes, expRes, childRes, actRes] = await Promise.all([
          fetch("/api/schedules").then(r => r.json()),
          fetch("/api/attendance-logs?limit=20").then(r => r.json()),
          fetch(`/api/expenses?year=${getCurrentYear()}&limit=100`).then(r => r.json()),
          fetch("/api/children").then(r => r.json()),
          fetch("/api/activities").then(r => r.json()),
        ]);
        setSchedules(Array.isArray(schedRes) ? schedRes : []);
        setLogs(logsRes.data || []);
        setExpenses(expRes.data || []);
        setChildren(Array.isArray(childRes) ? childRes : []);
        setActivities(Array.isArray(actRes) ? actRes : []);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const activeSchedules = schedules.filter(s => s.is_active);
  const activeActivities = activities.filter(a => a.status === "active");
  const yearTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthLogs = logs.filter(
    l => new Date(l.date).getMonth() === new Date().getMonth()
  );
  const monthAttended = monthLogs.filter(l => l.status === "attended").length;

  const sortedDays = DAYS_OF_WEEK;
  const schedByDay = new Map<number, ScheduleWithDetails[]>();
  sortedDays.forEach(d => schedByDay.set(d.value, []));
  activeSchedules.forEach(s => {
    const arr = schedByDay.get(s.day_of_week) || [];
    arr.push(s);
    schedByDay.set(s.day_of_week, arr);
  });

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Dashboard" subtitle="Activity overview & upcoming schedule" />

      <div className="px-4 md:px-8 pb-8 pt-4 md:pt-6">
        {loading ? (
          <div className="space-y-4 mt-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 mt-6">
              <StatCard
                label="Expenses (YTD)"
                value={formatCurrency(yearTotal)}
                icon={<Receipt size={20} />}
                color="orange"
              />
              <StatCard
                label="Active Activities"
                value={activeActivities.length}
                icon={<Activity size={20} />}
                color="green"
              />
              <StatCard
                label="Sessions (This Month)"
                value={monthAttended}
                icon={<TrendingUp size={20} />}
                color="blue"
              />
              <StatCard
                label="Weekly Slots"
                value={activeSchedules.length}
                icon={<Calendar size={20} />}
                color="warning"
              />
            </div>

            {/* Weekly preview */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">This Week</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {sortedDays.map(day => {
                  const dayScheds = schedByDay.get(day.value) || [];
                  return (
                    <div
                      key={day.value}
                      className="border border-[var(--border)] rounded-[10px] p-3 bg-white hover:shadow-md transition-all duration-200 min-h-36"
                    >
                      <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                        {day.label}
                      </div>
                      {dayScheds.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">No sessions</p>
                      ) : (
                        <div className="space-y-3">
                          {dayScheds.slice(0, 2).map(s => (
                            <div
                              key={s.id}
                              className="p-2.5 rounded-lg border-l-3 bg-[var(--bg-secondary)] text-xs"
                              style={{
                                borderLeftColor: s.activity?.category?.color_code ?? "currentColor",
                              }}
                            >
                              <div className="font-semibold text-[var(--text-primary)]">
                                {formatTime(s.start_time)}
                              </div>
                              <div className="text-[var(--text-secondary)] truncate text-xs mt-1">
                                {s.activity?.institution}
                              </div>
                            </div>
                          ))}
                          {dayScheds.length > 2 && (
                            <div className="text-xs font-medium text-[var(--accent-primary)] px-2">
                              +{dayScheds.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent sessions */}
            {logs.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Recent Sessions</h2>
                <div className="space-y-3">
                  {logs.slice(0, 6).map(log => (
                    log.child && (
                      <ActivityCard
                        key={log.id}
                        childName={log.child.name}
                        childEmoji={log.child.avatar_emoji}
                        childAvatarKey={log.child.avatar_key}
                        childColor={log.child.color_code}
                        institution={log.activity?.institution || "Unknown"}
                        category={log.activity?.category?.name || "Activity"}
                        categoryIcon={log.activity?.category?.icon}
                        date={formatDate(log.date)}
                        duration={log.duration_minutes ? `${log.duration_minutes} mins` : undefined}
                        status={
                          log.status === "attended"
                            ? "attended"
                            : log.status === "absent"
                              ? "absent"
                              : "pending"
                        }
                        notes={log.diary_notes}
                      />
                    )
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
