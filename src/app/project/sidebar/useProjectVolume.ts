"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type { ListEnvelope, Survey, StockpileRecord } from "@/types/api";

/**
 * Derives total stockpile volume (m³) for a project by:
 *   1. Fetching surveys for the project (reuses cache key from sidebar)
 *   2. Taking the most-recent survey
 *   3. Summing `volume_m3` across all stockpile records for that survey
 *
 * Both /surveys and /analytics/stockpiles are list endpoints wrapped in
 * `{data, pagination}` — we unwrap via the shared helper so the sum below
 * sees a real array even if a transient proxy wraps/unwraps the payload.
 */
export function useProjectVolume(projectId: string | undefined) {
  const surveysQ = useQuery({
    queryKey: ["sidebar", "surveys", projectId],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<Survey>>(
        `/api/v1/surveys?project_id=${projectId}`,
      );
      return unwrapList<Survey>(res.data);
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Surveys are returned in desc order by the API; take the first.
  const latestSurveyId = surveysQ.data?.[0]?.id;

  const stockpilesQ = useQuery({
    queryKey: ["analytics", "stockpiles", latestSurveyId],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<StockpileRecord>>(
        `/api/v1/analytics/stockpiles?survey_id=${latestSurveyId}`,
      );
      return unwrapList<StockpileRecord>(res.data);
    },
    enabled: !!latestSurveyId,
    staleTime: 60_000,
  });

  const totalVolume = useMemo(() => {
    if (!stockpilesQ.data?.length) return null;
    return stockpilesQ.data.reduce((sum, r) => sum + (r.volume_m3 ?? 0), 0);
  }, [stockpilesQ.data]);

  return {
    totalVolume,
    isLoading: surveysQ.isLoading || stockpilesQ.isLoading,
  };
}
