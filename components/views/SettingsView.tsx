"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { ChildrenTab } from "@/components/settings/ChildrenTab";
import { ActivitiesTab } from "@/components/settings/ActivitiesTab";
import { SchedulesTab } from "@/components/settings/SchedulesTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { Page, Utilities, PageBody } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/Segmented";
import { useChildren, useActivities, useSchedules, useCategories } from "@/lib/api-hooks";
import { plural } from "@/lib/utils";

const TABS = [
  { key: "children",   label: "Children" },
  { key: "activities", label: "Activities" },
  { key: "schedules",  label: "Schedules" },
  { key: "categories", label: "Categories" },
] as const;

type Tab = typeof TABS[number]["key"];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("children");

  // Cached via React Query — instant on tab switches, refetched on invalidation.
  const { data: children = [], isLoading: lc } = useChildren();
  const { data: activities = [], isLoading: la } = useActivities();
  const { data: schedules = [], isLoading: ls } = useSchedules();
  const { data: categories = [], isLoading: lcat } = useCategories();
  const loading = lc || la || ls || lcat;

  // Refresh after edits without unmounting the active tab (preserves filters/selection)
  const silentRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["children"] });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }, [queryClient]);

  // The header says what's in the open section, so the lists need no intro line of their own.
  const activeCount = activities.filter(a => a.status === "active").length;
  const subtitle = loading ? " " : {
    children: `${plural(children.length, "child", "children")} · kept for history, never deleted`,
    activities: `${plural(activeCount, "active class", "active classes")} · ${activities.length - activeCount} past`,
    schedules: `${plural(schedules.length, "weekly slot")} across every class`,
    categories: `${plural(categories.length, "group")} that colour-code classes`,
  }[activeTab];

  return (
    <Page>
      <Header title="Settings" subtitle={subtitle} />

      <Utilities>
        <Segmented ariaLabel="Settings section" value={activeTab} onChange={setActiveTab} options={TABS.map(t => ({ value: t.key, label: t.label }))} />
      </Utilities>

      <PageBody>
        <div>
        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[var(--bg-secondary)] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === "children" && (
              <ChildrenTab children={children} onRefresh={silentRefresh} />
            )}
            {activeTab === "activities" && (
              <ActivitiesTab
                activities={activities}
                categories={categories}
                children={children}
                onRefresh={silentRefresh}
              />
            )}
            {activeTab === "schedules" && (
              <SchedulesTab
                schedules={schedules}
                activities={activities}
                children={children}
                onRefresh={silentRefresh}
              />
            )}
            {activeTab === "categories" && (
              <CategoriesTab categories={categories} onRefresh={silentRefresh} />
            )}
          </>
        )}
        </div>
      </PageBody>
    </Page>
  );
}
