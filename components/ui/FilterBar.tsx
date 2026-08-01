"use client";

import { cn } from "@/lib/utils";

/**
 * A filter control with its name above it. Keeps the label wording out of the
 * control itself, so "All Activities" reads as a value rather than a title.
 */
export function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("shrink-0", className)}>
      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * One row of filters, shared by every tab. Stays on a single line at all widths —
 * narrow screens scroll it horizontally rather than stacking, and the negative
 * margin lets it bleed to the screen edge so the last control doesn't look
 * clipped mid-swipe. `trailing` holds anything right-aligned, e.g. a record count.
 */
export function FilterBar({
  children,
  trailing,
  stretch,
  className,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  /**
   * Share the full row width evenly between the filters. Each `FilterField`
   * becomes an equal flex child and its control (a dropdown's wrapper div, or a
   * bare input) fills it.
   *
   * Kicks in at 520px rather than Tailwind's `sm` (640px): a ~600px window has
   * plenty of room for three even columns, and gating at `sm` left those windows
   * showing the unstretched default widths. Below 520px three equal columns get
   * too narrow to read, so the row keeps natural widths and scrolls instead.
   */
  stretch?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end gap-2", className)}>
      <div
        className={cn(
          "flex flex-nowrap items-end gap-2 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          stretch
            // Once stretched the row fits, so it must NOT carry the bleed padding —
            // that padding sits inside `w-full` and would leave the last filter
            // short of the content edge. Bleed only below the stretch threshold,
            // where the row genuinely scrolls.
            ? "max-[519px]:-mx-5 max-[519px]:px-5 min-[520px]:w-full [&>*]:min-[520px]:flex-1 [&>*]:min-[520px]:min-w-0 [&>*>div]:min-[520px]:w-full [&>*>input]:min-[520px]:w-full"
            : "-mx-5 px-5 md:-mx-8 md:px-8"
        )}
      >
        {children}
      </div>
      {trailing && (
        <div className="shrink-0 sm:ml-auto sm:pb-2.5">{trailing}</div>
      )}
    </div>
  );
}
