"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, NotebookPen, Sparkles, ExternalLink, GraduationCap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Page, Utilities, PageBody } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/Segmented";
import { SingleSelect } from "@/components/ui/FilterDropdown";
import { FilterField } from "@/components/ui/FilterBar";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { AttendanceModal, AttendancePrefill } from "@/components/attendance/AttendanceModal";
import { SummaryCard } from "@/components/journal/SummaryCard";
import { ChatPanel } from "@/components/journal/ChatPanel";
import { SchoolNoteModal } from "@/components/journal/SchoolNoteModal";
import { Fab } from "@/components/ui/Fab";
import { useSchoolNotes } from "@/lib/school-notes-api";
import { cn } from "@/lib/utils";
import { getReflectionText, hasReflection } from "@/lib/reflection";
import { useChildren, useActivities, useAttendanceLogs } from "@/lib/api-hooks";
import type { AttendanceLog, Activity, ActivityCategory, Child, SchoolNote } from "@/lib/types";

interface LogWithDetails extends AttendanceLog {
  activity?: Activity & { category?: ActivityCategory };
  child?: Child;
}


type SubTab = "reflections" | "highlights" | "chat";

/** The activity filter's value for "only school feedback". */
const SCHOOL = "__school";

/** One row in the Journal: a class reflection, or feedback from school. */
type Entry =
  | { kind: "log"; id: string; date: string; log: LogWithDetails }
  | { kind: "school"; id: string; date: string; note: SchoolNote };

export default function JournalPage() {
  const router = useRouter();
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
  // School feedback form: null = closed, "new" = adding, a note = editing it.
  const [schoolForm, setSchoolForm] = useState<SchoolNote | "new" | null>(null);

  const { data: childrenData = [] } = useChildren();
  const { data: activitiesData = [] } = useActivities();
  const { data: logsData = [], isLoading } = useAttendanceLogs({ limit: 300 });
  const { data: schoolNotes = [] } = useSchoolNotes();

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
      .sort((a, b) =>
        (a.activity_name || a.institution).localeCompare(b.activity_name || b.institution) ||
        (children.find(c => c.id === a.child_id)?.name ?? "").localeCompare(children.find(c => c.id === b.child_id)?.name ?? ""));
  }, [logsData, activities, selectedChildren, children]);

  // Each child has their own record of a shared class (two "Swimming"s), so with more than
  // one child in view every option names its child.
  const multiChild = selectedChildren.length > 1;
  const hasSchool = schoolNotes.some(n => selectedChildren.includes(n.child_id));
  const activityFilterOptions = [
    { value: "", label: "All Activities" },
    ...(hasSchool ? [{ value: SCHOOL, label: "School feedback" }] : []),
    ...scopeActivities.map(a => {
      const child = children.find(c => c.id === a.child_id);
      const name = a.activity_name || a.institution;
      return { value: a.id, label: multiChild && child ? `${name} · ${child.name}` : name, colorCode: multiChild ? child?.color_code : undefined };
    }),
  ];

  // Reflections and school feedback together, newest first, grouped by month.
  const { entries, groups } = useMemo(() => {
    const logs: Entry[] = filterActivity === SCHOOL ? [] : (logsData as LogWithDetails[])
      .filter(l => hasReflection(l.learned, l.diary_notes))
      .filter(l => selectedChildren.includes(l.child_id))
      .filter(l => !filterActivity || l.activity_id === filterActivity)
      .map(l => ({ kind: "log" as const, id: l.id, date: l.date.slice(0, 10), log: l }));
    const school: Entry[] = filterActivity && filterActivity !== SCHOOL ? [] : schoolNotes
      .filter(n => selectedChildren.includes(n.child_id))
      .map(n => ({ kind: "school" as const, id: n.id, date: n.date.slice(0, 10), note: n }));
    const entries = [...logs, ...school].sort((x, y) =>
      y.date.localeCompare(x.date) ||
      (y.kind === "log" ? y.log.start_time || "" : "").localeCompare(x.kind === "log" ? x.log.start_time || "" : ""));

    const groups: { label: string; items: Entry[] }[] = [];
    for (const e of entries) {
      const label = format(parseISO(e.date), "MMMM yyyy");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(e);
      else groups.push({ label, items: [e] });
    }
    return { entries, groups };
  }, [logsData, schoolNotes, selectedChildren, filterActivity]);

  const selectedActivity = filterActivity && filterActivity !== SCHOOL ? activities.find(a => a.id === filterActivity) : undefined;
  const singleChild = selectedChildren.length === 1 ? selectedChildren[0] : "";
  const summaryTitle = selectedActivity
    ? `${childName(selectedActivity.child_id)}’s ${selectedActivity.activity_name || selectedActivity.institution} journey`
    : singleChild ? `${childName(singleChild)}’s learning overview` : "Learning overview";

  const subTabs: { value: SubTab; label: string }[] = [
    { value: "reflections", label: "Reflections" },
    { value: "highlights", label: "AI Highlights" },
    { value: "chat", label: "Chat" },
  ];

  return (
    <Page>
      <Header title="Journal" subtitle={null} />

      <Utilities>
        {/* Chat ignores the child filter, but keeps its row so the switch below never moves. */}
        <div className={subTab === "chat" ? "invisible" : undefined} aria-hidden={subTab === "chat" || undefined}>
          <ChildFilter childList={children} selected={selectedChildren} onToggle={toggleChild} />
        </div>

        <Segmented ariaLabel="Journal view" value={subTab} onChange={setSubTab} options={subTabs} />

        {/* The only filter here, so it takes the full width rather than a scrolling filter row. */}
        <FilterField label="Activity" className={cn("w-full", subTab === "chat" && "hidden")}>
          <SingleSelect
            className="w-full"
            ariaLabel="Filter by activity"
            value={filterActivity}
            onChange={setFilterActivity}
            options={activityFilterOptions}
          />
        </FilterField>
      </Utilities>

      <PageBody clear="nav">

        {/* ── Reflections ── */}
        {subTab === "reflections" && (
          isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-[var(--ink-faint)]">
              <NotebookPen size={32} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">No reflections or school feedback yet.</p>
              <p className="text-xs mt-1">Add a reflection when confirming a session, or tap + to add feedback from school.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(group => (
                <div key={group.label}>
                  <p className="text-sm text-[var(--ink-faint)] mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {group.items.map(entry => {
                      const isOpen = expanded.has(entry.id);
                      const childId = entry.kind === "log" ? entry.log.child_id : entry.note.child_id;
                      const child = (entry.kind === "log" ? entry.log.child : undefined) ?? children.find(c => c.id === childId);
                      const title = entry.kind === "log"
                        ? entry.log.activity?.activity_name || entry.log.activity?.institution || "Activity"
                        : entry.note.source || "School";
                      const snippet = entry.kind === "log" ? getReflectionText(entry.log.learned, entry.log.diary_notes) : entry.note.text;
                      return (
                        <div key={`${entry.kind}-${entry.id}`} className="border-b border-[var(--rule)] overflow-hidden">
                          {/* The date and class (or who at school) on one line, then the note: two lines,
                              faded, and the whole row opens to read it all. School feedback is tagged. */}
                          <button onClick={() => toggle(entry.id)} aria-expanded={isOpen}
                            className="w-full text-left px-1 py-3 min-h-12 flex flex-col gap-1 cursor-pointer active:bg-[var(--bg-secondary)]">
                            <span className="flex items-center gap-2 min-w-0">
                              {child && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: child.color_code }} />}
                              {entry.kind === "school" && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 rounded-full bg-[#e3ebf7] text-[#1d3f78] text-xs leading-5 font-semibold">
                                  <GraduationCap size={12} aria-hidden="true" /> School
                                </span>
                              )}
                              <span className="text-sm font-semibold text-[var(--ink)] break-words min-w-0">{title}</span>
                              <span className="text-xs text-[var(--ink-soft)] tabular-nums shrink-0 ml-auto">{format(parseISO(entry.date), "d MMM")}</span>
                            </span>
                            {!isOpen && <span className="text-[14px] leading-5 text-[var(--ink-soft)] line-clamp-2 break-words">{snippet}</span>}
                          </button>
                          {isOpen && (
                            <div className="px-1 pb-3">
                              <p className="text-sm leading-6 text-[var(--ink)] whitespace-pre-wrap break-words">{snippet}</p>
                              <div className="mt-3 flex items-center gap-4">
                                <button onClick={() => entry.kind === "log" ? openEdit(entry.log) : setSchoolForm(entry.note)}
                                  className="relative inline-flex items-center gap-2 h-10 text-sm font-semibold text-[var(--stem)] hover:opacity-80 cursor-pointer before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']">
                                  <Pencil size={16} /> Edit
                                </button>
                                {entry.kind === "log" && (
                                  <button onClick={() => router.push(`/activity/${entry.log.activity_id}`)} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--stem)] hover:underline cursor-pointer">
                                    <ExternalLink size={16} /> Open activity
                                  </button>
                                )}
                              </div>
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
            <div className="text-center py-16 text-[var(--ink-faint)]">
              <Sparkles size={32} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">Nothing to summarise yet.</p>
              <p className="text-xs mt-1">Add reflections to a child’s activities, then generate highlights here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--ink-soft)]">
                {selectedActivity
                  ? "A deep dive into this activity’s journey."
                  : singleChild
                  ? "An overview and key highlights across this child’s activities."
                  : "An overview and key highlights across everyone. Select one child, or an activity, to focus it."}
              </p>
              <SummaryCard
                key={(selectedActivity ? filterActivity : "") || singleChild || "all"}
                kind={selectedActivity ? "journey" : "overview"}
                activityId={selectedActivity ? filterActivity : undefined}
                childId={!selectedActivity ? (singleChild || undefined) : undefined}
                title={summaryTitle}
              />
            </div>
          )
        )}

        <div className={subTab === "chat" ? "" : "hidden"}>
          <ChatPanel />
        </div>

        {subTab === "reflections" && <Fab label="Add school feedback" onClick={() => setSchoolForm("new")} />}
        {schoolForm && (
          <SchoolNoteModal open onClose={() => setSchoolForm(null)} childList={children}
            note={schoolForm === "new" ? undefined : schoolForm}
            defaultChildId={singleChild || undefined} />
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
      </PageBody>
    </Page>
  );
}
