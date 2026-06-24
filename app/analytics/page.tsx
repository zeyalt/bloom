"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Receipt, TrendingUp, Calendar, Activity as ActivityIcon } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrency, getCurrentYear } from "@/lib/utils";
import type { Expense, AttendanceLog, Activity, ActivityCategory, Child, Schedule } from "@/lib/types";

interface ExpenseWithDetails extends Expense {
  child?: Child;
  category?: ActivityCategory;
}

interface LogWithDetails extends AttendanceLog {
  activity?: Activity;
  child?: Child;
}

export default function AnalyticsPage() {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [logs, setLogs] = useState<LogWithDetails[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [expRes, logsRes, actRes, schedRes] = await Promise.all([
          fetch("/api/expenses?limit=500").then(r => r.json()),
          fetch("/api/attendance-logs?limit=500").then(r => r.json()),
          fetch("/api/activities").then(r => r.json()),
          fetch("/api/schedules").then(r => r.json()),
        ]);
        setExpenses(expRes.data || []);
        setLogs(logsRes.data || []);
        setActivities(Array.isArray(actRes) ? actRes : []);
        setSchedules(Array.isArray(schedRes) ? schedRes : []);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // High-level metrics (moved from Home)
  const yearTotal = expenses
    .filter(e => new Date(e.payment_date).getFullYear() === getCurrentYear())
    .reduce((sum, e) => sum + e.amount, 0);
  const activeActivities = activities.filter(a => a.status === "active").length;
  const now = new Date();
  const monthAttended = logs.filter(
    l => l.status === "attended" && new Date(l.date).getMonth() === now.getMonth() && new Date(l.date).getFullYear() === now.getFullYear()
  ).length;
  const weeklySlots = schedules.filter(s => s.is_active).length;

  // Monthly spending chart
  const monthlyData = expenses.reduce(
    (acc, exp) => {
      const date = new Date(exp.payment_date);
      const month = date.toLocaleString("default", { month: "short", year: "numeric" });
      const existing = acc.find(m => m.month === month);
      if (existing) {
        existing.amount += exp.amount;
      } else {
        acc.push({ month, amount: exp.amount });
      }
      return acc;
    },
    [] as { month: string; amount: number }[]
  ).slice(-12);

  // Expense by category
  const categoryData = Object.entries(
    expenses.reduce(
      (acc, exp) => {
        const cat = exp.category?.name || "Uncategorized";
        acc[cat] = (acc[cat] || 0) + exp.amount;
        return acc;
      },
      {} as Record<string, number>
    )
  ).map(([name, amount]) => ({ name, value: amount }));

  // Activity participation (sessions per activity)
  const activityData = Object.entries(
    logs.reduce(
      (acc, log) => {
        const act = log.activity?.institution || "Unknown";
        acc[act] = (acc[act] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  )
    .map(([name, count]) => ({ name, sessions: count }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  // Attendance by child
  const childAttendance = Object.entries(
    logs.reduce(
      (acc, log) => {
        const child = log.child?.name || "Unknown";
        if (!acc[child]) {
          acc[child] = { attended: 0, absent: 0, other: 0 };
        }
        if (log.status === "attended") {
          acc[child].attended++;
        } else if (log.status === "absent") {
          acc[child].absent++;
        } else {
          acc[child].other++;
        }
        return acc;
      },
      {} as Record<string, { attended: number; absent: number; other: number }>
    )
  ).map(([child, data]) => ({
    child,
    attended: data.attended,
    absent: data.absent,
    other: data.other,
  }));

  const COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#F97316", "#EC4899", "#14B8A6", "#6366F1", "#D946EF"];

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto w-full">
        <Header title="Analytics" subtitle="Spend and attendance insights" />
        <div className="px-5 md:px-8 space-y-8 pb-8 pt-4 md:pt-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-96 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Analytics" subtitle="Spend and attendance insights" />

      <div className="px-5 md:px-8 space-y-8 pb-8 pt-4 md:pt-6">
        {/* High-level metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Expenses (YTD)" value={formatCurrency(yearTotal)} icon={<Receipt size={20} />} color="orange" />
          <StatCard label="Active Activities" value={activeActivities} icon={<ActivityIcon size={20} />} color="green" />
          <StatCard label="Sessions (This Month)" value={monthAttended} icon={<TrendingUp size={20} />} color="blue" />
          <StatCard label="Weekly Slots" value={weeklySlots} icon={<Calendar size={20} />} color="warning" />
        </div>

        {/* Monthly spending trend */}
        {monthlyData.length > 0 && (
          <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--bg-card)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Monthly Spending Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={{ fill: "#2563EB" }}
                  name="Spending"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Expense by category */}
          {categoryData.length > 0 && (
            <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--bg-card)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Expense by Category
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) =>
                      `${name}: ${formatCurrency(value)}`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Attendance by child */}
          {childAttendance.length > 0 && (
            <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--bg-card)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Attendance by Child
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={childAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="child" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="attended" fill="#16A34A" name="Attended" />
                  <Bar dataKey="absent" fill="#DC2626" name="Absent" />
                  <Bar dataKey="other" fill="#6B7280" name="Other" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top activities by participation */}
        {activityData.length > 0 && (
          <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--bg-card)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Top Activities by Sessions
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={activityData}
                layout="vertical"
                margin={{ left: 200, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--text-secondary)" />
                <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" width={190} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Bar dataKey="sessions" fill="#3B82F6" name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
