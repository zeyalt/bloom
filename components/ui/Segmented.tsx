"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  className?: string;
  /** Accessible name for the group, e.g. "View". */
  ariaLabel?: string;
}

/**
 * The one tab switch used on every screen: full width, 40px tall, options share
 * the width equally; the active option is ink on paper. Tap zones are 48px.
 */
export function Segmented<T extends string>({ value, onChange, options, className, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex w-full h-10 border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-md)]", className)}>
      {options.map((o, i) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 min-w-0 flex items-center justify-center gap-2 px-2 text-sm cursor-pointer",
              "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
              i > 0 && "border-l border-[var(--rule)]",
              "first:rounded-l-[5px] last:rounded-r-[5px]",
              active ? "bg-[var(--ink)] text-[var(--sheet)] font-semibold" : "text-[var(--ink-soft)] font-medium hover:text-[var(--ink)]"
            )}
          >
            {Icon && <Icon size={16} aria-hidden="true" className="shrink-0" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
