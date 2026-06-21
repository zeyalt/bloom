"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Receipt,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/attendance", label: "Log", icon: ClipboardList },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border)] flex items-center safe-area-inset-bottom">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-150 min-h-16",
              active
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)]"
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-xs font-medium leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
