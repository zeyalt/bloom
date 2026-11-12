"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { MY_DAY } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import { useSpaNav } from "@/components/layout/spa-nav";
import { IconButton } from "@/components/ui/IconButton";
import { GUTTER } from "@/components/layout/Page";

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Icon buttons only (use `IconButton`) — text buttons and switches belong in Utilities. */
  action?: React.ReactNode;
  /** A Back link above the title, for drill-down pages. */
  leading?: React.ReactNode;
}

/**
 * Fixed-height title row, identical on every screen: 24px top padding, a 32px title
 * line, 4px gap, a 20px subtitle line and 16px below — 96px in all (80px under a
 * 56px Back row on drill-down pages). Actions sit top-right in 48×48 slots.
 */
export function Header({ title, subtitle, action, leading }: HeaderProps) {
  const today = format(new Date(), "EEEE d MMM");
  const { setSettingsOpen } = useSpaNav();
  const router = useRouter();

  return (
    <header>
      {leading && <div className="h-14 pt-2 px-2 md:px-6 flex items-center">{leading}</div>}
      <div className={cn(GUTTER, "flex items-start justify-between gap-4 box-border", leading ? "h-20 pt-2" : "h-24 pt-6")}>
        <div className="min-w-0">
          <h1 className="m-0 text-[28px] leading-8 font-extrabold tracking-tight text-[var(--ink)] truncate">{title}</h1>
          <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)] truncate">{subtitle ?? today}</p>
        </div>
        <div className="shrink-0 -mt-2 -mr-3 flex items-center">
          {action}
          {/* My Day and Settings aren't in the phone bottom bar; these are how phones reach them. */}
          <IconButton icon={MY_DAY.icon} label="My Day" onClick={() => router.push(MY_DAY.href)} className="md:hidden" />
          <IconButton icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} className="md:hidden" />
        </div>
      </div>
    </header>
  );
}

/** The Back control for drill-down pages: a 48px-tall text button. */
export function BackButton({ onClick, label = "Back", icon: Icon }: { onClick: () => void; label?: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-2 h-12 px-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer">
      <span className="w-6 h-6 flex items-center justify-center" aria-hidden="true"><Icon size={20} /></span>
      {label}
    </button>
  );
}
