// Reconciliation page hooks. Two services are involved:
//
//   - rendering-engine-be (:8080) — server-classified summary for the KPI
//     tiles, so the row badges agree with the header numbers.
//   - asset-svc (:8082)           — the "Run reconciliation" trigger and the
//     threshold CRUD used by the gear-icon popover.
//
// Keeping both here avoids two hook files for one page and makes cache
// invalidation obvious: the run-mutation knows exactly which queries to
// refetch so the UI lands on fresh data in a single place.

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, assetSvcClient } from "@/lib/http";
import type {
  AnalyticsThreshold,
  MaterialsResponse,
  ReconciliationSummary,
  RunReconciliationRequest,
  RunReconciliationResponse,
} from "@/types/api";

// Project-scoped materials picker for the run-reconciliation popover. Shares
// the ["analytics","materials", projectId] cache key with useHomeDashboard so
// the second consumer is free.
export function useProjectMaterials(projectId: string) {
  return useQuery({
    queryKey: ["analytics", "materials", projectId],
    queryFn: async () => {
      const res = await apiClient.get<MaterialsResponse>(
        `/api/v1/analytics/materials?project_id=${projectId}`,
      );
      return res.data?.materials ?? [];
    },
    enabled: !!projectId,
  });
}

// Fetches the pre-aggregated reconciliation KPIs from rendering-engine-be.
// `enabled: !!projectId` so the hook is safe to mount before the project
// dropdown resolves.
export function useReconciliationSummary(projectId: string) {
  return useQuery({
    queryKey: ["analytics", "reconciliation", "summary", projectId],
    queryFn: async () => {
      const res = await apiClient.get<ReconciliationSummary>(
        `/api/v1/analytics/reconciliation/summary?project_id=${projectId}`,
      );
      return res.data;
    },
    enabled: !!projectId,
  });
}

// Fires the auto-derive + NATS submission. The response lists the workflow
// IDs that were queued — the caller polls until the summary's `last_run`
// advances. Invalidates both the list and the summary so every card on the
// page refetches once the user dismisses the popover.
export function useRunReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { projectId: string } & RunReconciliationRequest) => {
      const { projectId, ...body } = vars;
      const res = await assetSvcClient.post<RunReconciliationResponse>(
        `/asset-svc/api/v1/projects/${projectId}/reconciliation/run`,
        body,
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["analytics", "reconciliation", vars.projectId],
      });
      qc.invalidateQueries({
        queryKey: ["analytics", "reconciliation", "summary", vars.projectId],
      });
    },
  });
}

// Lists the caller's thresholds plus the __default__ row. The backend tags
// each row with `source` so the popover can render "inherited from default"
// without the frontend replaying the clientID comparison.
export function useThresholds() {
  return useQuery({
    queryKey: ["analytics", "thresholds"],
    queryFn: async () => {
      const res = await assetSvcClient.get<AnalyticsThreshold[]>(
        `/asset-svc/api/v1/analytics/thresholds`,
      );
      return res.data ?? [];
    },
  });
}

export function useUpsertThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      metric: string;
      green_upper_pct: number;
      amber_upper_pct: number;
    }) => {
      const res = await assetSvcClient.put<AnalyticsThreshold>(
        `/asset-svc/api/v1/analytics/thresholds/${vars.metric}`,
        {
          green_upper_pct: vars.green_upper_pct,
          amber_upper_pct: vars.amber_upper_pct,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics", "thresholds"] });
      // Thresholds feed the summary's status classification — invalidate so
      // the KPI tiles re-class next poll.
      qc.invalidateQueries({
        queryKey: ["analytics", "reconciliation", "summary"],
      });
    },
  });
}

export function useDeleteThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (metric: string) => {
      await assetSvcClient.delete(
        `/asset-svc/api/v1/analytics/thresholds/${metric}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics", "thresholds"] });
      qc.invalidateQueries({
        queryKey: ["analytics", "reconciliation", "summary"],
      });
    },
  });
}
