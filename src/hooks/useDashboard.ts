// useDashboardSummary wraps the `/api/v1/dashboard/summary` endpoint.
//
// The backend now accepts optional `start_date` / `end_date` RFC3339 query
// params and filters `recent_projects`, `alert_count`, `pending_surveys`
// and `pipeline_activity` to that window (bucket width inside the chart
// auto-scales: daily ≤7d, weekly ≤90d, monthly otherwise). We thread the
// range into the queryKey so the Day/Week/Month/Year tabs on /home
// trigger a proper refetch instead of re-rendering stale data.
//
// Both bounds are optional on purpose — omitting them lets the server
// apply its default (now-365d, now), matching the pre-range behaviour
// for callers that don't care about the window.

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { DashboardSummary, DashboardSummaryParams } from "@/types/api";

export function useDashboardSummary(params: DashboardSummaryParams = {}) {
  const { startDate, endDate } = params;

  return useQuery({
    // The queryKey intentionally includes both bounds so flipping the
    // /home time-range tabs invalidates the cached response. TanStack
    // treats undefined values as stable, so callers that omit the
    // range share a single cache entry.
    queryKey: ["dashboard", "summary", startDate ?? null, endDate ?? null],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (startDate) qs.set("start_date", startDate);
      if (endDate) qs.set("end_date", endDate);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const res = await apiClient.get<DashboardSummary>(
        `/api/v1/dashboard/summary${suffix}`,
      );
      return res.data;
    },
  });
}
