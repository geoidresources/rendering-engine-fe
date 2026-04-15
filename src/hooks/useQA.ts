// `/surveys/:id/qa-log` is a list endpoint (`{data, pagination}`).
// `/surveys/:id/qa-checklist` returns a single checklist row directly —
// raw object shape.

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type { ListEnvelope, QAAuditLogEntry, QAChecklist } from "@/types/api";

export function useQAAuditLog(surveyId: string) {
  return useQuery({
    queryKey: ["qa", "audit-log", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<QAAuditLogEntry>>(
        `/api/v1/surveys/${surveyId}/qa-log`,
      );
      return unwrapList<QAAuditLogEntry>(res.data);
    },
    enabled: !!surveyId,
  });
}

export function useQAChecklist(surveyId: string) {
  return useQuery({
    queryKey: ["qa", "checklist", surveyId],
    queryFn: async () => {
      const res = await apiClient.get<QAChecklist>(
        `/api/v1/surveys/${surveyId}/qa-checklist`,
      );
      return res.data;
    },
    enabled: !!surveyId,
  });
}
