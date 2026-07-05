"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pill-shaped select on the 40px control baseline with a soft focus ring and custom chevron. */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        {...props}
        className="appearance-none w-full h-10 pl-4 pr-9 text-sm rounded-full border border-[var(--border)] bg-white text-[var(--text-primary)] cursor-pointer transition-all focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
    </div>
  );
}
