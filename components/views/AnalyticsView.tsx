"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LayoutDashboard, CalendarCheck, Receipt } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

export type AnalyticsSegment = "overview" | "attendance" | "spending";

/**
 * The dashboard pulls in recharts — ~400 KB, by far the largest dependency in
 * the app and used on this route alone. Loading it dynamically keeps it out of
 * the route's initial JS, so the shell paints immediately and the charts stream
 * in behind the same skeleton the data fetch already shows.
 */
const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/AnalyticsDashboard").then(m => m.AnalyticsDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="px-5 md:px-8 space-y-6 pb-24 md:pb-8 pt-4 md:pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-[var(--bg-secondary)] animate-pulse" />)}
        </div>
        {[1, 2].map(i => <div key={i} className="h-80 bg-[var(--bg-secondary)] animate-pulse" />)}
      </div>
    ),
  }
);

function SegmentedControl({ value, onChange }: { value: AnalyticsSegment; onChange: (v: AnalyticsSegment) => void }) {
  const options: { value: AnalyticsSegment; label: string; icon: typeof LayoutDashboard }[] = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "attendance", label: "Attendance", icon: CalendarCheck },
    { value: "spending", label: "Spending", icon: Receipt },
  ];
  return (
    <div className="flex border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-md)]">
      {options.map(({ value: v, label, icon: Icon }, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium cursor-pointer",
            i > 0 && "border-l border-[var(--rule)]",
            value === v ? "bg-[var(--ink)] text-[var(--sheet)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
          )}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [segment, setSegment] = useState<AnalyticsSegment>("overview");
  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Analytics" subtitle="Spend and hours" />
      <div className="px-5 md:px-8 pb-3">
        <SegmentedControl value={segment} onChange={setSegment} />
      </div>
      <AnalyticsDashboard segment={segment} />
    </div>
  );
}
