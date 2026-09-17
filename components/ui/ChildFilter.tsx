"use client";

import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { Child } from "@/lib/types";

/**
 * Multi-select child filter — names with a colour mark, no "All" control.
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
    <div className={cn("flex flex-wrap gap-x-5 gap-y-2", className)}>
      {children.map(child => {
        const active = selected.includes(child.id);
        return (
          <button
            key={child.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(child.id)}
            className={cn(
              "inline-flex items-center gap-2 h-9 text-sm font-medium border-b-2 cursor-pointer",
              active
                ? "text-[var(--ink)]"
                : "text-[var(--ink-faint)] border-transparent hover:text-[var(--ink-soft)]"
            )}
            style={active ? { borderBottomColor: child.color_code } : undefined}
          >
            <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={20} />
            {child.name}
          </button>
        );
      })}
    </div>
  );
}
