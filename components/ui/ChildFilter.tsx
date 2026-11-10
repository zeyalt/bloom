"use client";

import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { Child } from "@/lib/types";

/**
 * Child filter — colour pills, 40px tall with 48px tap zones, always the first
 * utility row under the header. Multi-select by default (an empty `selected`
 * means nobody); `single` makes it a one-of picker.
 */
export function ChildFilter({
  childList,
  selected,
  onToggle,
  single = false,
  className,
}: {
  childList: Child[];
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label={single ? "Child" : "Children shown"}>
      {childList.map(child => {
        const active = selected.includes(child.id);
        return (
          <button
            key={child.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(child.id)}
            style={active ? { backgroundColor: child.color_code } : undefined}
            className={cn(
              "relative inline-flex items-center gap-2 h-10 pl-2 pr-4 rounded-full text-sm font-medium border cursor-pointer",
              "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
              active
                ? "text-white border-transparent"
                : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)] hover:text-[var(--ink)]"
            )}
          >
            <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={24} />
            {child.name}
          </button>
        );
      })}
    </div>
  );
}
