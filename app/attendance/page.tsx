"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Download, Pencil, Settings, ChevronUp, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { exportAttendanceCSV } from "@/lib/export-csv";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { useChildren, useActivities, useAttendanceLogs, useSchedules } from "@/lib/api-hooks";
import type { AttendanceLog, Activity, ActivityCategory, Child, Schedule } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const [filterChild, setFilterChild] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "dateTime", dir: "desc" });
  const [visibleColumns, setVisibleColumns] = useState({
    dateTime: true,
    activity: true,
    institution: true,
    level: true,
    coach: true,
    lessonType: true,
    sentBy: true,
    absenceReason: true,
    status: true,
  });

  // Persist the user's chosen columns across visits.
  const columnsLoaded = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("attendance-visible-columns");
      if (saved) setVisibleColumns(v => ({ ...v, ...JSON.parse(saved) }));
    } catch { /* ignore */ }
    columnsLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!columnsLoaded.current) return;
    try {
      localStorage.setItem("attendance-visible-columns", JSON.stringify(visibleColumns));
    } catch { /* ignore */ }
  }, [visibleColumns]);

  // Fetch data using React Query hooks
  const { data: childrenData = [] } = useChildren();
  const { data: activitiesData = [] } = useActivities();
  const { data: schedulesData = [] } = useSchedules();
  const { data: logsData = [], isLoading } = useAttendanceLogs({
    limit: 200,
    childId: filterChild || undefined,
    activityId: filterActivity || undefined,
  });

  const children = childrenData;
  const activities = activitiesData;
  const schedules = schedulesData;
  const logs = logsData;
  const loading = isLoading;

  // Find the recurring schedule that matches a log's activity + weekday,
  // used to back-fill start/end time and location for older records.
  function matchingSchedule(log: LogWithDetails): Schedule | undefined {
    const iso = log.date.slice(0, 10);
    const [y, m, d] = iso.split("-").map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    return schedules.find(
      s => s.activity_id === log.activity_id && s.day_of_week === dayOfWeek
    );
  }

  async function fetchAll() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
    await queryClient.invalidateQueries({ queryKey: ["activities"] });
    await queryClient.invalidateQueries({ queryKey: ["children"] });
  }

  function openAdd() {
    setPrefill({
      date: new Date().toISOString().split("T")[0],
      status: "attended",
      child_id: children[0]?.id,
    });
    setModalOpen(true);
  }

  function openEdit(log: LogWithDetails) {
    // Back-fill time/location from the recurring schedule when the log itself
    // is missing them (e.g. older records saved before end_time persisted).
    const sched = matchingSchedule(log);
    setPrefill({
      id: log.id,
      activity_id: log.activity_id,
      child_id: log.child_id,
      date: log.date.slice(0, 10),
      status: log.status,
      start_time: log.start_time ?? sched?.start_time ?? null,
      end_time: log.end_time ?? sched?.end_time ?? null,
      sent_by: log.sent_by,
      instructor_name: log.instructor_name,
      lesson_type: log.lesson_type,
      location: log.location ?? sched?.location ?? null,
      absence_reason: log.absence_reason,
    });
    setModalOpen(true);
  }

  // Filter logs by selected child
  const filteredLogs = filterChild
    ? logs.filter(l => l.child_id === filterChild)
    : logs.filter(l => filterActivity ? l.activity_id === filterActivity : true);

  // Sortable value for each column key
  function sortValue(log: LogWithDetails, key: string): string {
    switch (key) {
      case "dateTime": return `${log.date.slice(0, 10)} ${log.start_time ?? ""}`;
      case "activity": return log.activity?.activity_name ?? "";
      case "institution": return log.activity?.institution ?? "";
      case "level": return log.activity?.level ?? "";
      case "coach": return log.instructor_name ?? "";
      case "lessonType": return log.lesson_type ?? "";
      case "sentBy": return log.sent_by ?? "";
      case "absenceReason": return (log.status === "absent" || log.status === "cancelled_by_provider") ? (log.absence_reason ?? "") : "";
      case "status": return ATTENDANCE_STATUS_LABELS[log.status] ?? log.status;
      default: return "";
    }
  }

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    // Push empty values to the bottom regardless of direction
    if (!av && bv) return 1;
    if (av && !bv) return -1;
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
    return sort.dir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: string) {
    setSort(s => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "dateTime" ? "desc" : "asc" });
  }

  const SortIcon = ({ col }: { col: string }) =>
    sort.key !== col ? null : sort.dir === "asc"
      ? <ChevronUp size={12} className="inline ml-1 -mt-0.5" />
      : <ChevronDown size={12} className="inline ml-1 -mt-0.5" />;

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <Header title="Attendance" subtitle="All sessions logged" />

      <div className="px-5 md:px-8 pt-4 md:pt-6">
        {/* Child filter pills + actions */}
        <div className="flex flex-wrap gap-2 mb-6 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterChild("")}
              className={cn(
                "px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
                !filterChild ? "bg-[var(--text-primary)] text-white border-transparent" : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
              )}
            >
              All
            </button>
            {children.map(child => {
              const active = filterChild === child.id;
              return (
                <button
                  key={child.id}
                  onClick={() => setFilterChild(child.id)}
                  style={active ? { backgroundColor: child.color_code } : undefined}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
                    active ? "text-white border-transparent" : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
                  )}
                >
                  <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={20} />
                  {child.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors" title="Customize columns">
              <Settings size={16} />
            </button>
            <Button variant="secondary" size="sm" onClick={() => exportAttendanceCSV(filteredLogs, `attendance-${new Date().toISOString().split('T')[0]}.csv`)}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" size="sm" onClick={openAdd}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>

        {/* Column picker */}
        {showColumnPicker && (
          <div className="mb-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-secondary)]">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3">Visible Columns</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: "dateTime", label: "Date & Time" },
                { key: "activity", label: "Activity" },
                { key: "institution", label: "Institution" },
                { key: "level", label: "Level" },
                { key: "coach", label: "Coach" },
                { key: "lessonType", label: "Lesson Type" },
                { key: "sentBy", label: "Sent By" },
                { key: "absenceReason", label: "Absence Reason" },
                { key: "status", label: "Status" },
              ].map(col => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key as keyof typeof visibleColumns]}
                    onChange={e => setVisibleColumns(v => ({ ...v, [col.key]: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-xs text-[var(--text-primary)]">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Activity filter dropdown (secondary) */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Activity (optional)</label>
          <select
            value={filterActivity}
            onChange={e => setFilterActivity(e.target.value)}
            className="w-full max-w-sm px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
          >
            <option value="">All activities</option>
            {activities.map(a => (
              <option key={a.id} value={a.id}>
                {[a.activity_name, a.institution].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No attendance records</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase tracking-wide">
                  {visibleColumns.dateTime && <th onClick={() => toggleSort("dateTime")} className="px-2 py-2 text-left font-semibold min-w-[110px] cursor-pointer select-none hover:text-[var(--text-primary)]">Date & Time<SortIcon col="dateTime" /></th>}
                  {visibleColumns.activity && <th onClick={() => toggleSort("activity")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Activity<SortIcon col="activity" /></th>}
                  {visibleColumns.institution && <th onClick={() => toggleSort("institution")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Institution<SortIcon col="institution" /></th>}
                  {visibleColumns.level && <th onClick={() => toggleSort("level")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Level<SortIcon col="level" /></th>}
                  {visibleColumns.coach && <th onClick={() => toggleSort("coach")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Coach<SortIcon col="coach" /></th>}
                  {visibleColumns.lessonType && <th onClick={() => toggleSort("lessonType")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Lesson Type<SortIcon col="lessonType" /></th>}
                  {visibleColumns.sentBy && <th onClick={() => toggleSort("sentBy")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Sent By<SortIcon col="sentBy" /></th>}
                  {visibleColumns.absenceReason && <th onClick={() => toggleSort("absenceReason")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Absence Reason<SortIcon col="absenceReason" /></th>}
                  {visibleColumns.status && <th onClick={() => toggleSort("status")} className="px-2 py-2 text-center font-semibold cursor-pointer select-none hover:text-[var(--text-primary)]">Status<SortIcon col="status" /></th>}
                  <th className="px-2 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map(log => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    {visibleColumns.dateTime && (
                      <td className="px-2 py-2 text-[var(--text-secondary)] min-w-[110px]">
                        <div>{formatDate(log.date)}</div>
                        {log.start_time && <div className="text-xs text-[var(--text-muted)]">{formatTime(log.start_time)}</div>}
                      </td>
                    )}
                    {visibleColumns.activity && <td className="px-2 py-2 text-[var(--text-primary)]">{log.activity?.activity_name || "—"}</td>}
                    {visibleColumns.institution && <td className="px-2 py-2 text-[var(--text-secondary)]">{log.activity?.institution || "—"}</td>}
                    {visibleColumns.level && <td className="px-2 py-2 text-[var(--text-secondary)]">{log.activity?.level || "—"}</td>}
                    {visibleColumns.coach && <td className="px-2 py-2 text-[var(--text-secondary)]">{log.instructor_name || "—"}</td>}
                    {visibleColumns.lessonType && <td className="px-2 py-2 text-[var(--text-secondary)]">{log.lesson_type || "—"}</td>}
                    {visibleColumns.sentBy && <td className="px-2 py-2 text-[var(--text-secondary)]">{log.sent_by || "—"}</td>}
                    {visibleColumns.absenceReason && <td className="px-2 py-2 text-[var(--text-secondary)]">{(log.status === "absent" || log.status === "cancelled_by_provider") ? log.absence_reason || "—" : "—"}</td>}
                    {visibleColumns.status && (
                      <td className="px-2 py-2 text-center">
                        <Badge
                          label={ATTENDANCE_STATUS_LABELS[log.status]}
                          variant={log.status === "attended" ? "success" : log.status === "absent" ? "danger" : "default"}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => openEdit(log)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] transition-colors"
                        title="Edit attendance"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AttendanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          children={children}
          activities={activities}
          prefill={prefill}
          onSaved={fetchAll}
          title={prefill?.id ? "Edit Attendance" : "Add Attendance"}
        />
      </div>
    </div>
  );
}
