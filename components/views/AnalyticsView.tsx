"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CalendarCheck, Receipt } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Page, GUTTER } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";

export type AnalyticsSegment = "attendance" | "spending";

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
      <div className={cn(GUTTER, "flex flex-col gap-6")}>
        <div className="flex flex-col gap-3">
          <div className="h-10 w-48 bg-[var(--bg-secondary)] animate-pulse rounded-full" />
          <div className="h-10 bg-[var(--bg-secondary)] animate-pulse" />
        </div>
        {[1, 2].map(i => <div key={i} className="h-80 bg-[var(--bg-secondary)] animate-pulse" />)}
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  const [segment, setSegment] = useState<AnalyticsSegment>("attendance");
  // The dashboard renders the switch between its child pills and its filters.
  const tabs = (
    <Segmented
      ariaLabel="Analytics view"
      value={segment}
      onChange={setSegment}
      options={[
        { value: "attendance", label: "Attendance", icon: CalendarCheck },
        { value: "spending", label: "Spending", icon: Receipt },
      ]}
    />
  );
  return (
    <Page>
      <Header title="Analytics" subtitle="Spend and hours" />
      <AnalyticsDashboard segment={segment} tabs={tabs} />
    </Page>
  );
}
