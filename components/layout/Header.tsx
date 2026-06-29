"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showBack?: boolean;
  sticky?: boolean;
}

export function Header({ title, subtitle, action, showBack = false, sticky = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const today = format(new Date(), "EEEE, d MMM yyyy");

  // Auto-show back button on child detail pages
  const isChildPage = pathname.includes("/child/");
  const shouldShowBack = showBack || isChildPage;

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 py-5 px-5 md:py-7 md:px-8 border-b border-[var(--border)] bg-[var(--bg-card)]",
      sticky && "sticky top-0 z-30"
    )}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {shouldShowBack && (
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all duration-200 shrink-0"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] truncate">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)] truncate">{subtitle}</p>
          ) : (
            <p className="mt-1 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{today}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
