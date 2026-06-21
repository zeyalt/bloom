import { formatDate, formatCurrency } from "./utils";
import type { AttendanceLog, Expense, Schedule, Activity } from "./types";

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportAttendanceCSV(logs: any[], filename = "attendance.csv") {
  const headers = [
    "Date",
    "Child",
    "Activity",
    "Status",
    "Start Time",
    "Duration (min)",
    "Instructor",
    "Level",
    "Lesson #",
    "Diary Notes",
  ];

  const rows = logs.map(log => [
    formatDate(log.date),
    log.child?.name || "",
    log.activity?.institution || "",
    log.status || "",
    log.start_time || "",
    log.duration_minutes || "",
    log.instructor_name || "",
    log.level || "",
    log.lesson_number || "",
    (log.diary_notes || "").replace(/"/g, '""'), // Escape quotes
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(filename, csv);
}

export function exportExpensesCSV(expenses: any[], filename = "expenses.csv") {
  const headers = [
    "Date",
    "Child",
    "Institution",
    "Category",
    "Description",
    "Amount",
    "Paid By",
    "Year",
  ];

  const rows = expenses.map(exp => [
    formatDate(exp.payment_date),
    exp.child?.name || "",
    exp.institution || "",
    exp.category?.name || "",
    (exp.description || "").replace(/"/g, '""'),
    formatCurrency(exp.amount),
    exp.paid_by || "",
    exp.year || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(filename, csv);
}

export function exportSchedulesCSV(schedules: any[], filename = "schedules.csv") {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const headers = [
    "Child",
    "Activity",
    "Day",
    "Start Time",
    "End Time",
    "Location",
    "Active",
  ];

  const rows = schedules.map(s => [
    s.activity?.child?.name || "",
    s.activity?.institution || "",
    dayNames[s.day_of_week] || "",
    s.start_time || "",
    s.end_time || "",
    s.location || "",
    s.is_active ? "Yes" : "No",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(filename, csv);
}
