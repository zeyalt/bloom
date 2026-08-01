"use client";

import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";

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
      <div className="px-5 md:px-8 space-y-6 pb-8 pt-4 md:pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-[var(--bg-secondary)] rounded-2xl animate-pulse" />)}
        </div>
        {[1, 2].map(i => <div key={i} className="h-80 bg-[var(--bg-secondary)] rounded-2xl animate-pulse" />)}
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Analytics" subtitle="The story behind the numbers 📊" />
      <AnalyticsDashboard />
    </div>
  );
}
