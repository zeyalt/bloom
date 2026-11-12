"use client";

import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpaNav } from "@/components/layout/spa-nav";
import { MY_DAY, NAV_ITEMS } from "@/components/layout/nav-items";

export function Sidebar() {
  const { path, navigate, settingsOpen, setSettingsOpen } = useSpaNav();
  const router = useRouter();

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-[var(--rule)] bg-[var(--sheet)] h-screen sticky top-0">
      <div className="px-4 py-6">
        <button type="button" onClick={() => navigate("/")} className="text-left cursor-pointer">
          <span className="block text-xl font-extrabold tracking-tight text-[var(--ink)] leading-none">
            Bloom
          </span>
          <span className="mt-1 block text-sm text-[var(--ink-faint)]">Class register</span>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? path === "/" : path.startsWith(href);
          return (
            <button
              type="button"
              key={href}
              onClick={() => navigate(href)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm w-full text-left cursor-pointer",
                active
                  ? "text-[var(--stem)] font-semibold border-l-2 border-[var(--stem)] pl-[10px]"
                  : "text-[var(--ink-soft)] font-medium border-l-2 border-transparent pl-[10px] hover:text-[var(--ink)]"
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.7} />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => router.push(MY_DAY.href)}
          className="flex items-center gap-3 px-3 py-2 text-sm w-full text-left cursor-pointer text-[var(--ink-soft)] font-medium border-l-2 border-transparent pl-[10px] hover:text-[var(--ink)]"
        >
          <MY_DAY.icon size={16} strokeWidth={1.7} />
          {MY_DAY.label}
        </button>
      </nav>

      <div className="px-3 py-4 border-t border-[var(--rule)]">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm w-full text-left cursor-pointer border-l-2 border-transparent pl-[10px]",
            settingsOpen ? "text-[var(--stem)] font-semibold" : "text-[var(--ink-soft)] font-medium hover:text-[var(--ink)]"
          )}
        >
          <Settings size={16} strokeWidth={settingsOpen ? 2.2 : 1.7} />
          Settings
        </button>
      </div>
    </aside>
  );
}
