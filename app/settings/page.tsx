"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { ChildrenTab } from "@/components/settings/ChildrenTab";
import { ActivitiesTab } from "@/components/settings/ActivitiesTab";
import { SchedulesTab } from "@/components/settings/SchedulesTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { cn } from "@/lib/utils";
import type { Child, Activity, Schedule, ActivityCategory } from "@/lib/types";

const TABS = [
  { key: "children",   label: "Children"   },
  { key: "activities", label: "Activities" },
  { key: "schedules",  label: "Schedules"  },
  { key: "categories", label: "Categories" },
] as const;

type Tab = typeof TABS[number]["key"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("children");
  const [children, setChildren] = useState<Child[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [ch, ac, sc, cat] = await Promise.all([
        fetch("/api/children").then(r => r.json()),
        fetch("/api/activities").then(r => r.json()),
        fetch("/api/schedules").then(r => r.json()),
        fetch("/api/categories").then(r => r.json()),
      ]);
      setChildren(Array.isArray(ch) ? ch : []);
      setActivities(Array.isArray(ac) ? ac : []);
      setSchedules(Array.isArray(sc) ? sc : []);
      setCategories(Array.isArray(cat) ? cat : []);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh after edits without unmounting the active tab (preserves filters/selection)
  const silentRefresh = useCallback(() => fetchAll({ silent: true }), [fetchAll]);

  return (
    <div className="max-w-[860px] mx-auto w-full">
      <Header title="Settings" subtitle="Manage children, activities and schedules" />

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
