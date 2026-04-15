// `/api/v1/surveys` and `/api/v1/surveys/:id/assets` are list endpoints —
// rendering-engine-be wraps them in `{data, pagination}`. `/api/v1/surveys/:id`
// is an object endpoint that stays raw. We route the list paths through
// `unwrapList` so callers get plain arrays regardless of shape drift.

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type { ListEnvelope, Survey, SurveyAsset } from "@/types/api";

export function useSurveys(projectId?: string) {
  return useQuery({
    queryKey: ["surveys", projectId],
    queryFn: async () => {
      const params = projectId ? `?project_id=${projectId}` : "";
      const res = await apiClient.get<ListEnvelope<Survey>>(
        `/api/v1/surveys${params}`,
      );
      return unwrapList<Survey>(res.data);
    },
  });
}

export function useSurvey(id: string) {
  return useQuery({
    queryKey: ["surveys", "detail", id],
    queryFn: async () => {
      const res = await apiClient.get<Survey>(`/api/v1/surveys/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useSurveyAssets(surveyId: string) {
  return useQuery({
    queryKey: ["surveys", surveyId, "assets"],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<SurveyAsset>>(
        `/api/v1/surveys/${surveyId}/assets`,
      );
      return unwrapList<SurveyAsset>(res.data);
    },
    enabled: !!surveyId,
  });
}
