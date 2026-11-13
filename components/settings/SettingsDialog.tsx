"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarDays, ListChecks, Shapes, Tags, Users, X, type LucideIcon } from "lucide-react";
import { useSpaNav, type SettingsSection } from "@/components/layout/spa-nav";
import { ChildrenTab } from "@/components/settings/ChildrenTab";
import { ActivitiesTab } from "@/components/settings/ActivitiesTab";
import { SchedulesTab } from "@/components/settings/SchedulesTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { RoutinesTab } from "@/components/settings/RoutinesTab";
import { CalendarTab } from "@/components/settings/CalendarTab";
import { FabSlot } from "@/components/ui/Fab";
import { IconButton } from "@/components/ui/IconButton";
import { useChildren, useActivities, useSchedules, useCategories, useGoals } from "@/lib/api-hooks";
import { MY_DAY_KEYS, useCalendarDays, useCalendars, useRoutineItems, useSchoolHours } from "@/lib/my-day-api";
import { cn, plural } from "@/lib/utils";

const SECTIONS: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: "children",   label: "Children",   icon: Users },
  { key: "activities", label: "Activities", icon: Shapes },
  { key: "schedules",  label: "Schedules",  icon: CalendarClock },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "routines",   label: "Routines",   icon: ListChecks },
  { key: "calendar",   label: "Calendar",   icon: CalendarDays },
];
type Section = SettingsSection;

/**
 * Settings, as a dialog over whichever tab is open. Desktop: a centred panel with
 * the sections listed down the left. Phone: a sheet that rises from the bottom
 * (the page stays visible above it) with the sections as a tab switch.
 * Edit forms open as their own dialogs on top; Escape closes those first.
 */
export function SettingsDialog() {
  // The section lives in the nav context, so reopening returns to it and other screens
  // can open Settings on a given section (e.g. Home's "Set up a routine").
  const { settingsOpen, setSettingsOpen, settingsSection, setSettingsSection } = useSpaNav();
  if (!settingsOpen) return null;
  return <SettingsBody section={settingsSection} setSection={setSettingsSection} onClose={() => setSettingsOpen(false)} />;
}

function SettingsBody({ section, setSection, onClose }: { section: Section; setSection: (s: Section) => void; onClose: () => void }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [fabSlot, setFabSlot] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const { data: children = [], isLoading: lc } = useChildren();
  const { data: activities = [], isLoading: la } = useActivities();
  const { data: schedules = [], isLoading: ls } = useSchedules();
  const { data: categories = [], isLoading: lcat } = useCategories();
  const { data: goals = [], isLoading: lg } = useGoals();
  const { data: schoolHours = [], isLoading: lh } = useSchoolHours();
  const { data: calendars = [], isLoading: lcal } = useCalendars();
  const { data: calendarDays = [], isLoading: ld } = useCalendarDays();
  const { data: routine = [], isLoading: lr } = useRoutineItems();
  const loading = lc || la || ls || lcat || lg || lh || lcal || ld || lr;

  // Refresh after edits without unmounting the open section (keeps its filters).
  const refresh = useCallback(() => {
    for (const key of [["children"], ["activities"], ["schedules"], ["categories"], ["goals"], ...Object.values(MY_DAY_KEYS)]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // An edit form open on top gets the Escape, not Settings underneath it.
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const activeCount = activities.filter(a => a.status === "active").length;
  const summary = loading ? "" : {
    children: `${plural(children.length, "child", "children")} · kept for history, never deleted`,
    activities: `${plural(activeCount, "active class", "active classes")} · ${activities.length - activeCount} past`,
    schedules: `${plural(schedules.length, "weekly slot")} across every class`,
    categories: `${plural(categories.length, "group")} that colour-code classes`,
    routines: "Each child’s checklist on My Day, for school days and holidays",
    calendar: "Terms and holidays decide which routine each child gets",
  }[section];
  const current = SECTIONS.find(s => s.key === section)!;

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center justify-center md:p-8">
      <div className="settings-backdrop absolute inset-0 bg-[var(--ink)]/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "settings-panel relative flex flex-col w-full bg-[var(--sheet)] border border-[var(--rule)] outline-none overflow-hidden",
          "h-[calc(100dvh-48px)] rounded-t-[16px] border-b-0",
          "md:h-[min(760px,100%)] md:max-w-[960px] md:rounded-[var(--radius-lg)] md:border-b md:shadow-[0_16px_48px_rgba(26,44,34,0.2)]"
        )}
      >
        {/* Grab handle: tells phone users this is a sheet over the page. */}
        <div className="md:hidden flex justify-center pt-2" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-[var(--rule)]" />
        </div>

        <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6 md:border-b border-[var(--rule)] shrink-0">
          <h2 id={titleId} className="m-0 text-lg md:text-base font-semibold text-[var(--ink)]">Settings</h2>
          <IconButton icon={X} label="Close settings" onClick={onClose} className="-mr-3" />
        </div>

        {/* Phone: six sections as a 3×2 switch, so every label fits without cutting off. */}
        <div className="md:hidden px-4 pb-3 shrink-0 border-b border-[var(--rule)]">
          <div role="tablist" aria-label="Settings section" className="grid grid-cols-3 border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--sheet)]">
            {SECTIONS.map(({ key, label }, i) => {
              const on = key === section;
              return (
                <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setSection(key)}
                  className={cn(
                    "h-10 px-1 text-sm font-medium cursor-pointer truncate",
                    i % 3 !== 0 && "border-l border-[var(--rule)]",
                    i >= 3 && "border-t border-[var(--rule)]",
                    on ? "bg-[var(--ink)] text-[var(--sheet)]" : "text-[var(--ink-soft)]"
                  )}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <nav aria-label="Settings sections" className="hidden md:flex flex-col gap-1 w-52 shrink-0 p-3 border-r border-[var(--rule)]">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const on = key === section;
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => setSection(key)}
                  className={cn(
                    "flex items-center gap-3 h-10 px-3 text-sm text-left rounded-[var(--radius-md)] cursor-pointer",
                    on ? "bg-[var(--bg-secondary)] text-[var(--ink)] font-semibold" : "text-[var(--ink-soft)] font-medium hover:text-[var(--ink)] hover:bg-[var(--bg-secondary)]/60"
                  )}
                >
                  <Icon size={16} strokeWidth={on ? 2.2 : 1.7} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="relative flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-6 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-24">
              <div className="mb-4">
                <h3 className="hidden md:block m-0 text-base leading-6 font-semibold text-[var(--ink)]">{current.label}</h3>
                <p className="m-0 min-h-5 text-sm leading-5 text-[var(--ink-soft)]">{summary}</p>
              </div>

              <FabSlot.Provider value={fabSlot}>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--bg-secondary)] animate-pulse" />)}
                  </div>
                ) : (
                  <>
                    {section === "children" && <ChildrenTab children={children} schoolHours={schoolHours} calendars={calendars} onRefresh={refresh} />}
                    {section === "activities" && (
                      <ActivitiesTab activities={activities} categories={categories} children={children} onRefresh={refresh} />
                    )}
                    {section === "schedules" && (
                      <SchedulesTab schedules={schedules} activities={activities} children={children} onRefresh={refresh} />
                    )}
                    {section === "categories" && <CategoriesTab categories={categories} onRefresh={refresh} />}
                    {section === "routines" && (
                      <RoutinesTab childList={children} routine={routine} activities={activities} schedules={schedules}
                        goals={goals} schoolHours={schoolHours} onRefresh={refresh} />
                    )}
                    {section === "calendar" && (
                      <CalendarTab calendars={calendars} calendarDays={calendarDays} childList={children} onRefresh={refresh} />
                    )}
                  </>
                )}
              </FabSlot.Provider>
            </div>
            {/* The section's add button docks here, in the dialog's corner. */}
            <div ref={setFabSlot} className="absolute right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] md:right-6 md:bottom-6 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
