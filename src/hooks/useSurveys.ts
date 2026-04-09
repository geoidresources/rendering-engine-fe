import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { Survey, SurveyAsset } from "@/types/api";

export function useSurveys(projectId?: string) {
  return useQuery({
    queryKey: ["surveys", projectId],
    queryFn: async () => {
      const params = projectId ? `?project_id=${projectId}` : "";
      const res = await apiClient.get<Survey[]>(`/api/v1/surveys${params}`);
      return res.data;
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
      const res = await apiClient.get<SurveyAsset[]>(`/api/v1/surveys/${surveyId}/assets`);
      return res.data;
    },
    enabled: !!surveyId,
  });
}
