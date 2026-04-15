// `/measurements` is a list endpoint wrapped in `{data, pagination}`.
// `/measurements/inventory` is a rollup (single object), raw.

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type {
  ListEnvelope,
  MeasurementInventorySummary,
  MeasurementRecord,
} from "@/types/api";

export function useMeasurements(projectId: string) {
  return useQuery({
    queryKey: ["measurements", projectId],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<MeasurementRecord>>(
        `/api/v1/measurements?project_id=${projectId}`,
      );
      return unwrapList<MeasurementRecord>(res.data);
    },
    enabled: !!projectId,
  });
}

export function useMeasurementInventory(projectId: string, surveyId: string) {
  return useQuery({
    queryKey: ["measurements", "inventory", projectId, surveyId],
    queryFn: async () => {
      const res = await apiClient.get<MeasurementInventorySummary>(
        `/api/v1/measurements/inventory?project_id=${projectId}&survey_id=${surveyId}`,
      );
      return res.data;
    },
    enabled: !!projectId && !!surveyId,
  });
}
