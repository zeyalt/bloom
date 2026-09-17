"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { InteractionLock } from "@/components/layout/InteractionLock";
import { SpaNavProvider, TAB_PATHS, isTabPath, useSpaNav } from "@/components/layout/spa-nav";
import HomeView from "@/components/views/HomeView";
import AttendanceView from "@/components/views/AttendanceView";
import ExpensesView from "@/components/views/ExpensesView";
import AnalyticsView from "@/components/views/AnalyticsView";
import JournalView from "@/components/views/JournalView";
import SettingsView from "@/components/views/SettingsView";

const TAB_VIEWS = {
  "/": HomeView,
  "/attendance": AttendanceView,
  "/expenses": ExpensesView,
  "/analytics": AnalyticsView,
  "/journal": JournalView,
  "/settings": SettingsView,
} as const;

function TabScreens() {
  const { path } = useSpaNav();
  const [visited, setVisited] = useState<Set<string>>(() => new Set(isTabPath(path) ? [path] : []));

  useEffect(() => {
    if (!isTabPath(path) || path === "/analytics") return;
    setVisited(prev => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, [path]);

  // Recharts ResponsiveContainer collapses to 0-width while display:none, so
  // Analytics remounts on each visit. Other tabs stay mounted so a return tap
  // is a CSS unhide, not a React remount.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import("@/components/analytics/AnalyticsDashboard");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {TAB_PATHS.map(href => {
        const View = TAB_VIEWS[href];
        const active = path === href;
        if (href === "/analytics") {
          return active ? (
            <div key="analytics" className="h-full overflow-y-auto">
              <View />
            </div>
          ) : null;
        }
        if (!active && !visited.has(href)) return null;
        return (
          <div key={href} hidden={!active} className="h-full overflow-y-auto">
            <View />
          </div>
        );
      })}
    </>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { path } = useSpaNav();
  const onTab = isTabPath(path);

  return (
    <>
      <ServiceWorkerRegister />
      <InteractionLock />
      <div className="flex h-full min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-primary)]">
          <div className="relative flex-1 min-h-0">
            <TabScreens />
            {!onTab && <div className="h-full overflow-y-auto">{children}</div>}
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SpaNavProvider>
      <ShellFrame>{children}</ShellFrame>
    </SpaNavProvider>
  );
}
