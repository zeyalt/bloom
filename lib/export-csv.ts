import { formatDate, formatCurrency } from "./utils";
import { getReflectionText } from "./reflection";

function downloadCSV(filename: string, csv: string) {
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
    "Reflection",
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
    getReflectionText(log.learned, log.diary_notes).replace(/"/g, '""'),
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
