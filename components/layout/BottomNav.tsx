"use client";

import { cn } from "@/lib/utils";
import { useSpaNav } from "@/components/layout/spa-nav";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function BottomNav() {
  const { path, navigate } = useSpaNav();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--sheet)] border-t border-[var(--rule)] flex items-stretch pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.filter(item => item.bottomNav).map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? path === "/" : path.startsWith(href);
        return (
          <button
            type="button"
            key={href}
            onClick={() => navigate(href)}
            className={cn(
              "relative flex-1 min-w-12 h-14 flex flex-col items-center justify-center gap-1 cursor-pointer",
              active ? "text-[var(--stem)]" : "text-[var(--ink-faint)]"
            )}
          >
            {active && <span className="absolute top-0 inset-x-6 h-[2px] bg-[var(--stem)]" />}
            <span className="w-6 h-6 flex items-center justify-center" aria-hidden="true"><Icon size={22} strokeWidth={active ? 2.2 : 1.7} /></span>
            <span className="text-xs leading-4 font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
