import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { DashboardSummary } from "@/types/api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const res = await apiClient.get<DashboardSummary>("/api/v1/dashboard/summary");
      return res.data;
    },
  });
}
