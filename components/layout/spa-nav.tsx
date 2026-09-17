"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export const TAB_PATHS = ["/", "/attendance", "/expenses", "/analytics", "/journal", "/settings"] as const;
export type TabPath = (typeof TAB_PATHS)[number];

export function isTabPath(path: string): path is TabPath {
  return (TAB_PATHS as readonly string[]).includes(path);
}

type SpaNavValue = {
  path: string;
  navigate: (href: string) => void;
};

const SpaNavContext = createContext<SpaNavValue | null>(null);

export function useSpaNav() {
  const ctx = useContext(SpaNavContext);
  if (!ctx) throw new Error("useSpaNav must be used within SpaNavProvider");
  return ctx;
}

export function SpaNavProvider({ children }: { children: ReactNode }) {
  const initial = usePathname() || "/";
  const [path, setPath] = useState(initial);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = useCallback((href: string) => {
    if (href === window.location.pathname) {
      setPath(href);
      return;
    }
    // Tab switches replace history so Back leaves the PWA instead of walking tabs.
    window.history.replaceState(window.history.state, "", href);
    setPath(href);
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <SpaNavContext.Provider value={value}>{children}</SpaNavContext.Provider>;
}
