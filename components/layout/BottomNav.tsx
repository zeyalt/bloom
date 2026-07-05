"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  NotebookPen,
  Receipt,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)]/95 backdrop-blur-sm border-t border-[var(--border)] shadow-[0_-1px_16px_rgba(28,25,23,0.05)] flex items-center safe-area-inset-bottom">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex-1 flex flex-col items-center gap-1 py-3 min-h-16 transition-all duration-150",
              active ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
            )}
          >
            {active && <span className="absolute top-0 h-[3px] w-7 rounded-full bg-[var(--accent-primary)]" />}
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-xs font-medium leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
