import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { StockpileRecord, ReconciliationRecord, TemporalSnapshot, StockpileZone } from "@/types/api";

export function useStockpiles(surveyId: string) {
  return useQuery({
    queryKey: ["analytics", "stockpiles", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<StockpileRecord[]>(`/api/v1/analytics/stockpiles?survey_id=${surveyId}`);
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useStockpilesByZone(surveyId: string) {
  return useQuery({
    queryKey: ["analytics", "stockpiles", "by-zone", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<StockpileZone[]>(`/api/v1/analytics/stockpiles/by-zone?survey_id=${surveyId}`);
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useReconciliation(projectId: string) {
  return useQuery({
    queryKey: ["analytics", "reconciliation", projectId],
    queryFn: async () => {
      const res = await apiClient.get<ReconciliationRecord[]>(`/api/v1/analytics/reconciliation?project_id=${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useTemporalTrends(projectId: string, material: string) {
  return useQuery({
    queryKey: ["analytics", "trends", projectId, material],
    queryFn: async () => {
      const res = await apiClient.get<TemporalSnapshot[]>(`/api/v1/analytics/trends?project_id=${projectId}&material=${encodeURIComponent(material)}`);
      return res.data;
    },
    enabled: !!projectId && !!material,
  });
}
