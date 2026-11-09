"use client";

import { format } from "date-fns";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpaNav } from "@/components/layout/spa-nav";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Shown above the title, top-left — e.g. a Back link on a drill-down page. */
  leading?: React.ReactNode;
  sticky?: boolean;
}

export function Header({ title, subtitle, action, leading, sticky = false }: HeaderProps) {
  const today = format(new Date(), "EEEE d MMM");
  const { path, navigate } = useSpaNav();
  // Settings isn't in the phone bottom bar; this gear is how phones reach it.
  const showSettings = path !== "/settings";

  return (
    <div className={cn(
      "flex items-end justify-between gap-4 px-5 pt-6 pb-4 md:px-8 md:pt-8",
      sticky && "sticky top-0 z-30 bg-[var(--paper)]"
    )}>
      <div className="min-w-0">
        {leading && <div className="mb-3">{leading}</div>}
        <h1 className="text-[1.85rem] md:text-[2.15rem] font-extrabold tracking-tight text-[var(--ink)] truncate leading-none">
          {title}
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-[var(--ink-soft)] truncate">
          {subtitle ?? today}
        </p>
      </div>
      {(action || showSettings) && (
        <div className="shrink-0 pb-0.5 flex items-center gap-1">
          {action}
          {showSettings && (
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Settings"
              className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
            >
              <Settings size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
