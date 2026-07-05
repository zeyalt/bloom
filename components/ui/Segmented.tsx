"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  fullWidth?: boolean;
}

/** Pill-track view switch — white thumb marks the active segment. */
export function Segmented<T extends string>({ value, onChange, options, className, fullWidth }: SegmentedProps<T>) {
  return (
    <div className={cn(fullWidth ? "flex w-full" : "inline-flex", "p-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]", className)}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-4 py-2 rounded-full text-sm transition-all duration-150 cursor-pointer",
              fullWidth && "flex-1",
              active
                ? "bg-white text-[var(--text-primary)] font-semibold shadow-[var(--shadow-xs)]"
                : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
