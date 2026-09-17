"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  sticky?: boolean;
}

export function Header({ title, subtitle, action, sticky = false }: HeaderProps) {
  const today = format(new Date(), "EEEE d MMM");

  return (
    <div className={cn(
      "flex items-end justify-between gap-4 px-5 pt-6 pb-4 md:px-8 md:pt-8",
      sticky && "sticky top-0 z-30 bg-[var(--paper)]"
    )}>
      <div className="min-w-0">
        <h1 className="text-[1.85rem] md:text-[2.15rem] font-extrabold tracking-tight text-[var(--ink)] truncate leading-none">
          {title}
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-[var(--ink-soft)] truncate">
          {subtitle ?? today}
        </p>
      </div>
      {action && <div className="shrink-0 pb-0.5">{action}</div>}
    </div>
  );
}
