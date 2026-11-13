"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export const TAB_PATHS = ["/", "/goals", "/history", "/analytics", "/journal"] as const;

/** Settings is a dialog over the current tab, not a tab; this URL just opens it. */
const SETTINGS_PATH = "/settings";
export type TabPath = (typeof TAB_PATHS)[number];
export type SettingsSection = "children" | "activities" | "schedules" | "categories" | "routines" | "calendar";

export function isTabPath(path: string): path is TabPath {
  return (TAB_PATHS as readonly string[]).includes(path);
}

type SpaNavValue = {
  path: string;
  navigate: (href: string) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  /** Which Settings section shows; kept while closed, so reopening returns to it. */
  settingsSection: SettingsSection;
  /** Opens Settings, optionally on a given section. */
  openSettings: (section?: SettingsSection) => void;
  setSettingsSection: (section: SettingsSection) => void;
};

const SpaNavContext = createContext<SpaNavValue | null>(null);

export function useSpaNav() {
  const ctx = useContext(SpaNavContext);
  if (!ctx) throw new Error("useSpaNav must be used within SpaNavProvider");
  return ctx;
}

export function SpaNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  // A load or link to /settings shows Home with the Settings dialog open over it.
  const [path, setPath] = useState(pathname === SETTINGS_PATH ? "/" : pathname);
  const [settingsOpen, setSettingsOpen] = useState(pathname === SETTINGS_PATH);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("children");
  const openSettings = useCallback((section?: SettingsSection) => {
    if (section) setSettingsSection(section);
    setSettingsOpen(true);
  }, []);

  // Real Next.js navigations (router.push, a Link, Back/Forward) land here.
  // Tab switches below go through a separate channel that bypasses the
  // router entirely, so this effect is what lets a non-tab route (e.g.
  // /activity/[id]) ever become visible.
  useEffect(() => {
    if (pathname === SETTINGS_PATH) {
      window.history.replaceState(window.history.state, "", "/");
      setPath("/");
      setSettingsOpen(true);
      return;
    }
    setPath(pathname);
  }, [pathname]);

  const navigate = useCallback((href: string) => {
    if (href === window.location.pathname) {
      setPath(href);
      return;
    }
    // Tab switches replace history so Back leaves the PWA instead of walking tabs.
    window.history.replaceState(window.history.state, "", href);
    setPath(href);
  }, []);

  const value = useMemo(
    () => ({ path, navigate, settingsOpen, setSettingsOpen, settingsSection, setSettingsSection, openSettings }),
    [path, navigate, settingsOpen, settingsSection, openSettings]
  );
  return <SpaNavContext.Provider value={value}>{children}</SpaNavContext.Provider>;
}
