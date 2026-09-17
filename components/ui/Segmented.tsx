"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  fullWidth?: boolean;
}

/** Hairline view switch — the active option is ink on paper. */
export function Segmented<T extends string>({ value, onChange, options, className, fullWidth }: SegmentedProps<T>) {
  return (
    <div className={cn(fullWidth ? "flex w-full" : "inline-flex", "border border-[var(--rule)] bg-[var(--sheet)]", className)}>
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-4 py-2 text-sm cursor-pointer",
              i > 0 && "border-l border-[var(--rule)]",
              fullWidth && "flex-1",
              active
                ? "bg-[var(--ink)] text-[var(--sheet)] font-semibold"
                : "text-[var(--ink-soft)] font-medium hover:text-[var(--ink)]"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
