"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Trash2, Columns3, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Page, Utilities, PageBody } from "@/components/layout/Page";
import { Fab } from "@/components/ui/Fab";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MultiSelect } from "@/components/ui/FilterDropdown";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatTime, getCurrentYear } from "@/lib/utils";
import { exportAttendanceCSV } from "@/lib/export-csv";
import { ATTENDANCE_STATUS_LABELS, normalizeLessonType } from "@/lib/constants";
import { getReflectionText, hasReflection } from "@/lib/reflection";
import { useChildren, useActivities, useAttendanceLogs, useSchedules } from "@/lib/api-hooks";
import type { AttendanceLog, Activity, ActivityCategory, Child, Schedule } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}

const PAGE_SIZE = 30;

const activityLabel = (a: Activity) => a.activity_name || a.institution;

// Sortable value for each column key. `child` and `activity` come from the
// joins `useAttendanceLogs` attaches, so no lookup table is needed here.
function sortValue(log: LogWithDetails, key: string): string {
  switch (key) {
    case "dateTime": return `${log.date.slice(0, 10)} ${log.start_time ?? ""}`;
    case "child": return log.child?.name ?? "";
    case "activity": return log.activity?.activity_name ?? "";
    case "institution": return log.activity?.institution ?? "";
    case "level": return log.level ?? log.activity?.level ?? "";
    case "coach": return log.instructor_name ?? "";
    case "lessonType": return normalizeLessonType(log.lesson_type) ?? "";
    case "sentBy": return log.sent_by ?? "";
    case "fetcher": return log.fetcher ?? "";
    case "absenceReason": return (log.status === "absent" || log.status === "cancelled_by_provider") ? (log.absence_reason ?? "") : "";
    case "status": return ATTENDANCE_STATUS_LABELS[log.status] ?? log.status;
    default: return "";
  }
}

export default function AttendancePage({ embedded = false, tabs }: { embedded?: boolean; tabs?: React.ReactNode } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<LogWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const childrenInit = useRef(false);
  // Every filter/sort change returns the user to the first page.
  const toggleChild = (id: string) => {
    setSelectedChildren(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    setPage(1);
  };
  // Activity + Institution are one filter: a composite "name|institution" key,
  // since the same activity name can span institutions over time (e.g. a
  // child's "Soccer" moving from one academy to another).
  const [filterActivityKeys, setFilterActivityKeys] = useState<string[]>([]);
  const [filterYears, setFilterYears] = useState<string[]>([String(getCurrentYear())]);
  const toggleFilterActivityKey = (key: string) => {
    setFilterActivityKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    setPage(1);
  };
  const toggleFilterYear = (year: string) => {
    setFilterYears(prev => (prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]));
    setPage(1);
  };
  const [page, setPage] = useState(1);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "dateTime", dir: "desc" });
  // Read once at init (not in an effect) so there's no window where a save
  // effect can fire with the still-default state and clobber what was saved.
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaults = {
      dateTime: true,
      child: true,
      activity: true,
      institution: true,
      level: true,
      coach: true,
      lessonType: true,
      sentBy: true,
      fetcher: true,
      notes: true,
      absenceReason: true,
      status: true,
    };
    if (typeof window === "undefined") return defaults;
    try {
      const saved = localStorage.getItem("attendance-visible-columns");
      return saved ? { ...defaults, ...(JSON.parse(saved) as Partial<typeof defaults>) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Persist the user's chosen columns across visits.
  useEffect(() => {
    try {
      localStorage.setItem("attendance-visible-columns", JSON.stringify(visibleColumns));
    } catch { /* ignore */ }
  }, [visibleColumns]);

  // Fetch data using React Query hooks
  const { data: childrenData = [] } = useChildren();
  const { data: activitiesData = [] } = useActivities();
  const { data: schedulesData = [] } = useSchedules();
  // This tab is the full attendance record — never a truncated window.
  const { data: logsData = [], isLoading } = useAttendanceLogs({
    limit: "all",
  });

  const children = childrenData;
  const activities = activitiesData;
  const schedules = schedulesData;
  const logs = logsData;
  const loading = isLoading;

  // Select all children by default once they load; toggling a pill off hides that child.
  useEffect(() => {
    if (!childrenInit.current && children.length) {
      setSelectedChildren(children.map(c => c.id));
      childrenInit.current = true;
    }
  }, [children]);

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

  // Saving a log changes logs only — children and activities are untouched.
  async function fetchAll() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
  }

  function openAdd() {
    setPrefill({
      date: new Date().toISOString().split("T")[0],
      status: "attended",
      child_id: children[0]?.id,
    });
    setModalOpen(true);
  }

  async function deleteAttendance() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/attendance-logs/${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Delete failed");
      }
      setConfirmDelete(null);
      await fetchAll();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
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
      fetcher: log.fetcher,
      instructor_name: log.instructor_name,
      lesson_type: log.lesson_type,
      location: log.location ?? sched?.location ?? null,
      absence_reason: log.absence_reason,
      diary_notes: getReflectionText(log.learned, log.diary_notes),
    });
    setModalOpen(true);
  }

  // Activity options are derived from `activities` scoped to the selected
  // children, keyed by "name|institution" since the same activity name can
  // span institutions over time (e.g. Soccer moving academies).
  //
  // A stored selection that has fallen out of its option list (e.g. after
  // unchecking a child) is dropped, so the table never empties behind a
  // filter the user can no longer see. Derived rather than reset in an
  // effect — no cascading render. An empty selection means "all" — same
  // convention as the Activity filter had as a single-select.
  const { activityOptions, activeActivityKeys, matchingActivityIds } = useMemo(() => {
    const childActivities = activities.filter(a => selectedChildren.includes(a.child_id));

    const byKey = new Map<string, string>();
    for (const a of childActivities) {
      byKey.set(`${activityLabel(a)}|${a.institution}`, `${activityLabel(a)} — ${a.institution}`);
    }
    const activityOptions = [...byKey.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const activeActivityKeys = filterActivityKeys.filter(k => byKey.has(k));

    const matchingActivityIds = new Set(
      childActivities
        .filter(a => activeActivityKeys.length === 0 || activeActivityKeys.includes(`${activityLabel(a)}|${a.institution}`))
        .map(a => a.id)
    );

    return { activityOptions, activeActivityKeys, matchingActivityIds };
  }, [activities, selectedChildren, filterActivityKeys]);

  // An empty year selection also means "all" rather than "none".
  const filteredLogs = useMemo(
    () => logs.filter(l =>
      matchingActivityIds.has(l.activity_id) &&
      (filterYears.length === 0 || filterYears.includes(l.date.slice(0, 4)))
    ),
    [logs, matchingActivityIds, filterYears]
  );

  // Sorting several hundred rows is not free, and without this it re-ran on every
  // render — including each toggle of the column picker.
  const sortedLogs = useMemo(() => [...filteredLogs].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    // Push empty values to the bottom regardless of direction
    if (!av && bv) return 1;
    if (av && !bv) return -1;
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
    return sort.dir === "asc" ? cmp : -cmp;
  }), [filteredLogs, sort.key, sort.dir]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedLogs = sortedLogs.slice(pageStart, pageStart + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort(s => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "dateTime" ? "desc" : "asc" });
    setPage(1);
  }

  const years = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i);

  const SortIcon = ({ col }: { col: string }) =>
    sort.key !== col ? null : sort.dir === "asc"
      ? <ChevronUp size={12} className="inline ml-1 -mt-1" />
      : <ChevronDown size={12} className="inline ml-1 -mt-1" />;

  // Embedded in History: History owns the page and header and passes its tab switch in.
  const Shell = embedded ? Fragment : Page;
  return (
    <Shell>
      {!embedded && <Header title="Attendance" subtitle="Every class attended, missed or cancelled" />}

      <Utilities>
        <ChildFilter childList={children} selected={selectedChildren} onToggle={toggleChild} />
        {tabs}
        <FilterBar stretch>
          <FilterField label="Year">
            <MultiSelect
              className="w-32"
              ariaLabel="Filter by year"
              selected={filterYears}
              onToggle={toggleFilterYear}
              allLabel="All Years"
              emptyLabel="All Years"
              pluralNoun="Years"
              options={years.map(y => ({ value: String(y), label: String(y) }))}
            />
          </FilterField>
          <FilterField label="Activity">
            <MultiSelect
              className="w-56"
              ariaLabel="Filter by activity"
              selected={activeActivityKeys}
              onToggle={toggleFilterActivityKey}
              allLabel="All Activities"
              emptyLabel="All Activities"
              pluralNoun="Activities"
              options={activityOptions.map(o => ({ value: o.key, label: o.label }))}
            />
          </FilterField>
        </FilterBar>

      </Utilities>

      <PageBody>
        {/* Summary row — record count opposite the table tools */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <p className="text-sm leading-5 text-[var(--ink-soft)]">
            {sortedLogs.length === 0
              ? "No records"
              : sortedLogs.length > PAGE_SIZE
                ? `${pageStart + 1}–${pageStart + pagedLogs.length} of ${sortedLogs.length} records`
                : `${sortedLogs.length} record${sortedLogs.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex gap-2 shrink-0 ml-auto">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              title="Show or hide table columns"
              aria-pressed={showColumnPicker}
              className={`relative hidden md:inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] text-sm font-medium border transition-colors cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-[''] ${showColumnPicker ? "bg-[var(--stem)]/10 border-[var(--stem)]/30 text-[var(--stem)]" : "border-[var(--rule)] text-[var(--ink-soft)] hover:bg-[var(--bg-secondary)]"}`}
            >
              <Columns3 size={16} /> Columns
            </button>
            <Button variant="secondary" size="sm" onClick={() => exportAttendanceCSV(filteredLogs, `attendance-${new Date().toISOString().split('T')[0]}.csv`)}>
              <Download size={16} /> Export
            </Button>
          </div>
        </div>

        {/* Column picker */}
        {showColumnPicker && (
          <div className="p-4 border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
            <p className="text-sm text-[var(--ink-faint)] mb-3">Visible columns</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: "child", label: "Child" },
                { key: "dateTime", label: "Date & Time" },
                { key: "activity", label: "Activity" },
                { key: "institution", label: "Institution" },
                { key: "level", label: "Level" },
                { key: "coach", label: "Coach" },
                { key: "lessonType", label: "Lesson Type" },
                { key: "sentBy", label: "Sender" },
                { key: "fetcher", label: "Fetcher" },
                { key: "notes", label: "Notes" },
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
                  <span className="text-xs text-[var(--ink)]">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] animate-pulse" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-[var(--ink-faint)]">
            <p className="text-sm">No attendance records</p>
          </div>
        ) : (
          <>
          {/* Phones: one row per session, tap to edit. The wide table stays for tablets and desktops. */}
          <ul className="md:hidden rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--sheet)] divide-y divide-[var(--rule)] overflow-hidden">
            {pagedLogs.map(log => {
              const child = log.child ?? children.find(c => c.id === log.child_id);
              const name = log.activity?.activity_name || log.activity?.institution || "Activity";
              return (
                <li key={log.id}>
                  <button type="button" onClick={() => openEdit(log)} aria-label={`Edit ${name} on ${formatDate(log.date)}`}
                    className="w-full text-left px-4 py-3 min-h-16 flex items-center gap-3 cursor-pointer active:bg-[var(--bg-secondary)]">
                    {child && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} aria-hidden="true" />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-base leading-6 font-semibold text-[var(--ink)] break-words">{name}</span>
                      <span className="block text-sm leading-5 text-[var(--ink-soft)]">
                        {[child?.name, formatDate(log.date), log.start_time ? formatTime(log.start_time) : null].filter(Boolean).join(", ")}
                      </span>
                      {log.activity?.institution && log.activity.activity_name && (
                        <span className="block text-sm leading-5 text-[var(--ink-soft)] break-words">{log.activity.institution}</span>
                      )}
                    </span>
                    {hasReflection(log.learned, log.diary_notes) && <NotebookPen size={16} className="shrink-0 text-[var(--ink-soft)]" aria-label="Has a reflection" />}
                    <Badge label={ATTENDANCE_STATUS_LABELS[log.status]}
                      variant={log.status === "attended" ? "success" : log.status === "absent" ? "danger" : "default"} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block overflow-x-auto rounded-[var(--radius-md)] border border-[var(--rule)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] bg-[var(--bg-secondary)] text-[var(--ink-soft)]">
                  {visibleColumns.child && <th onClick={() => toggleSort("child")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Child<SortIcon col="child" /></th>}
                  {visibleColumns.dateTime && <th onClick={() => toggleSort("dateTime")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Date &<br />Time<SortIcon col="dateTime" /></th>}
                  {visibleColumns.activity && <th onClick={() => toggleSort("activity")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Activity<SortIcon col="activity" /></th>}
                  {visibleColumns.institution && <th onClick={() => toggleSort("institution")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Institution<SortIcon col="institution" /></th>}
                  {visibleColumns.level && <th onClick={() => toggleSort("level")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Level<SortIcon col="level" /></th>}
                  {visibleColumns.coach && <th onClick={() => toggleSort("coach")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Coach<SortIcon col="coach" /></th>}
                  {visibleColumns.lessonType && <th onClick={() => toggleSort("lessonType")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Lesson Type<SortIcon col="lessonType" /></th>}
                  {visibleColumns.sentBy && <th onClick={() => toggleSort("sentBy")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Sender<SortIcon col="sentBy" /></th>}
                  {visibleColumns.fetcher && <th onClick={() => toggleSort("fetcher")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Fetcher<SortIcon col="fetcher" /></th>}
                  {visibleColumns.absenceReason && <th onClick={() => toggleSort("absenceReason")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Absence Reason<SortIcon col="absenceReason" /></th>}
                  {visibleColumns.status && <th onClick={() => toggleSort("status")} className="px-2 py-2 text-left font-semibold cursor-pointer select-none hover:text-[var(--ink)]">Status<SortIcon col="status" /></th>}
                  {visibleColumns.notes && <th className="px-2 py-2 text-left font-semibold">Notes</th>}
                  <th className="px-2 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map(log => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--rule)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    {visibleColumns.child && (() => {
                      const child = log.child ?? children.find(c => c.id === log.child_id);
                      return (
                        <td className="px-2 py-2 text-[var(--ink-soft)] whitespace-nowrap">
                          {child ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} />
                              {child.name}
                            </span>
                          ) : "—"}
                        </td>
                      );
                    })()}
                    {visibleColumns.dateTime && (
                      <td className="px-2 py-2 text-[var(--ink-soft)] whitespace-nowrap">
                        <div>{formatDate(log.date)}</div>
                        {log.start_time && <div className="text-xs text-[var(--ink-faint)]">{formatTime(log.start_time)}</div>}
                      </td>
                    )}
                    {visibleColumns.activity && (
                      <td className="px-2 py-2 text-[var(--ink)]">
                        {log.activity ? (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/activity/${log.activity_id}`); }}
                            className="font-medium text-[var(--stem)] hover:underline cursor-pointer text-left"
                          >
                            {log.activity.activity_name || log.activity.institution}
                          </button>
                        ) : "—"}
                      </td>
                    )}
                    {visibleColumns.institution && <td className="px-2 py-2 text-[var(--ink-soft)]">{log.activity?.institution || "—"}</td>}
                    {visibleColumns.level && <td className="px-2 py-2 text-[var(--ink-soft)]">{log.level || log.activity?.level || "—"}</td>}
                    {visibleColumns.coach && <td className="px-2 py-2 text-[var(--ink-soft)]">{log.instructor_name || "—"}</td>}
                    {visibleColumns.lessonType && <td className="px-2 py-2 text-[var(--ink-soft)]">{normalizeLessonType(log.lesson_type) || "—"}</td>}
                    {visibleColumns.sentBy && <td className="px-2 py-2 text-[var(--ink-soft)]">{log.sent_by || "—"}</td>}
                    {visibleColumns.fetcher && <td className="px-2 py-2 text-[var(--ink-soft)]">{log.fetcher || "—"}</td>}
                    {visibleColumns.absenceReason && <td className="px-2 py-2 text-[var(--ink-soft)]">{(log.status === "absent" || log.status === "cancelled_by_provider") ? log.absence_reason || "—" : "—"}</td>}
                    {visibleColumns.status && (
                      <td className="px-2 py-2 text-left">
                        <Badge
                          label={ATTENDANCE_STATUS_LABELS[log.status]}
                          variant={log.status === "attended" ? "success" : log.status === "absent" ? "danger" : "default"}
                        />
                      </td>
                    )}
                    {visibleColumns.notes && (
                      <td className="px-2 py-2 text-left">
                        {hasReflection(log.learned, log.diary_notes) ? (
                          <span title={getReflectionText(log.learned, log.diary_notes)}>
                            <NotebookPen size={16} className="inline text-[var(--ink-soft)]" />
                          </span>
                        ) : <span className="text-[var(--ink-faint)]">—</span>}
                      </td>
                    )}
                    <td className="px-2 py-2 text-left">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(log)}
                          className="w-12 h-12 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--ink-faint)] hover:bg-white hover:text-[var(--ink)] transition-colors"
                          title="Edit attendance"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => { setDeleteError(""); setConfirmDelete(log); }}
                          className="w-12 h-12 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--ink-faint)] hover:bg-white hover:text-[var(--margin)] transition-colors"
                          title="Delete attendance"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination — only surfaces once the filtered set outgrows one page */}
        {!loading && sortedLogs.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Prev
            </Button>
            <span className="text-xs text-[var(--ink-soft)] tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        )}

        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete attendance?" size="sm">
          {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-[var(--radius-md)] mb-3">{deleteError}</p>}
          <p className="text-sm text-[var(--ink-soft)] mb-4">
            Delete the {confirmDelete ? formatDate(confirmDelete.date) : ""}{" "}
            {confirmDelete?.start_time ? `at ${formatTime(confirmDelete.start_time)} ` : ""}
            record for{" "}
            <strong>
              {confirmDelete?.child?.name ?? children.find(c => c.id === confirmDelete?.child_id)?.name ?? "—"}
            </strong>
            {confirmDelete?.activity
              ? ` (${activityLabel(confirmDelete.activity)} @ ${confirmDelete.activity.institution})`
              : ""}
            ?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={deleteAttendance} loading={deleting}>Delete</Button>
          </div>
        </Modal>

        <AttendanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          children={children}
          activities={activities}
          prefill={prefill}
          onSaved={fetchAll}
          title={prefill?.id ? "Edit Attendance" : "Add Attendance"}
        />
      </PageBody>

      <Fab label="Add session" onClick={openAdd} />
    </Shell>
  );
}
