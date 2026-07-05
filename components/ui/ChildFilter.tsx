"use client";

import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { Child } from "@/lib/types";

/**
 * Multi-select child filter — toggle chips, no "All" pill.
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
              "inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium border transition-all duration-150 cursor-pointer",
              active
                ? "text-white border-transparent"
                : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]"
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
