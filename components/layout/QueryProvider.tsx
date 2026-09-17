"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import {
  fetchActivities,
  fetchAttendanceLogs,
  fetchCategories,
  fetchChildren,
  fetchExpenses,
  fetchSchedules,
} from "@/lib/api-hooks";
import { getCurrentYear } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      retry: 1,
    },
  },
});

function prefetchAppData() {
  queryClient.prefetchQuery({ queryKey: ["children"], queryFn: fetchChildren });
  queryClient.prefetchQuery({ queryKey: ["activities"], queryFn: fetchActivities });
  queryClient.prefetchQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });
  queryClient.prefetchQuery({ queryKey: ["attendance-logs"], queryFn: fetchAttendanceLogs });
  queryClient.prefetchQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  queryClient.prefetchQuery({
    queryKey: ["expenses", { year: getCurrentYear(), limit: 500 }],
    queryFn: () => fetchExpenses({ year: getCurrentYear(), limit: 500 }),
  });
  queryClient.prefetchQuery({
    queryKey: ["expenses", { limit: 500 }],
    queryFn: () => fetchExpenses({ limit: 500 }),
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    prefetchAppData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
