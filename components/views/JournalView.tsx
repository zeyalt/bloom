"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Pencil, NotebookPen, ChevronDown, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Segmented } from "@/components/ui/Segmented";
import { MultiSelect, SingleSelect } from "@/components/ui/FilterDropdown";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { SummaryCard } from "@/components/journal/SummaryCard";
import { cn } from "@/lib/utils";
import { getReflectionText, hasReflection } from "@/lib/reflection";
import { useChildren, useActivities, useAttendanceLogs } from "@/lib/api-hooks";
import type { AttendanceLog, Activity, ActivityCategory, Child } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}


type SubTab = "reflections" | "highlights";

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>("reflections");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const childrenInit = useRef(false);
  const [filterActivity, setFilterActivity] = useState("");

  const toggleChild = (id: string) => {
    setSelectedChildren(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    setFilterActivity("");
  };
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<AttendancePrefill | undefined>(undefined);

  const { data: childrenData = [] } = useChildren();
  const { data: activitiesData = [] } = useActivities();
  const { data: logsData = [], isLoading } = useAttendanceLogs({ limit: 300 });

  const children = childrenData;
  const activities = activitiesData;

  // Select all children by default once they load; toggling a pill off hides that child.
  useEffect(() => {
    if (!childrenInit.current && children.length) {
      setSelectedChildren(children.map(c => c.id));
      childrenInit.current = true;
    }
  }, [children]);

  async function fetchAll() {
    await queryClient.invalidateQueries({ queryKey: ["attendance-logs"] });
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openEdit(log: LogWithDetails) {
    setPrefill({
      id: log.id,
      activity_id: log.activity_id,
      child_id: log.child_id,
      date: log.date.slice(0, 10),
      status: log.status,
      start_time: log.start_time,
      end_time: log.end_time,
      sent_by: log.sent_by,
      fetcher: log.fetcher,
      instructor_name: log.instructor_name,
      lesson_type: log.lesson_type,
      location: log.location,
      absence_reason: log.absence_reason,
      diary_notes: getReflectionText(log.learned, log.diary_notes),
    });
    setModalOpen(true);
  }

  const childName = (id?: string) => children.find(c => c.id === id)?.name;

  // Only activities that actually have a reflection are worth offering as filters.
  const scopeActivities = useMemo(() => {
    const reflectionActivityIds = new Set((logsData as LogWithDetails[]).filter(l => hasReflection(l.learned, l.diary_notes)).map(l => l.activity_id));
    return activities
      .filter(a => reflectionActivityIds.has(a.id) && selectedChildren.includes(a.child_id))
      .sort((a, b) => (a.activity_name || a.institution).localeCompare(b.activity_name || b.institution));
  }, [logsData, activities, selectedChildren]);

  // Matching entries, grouped by month for a light, scannable structure. The
  // date parsing here runs per entry, so it stays out of the render path.
  const { entries, groups } = useMemo(() => {
    const entries = (logsData as LogWithDetails[])
      .filter(l => hasReflection(l.learned, l.diary_notes))
      .filter(l => selectedChildren.includes(l.child_id))
      .filter(l => !filterActivity || l.activity_id === filterActivity)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.start_time || "").localeCompare(a.start_time || ""));

    const groups: { label: string; items: LogWithDetails[] }[] = [];
    for (const log of entries) {
      const label = format(parseISO(log.date.slice(0, 10)), "MMMM yyyy");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(log);
      else groups.push({ label, items: [log] });
    }
    return { entries, groups };
  }, [logsData, selectedChildren, filterActivity]);

  const selectedActivity = filterActivity ? activities.find(a => a.id === filterActivity) : undefined;
  const singleChild = selectedChildren.length === 1 ? selectedChildren[0] : "";
  const summaryTitle = selectedActivity
    ? `${childName(selectedActivity.child_id)}’s ${selectedActivity.activity_name || selectedActivity.institution} journey`
    : singleChild ? `${childName(singleChild)}’s learning overview` : "Learning overview";

  const subTabs: { value: SubTab; label: string }[] = [
    { value: "reflections", label: "Reflections" },
    { value: "highlights", label: "AI Highlights" },
  ];

  return (
    <div className="max-w-[900px] mx-auto w-full">
      <Header title="Journal" subtitle="Notes from class" />

      <div className="px-5 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">
        {/* Filters — pick child(ren), then narrow by activity */}
        <FilterBar stretch className="mb-4">
          <FilterField label="Child">
            <MultiSelect
              className="w-44"
              ariaLabel="Filter by child"
              allLabel="All Children"
              emptyLabel="No Children"
              pluralNoun="Children"
              options={children.map(c => ({ value: c.id, label: c.name, colorCode: c.color_code }))}
              selected={selectedChildren}
              onToggle={toggleChild}
            />
          </FilterField>
          <FilterField label="Activity">
            <SingleSelect
              className="w-44"
              ariaLabel="Filter by activity"
              value={filterActivity}
              onChange={setFilterActivity}
              options={[
                { value: "", label: "All Activities" },
                ...scopeActivities.map(a => ({ value: a.id, label: a.activity_name || a.institution })),
              ]}
            />
          </FilterField>
        </FilterBar>

        {/* Sub-tabs — stretch full width */}
        <Segmented className="mb-5" fullWidth value={subTab} onChange={setSubTab} options={subTabs} />

        {/* ── Reflections ── */}
        {subTab === "reflections" && (
          isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <NotebookPen size={28} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">No reflections yet.</p>
              <p className="text-xs mt-1">Add a reflection when confirming a session.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(group => (
                <div key={group.label}>
                  <p className="text-sm text-[var(--ink-faint)] mb-2">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.items.map(log => {
                      const child = log.child ?? children.find(c => c.id === log.child_id);
                      const title = log.activity?.activity_name || log.activity?.institution || "Activity";
                      const isOpen = expanded.has(log.id);
                      const snippet = getReflectionText(log.learned, log.diary_notes);
                      return (
                        <div key={log.id} className="border-b border-[var(--rule)] overflow-hidden">
                          <button onClick={() => toggle(log.id)} className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 cursor-pointer">
                            <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums shrink-0 w-12">{format(parseISO(log.date.slice(0, 10)), "d MMM")}</span>
                            {child && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} />}
                            <span className="text-sm font-medium text-[var(--text-primary)] shrink-0 max-w-[38%] truncate">{title}</span>
                            {!isOpen && <span className="text-sm text-[var(--text-muted)] truncate flex-1 min-w-0">{snippet}</span>}
                            <ChevronDown size={15} className={cn("shrink-0 ml-auto text-[var(--text-muted)] transition-transform", isOpen && "rotate-180")} />
                          </button>
                          {isOpen && (
                            <div className="px-3.5 pb-3 pt-0.5 border-t border-[var(--border)]/60">
                              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap mt-2">{snippet}</p>
                              <button onClick={() => openEdit(log)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:opacity-80">
                                <Pencil size={13} /> Edit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Highlights (AI) ── */}
        {subTab === "highlights" && (
          entries.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <Sparkles size={28} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">Nothing to summarise yet.</p>
              <p className="text-xs mt-1">Add reflections to a child’s activities, then generate highlights here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {selectedActivity
                  ? "A deep dive into this activity’s journey."
                  : singleChild
                  ? "An overview and key highlights across this child’s activities."
                  : "An overview and key highlights across everyone. Select one child, or an activity, to focus it."}
              </p>
              <SummaryCard
                key={filterActivity || singleChild || "all"}
                kind={selectedActivity ? "journey" : "overview"}
                activityId={filterActivity || undefined}
                childId={!filterActivity ? (singleChild || undefined) : undefined}
                title={summaryTitle}
              />
            </div>
          )
        )}

        <AttendanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          children={children}
          activities={activities}
          prefill={prefill}
          onSaved={fetchAll}
          title="Edit Reflection"
        />
      </div>
    </div>
  );
}
