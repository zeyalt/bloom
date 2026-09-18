"use client";

import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { Child } from "@/lib/types";

/**
 * Multi-select child filter — colour pills, no "All" control.
 * An empty `selected` array means "everyone" (no filter applied).
 */
export function ChildFilter({
  children,
  selected,
  onToggle,
  className,
}: {
  children: Child[];
  selected: string[];
  onToggle: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {children.map(child => {
        const active = selected.includes(child.id);
        return (
          <button
            key={child.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(child.id)}
            style={active ? { backgroundColor: child.color_code } : undefined}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-medium border cursor-pointer",
              active
                ? "text-white border-transparent"
                : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)] hover:text-[var(--ink)]"
            )}
          >
            <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={20} />
            {child.name}
          </button>
        );
      })}
    </div>
  );
}
