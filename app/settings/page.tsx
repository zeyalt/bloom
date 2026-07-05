"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { ChildrenTab } from "@/components/settings/ChildrenTab";
import { ActivitiesTab } from "@/components/settings/ActivitiesTab";
import { SchedulesTab } from "@/components/settings/SchedulesTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { cn } from "@/lib/utils";
import { useChildren, useActivities, useSchedules, useCategories } from "@/lib/api-hooks";

const TABS = [
  { key: "children",   label: "Children",   subtitle: "Your growing seedlings 🌿" },
  { key: "activities", label: "Activities", subtitle: "Passions, hobbies & pursuits ⚽" },
  { key: "schedules",  label: "Schedules",  subtitle: "The weekly rhythm 🗓️" },
  { key: "categories", label: "Categories", subtitle: "Sort the fun by type 🏷️" },
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

  const activeTabConfig = TABS.find(t => t.key === activeTab);

  return (
    <div className="max-w-[860px] mx-auto w-full">
      <Header title="Settings" subtitle={activeTabConfig?.subtitle || "Manage settings"} />

      <div className="px-5 md:px-8 pt-4 md:pt-6">
        {/* Tab bar — tabs share width so they fit without scrolling */}
        <div className="flex gap-1 p-1 bg-[var(--bg-secondary)]/50 rounded-xl mb-8 border border-[var(--border)]/30">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150",
                activeTab === tab.key
                  ? "bg-white text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
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
    </div>
  );
}
