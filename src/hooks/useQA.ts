import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { QAAuditLogEntry, QAChecklist } from "@/types/api";

export function useQAAuditLog(surveyId: string) {
  return useQuery({
    queryKey: ["qa", "audit-log", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<QAAuditLogEntry[]>(`/api/v1/surveys/${surveyId}/qa-log`);
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useQAChecklist(surveyId: string) {
  return useQuery({
    queryKey: ["qa", "checklist", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<QAChecklist>(`/api/v1/surveys/${surveyId}/qa-checklist`);
      return res.data;
    },
    enabled: !!surveyId,
  });
}
