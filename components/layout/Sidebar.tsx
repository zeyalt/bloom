"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
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
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/bloom-logo.png"
            alt="Bloom Logo"
            className="w-8 h-8 object-contain"
          />
          <span className="text-lg font-bold text-[var(--text-primary)]">
            Bloom
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Children quick-links */}
      <div className="px-3 py-4 border-t border-[var(--border)] space-y-0.5">
        <p className="px-3 pb-1 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Children
        </p>
        <Link
          href="/child/11111111-1111-1111-1111-111111111111"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
            pathname.includes("11111111")
              ? "bg-blue-50 text-blue-700"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
          🌿 Zayyan
        </Link>
        <Link
          href="/child/22222222-2222-2222-2222-222222222222"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
            pathname.includes("22222222")
              ? "bg-pink-50 text-pink-700"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-[#DB2777] shrink-0" />
          🌸 Zara
        </Link>
      </div>
    </aside>
  );
}
