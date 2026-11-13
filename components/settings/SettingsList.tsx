"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The one list pattern every Settings section uses, matching the Home session rows:
 * a single ruled sheet, rows of title → meta → sub, and 48px icon actions on the
 * right that sit inside the row's padding instead of stretching it.
 */

export function SettingsList({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-[var(--rule)] border-y border-[var(--rule)] bg-[var(--sheet)]">
      {children}
    </ul>
  );
}

export function SettingsRow({
  leading, title, onTitleClick, tags, meta, sub, actions, children,
}: {
  /** Avatar, swatch or emoji, top-aligned with the title. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Makes the title a link-style button (e.g. open the activity page). */
  onTitleClick?: () => void;
  /** Small chips after the title — status, category, term. */
  tags?: React.ReactNode;
  /** One line of supporting detail under the title. */
  meta?: React.ReactNode;
  /** A quieter second line, e.g. dates. */
  sub?: React.ReactNode;
  /** `IconButton`s. */
  actions?: React.ReactNode;
  /** Extra content under the row, full width (past the actions), e.g. a schedule's day list. */
  children?: React.ReactNode;
}) {
  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {onTitleClick ? (
              <button type="button" onClick={onTitleClick}
                className="relative min-w-12 text-left text-base leading-6 font-semibold text-[var(--stem)] hover:underline cursor-pointer break-words before:absolute before:inset-x-0 before:-inset-y-3 before:content-['']">
                {title}
              </button>
            ) : (
              <span className="text-base leading-6 font-semibold text-[var(--ink)] break-words">{title}</span>
            )}
            {tags}
          </div>
          {meta && <div className="text-sm leading-5 text-[var(--ink-soft)] break-words">{meta}</div>}
          {sub && <div className="text-sm leading-5 text-[var(--ink-faint)]">{sub}</div>}
        </div>
        {actions && <div className="shrink-0 -my-3 -mr-3 flex">{actions}</div>}
      </div>
      {children}
    </li>
  );
}

/** A small chip beside a row title. Tinted with `color` (a category), else outlined. */
export function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs leading-4 font-medium whitespace-nowrap",
        !color && "border border-[var(--rule)] text-[var(--ink-soft)]")}
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
    >
      {children}
    </span>
  );
}

/** Heading above a group of rows (e.g. a category in Schedules). */
export function GroupHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h3 className="flex items-center gap-2 pb-2 text-sm leading-5 font-semibold text-[var(--ink-soft)]">
      {children}
      {count !== undefined && <span className="font-medium text-[var(--ink-faint)]">{count}</span>}
    </h3>
  );
}

/** "Show 3 ended" — reveals the rows that are hidden by default. */
export function MoreToggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open}
      className="inline-flex items-center gap-2 h-12 -ml-1 px-1 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer">
      {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
