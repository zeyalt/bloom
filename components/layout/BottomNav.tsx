"use client";

import { cn } from "@/lib/utils";
import { useSpaNav } from "@/components/layout/spa-nav";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function BottomNav() {
  const { path, navigate } = useSpaNav();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--sheet)] border-t border-[var(--rule)] flex items-center safe-area-inset-bottom">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? path === "/" : path.startsWith(href);
        return (
          <button
            type="button"
            key={href}
            onClick={() => navigate(href)}
            className={cn(
              "relative flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-14 cursor-pointer",
              active ? "text-[var(--stem)]" : "text-[var(--ink-faint)]"
            )}
          >
            {active && <span className="absolute top-0 inset-x-6 h-[2px] bg-[var(--stem)]" />}
            <Icon size={19} strokeWidth={active ? 2.2 : 1.7} />
            <span className="text-[11px] font-medium leading-tight">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
