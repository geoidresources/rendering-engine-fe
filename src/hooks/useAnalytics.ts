// Analytics list endpoints (stockpiles, reconciliation, trends) all wrap
// rows in `{data, pagination}`. `by-zone` is an aggregate projection and
// returns a raw array directly — it does NOT go through `listEnvelope`
// in rendering-engine-be. Unwrap only where the contract says so.

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type {
  ListEnvelope,
  ReconciliationRecord,
  StockpileRecord,
  StockpileZone,
  TemporalSnapshot,
} from "@/types/api";

export function useStockpiles(surveyId: string) {
  return useQuery({
    queryKey: ["analytics", "stockpiles", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<StockpileRecord>>(
        `/api/v1/analytics/stockpiles?survey_id=${surveyId}`,
      );
      return unwrapList<StockpileRecord>(res.data);
    },
    enabled: !!surveyId,
  });
}

export function useStockpilesByZone(surveyId: string) {
  return useQuery({
    queryKey: ["analytics", "stockpiles", "by-zone", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<StockpileZone[]>(
        `/api/v1/analytics/stockpiles/by-zone?survey_id=${surveyId}`,
      );
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useReconciliation(projectId: string) {
  return useQuery({
    queryKey: ["analytics", "reconciliation", projectId],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<ReconciliationRecord>>(
        `/api/v1/analytics/reconciliation?project_id=${projectId}`,
      );
      return unwrapList<ReconciliationRecord>(res.data);
    },
    enabled: !!projectId,
  });
}

export function useTemporalTrends(projectId: string, material: string) {
  return useQuery({
    queryKey: ["analytics", "trends", projectId, material],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<TemporalSnapshot>>(
        `/api/v1/analytics/trends?project_id=${projectId}&material=${encodeURIComponent(material)}`,
      );
      return unwrapList<TemporalSnapshot>(res.data);
    },
    enabled: !!projectId && !!material,
  });
}
